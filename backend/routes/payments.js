
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// =====================================
// AUTHENTICATION
// =====================================

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
        if (error) {
            return res.status(403).json({
                message: "Invalid or expired login."
            });
        }

        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Administrator access only."
        });
    }

    next();
}

// =====================================
// HELPERS
// =====================================

function validId(value) {
    return Number.isSafeInteger(Number(value)) &&
        Number(value) > 0;
}

function toCents(value) {
    const number = Number(value);

    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(number) ||
        number < 0 ||
        Math.abs(
            number * 100 - Math.round(number * 100)
        ) > 0.000001
    ) {
        return null;
    }

    return Math.round(number * 100);
}

async function getRepairTotal(repairId, db = pool) {
    const result = await db.query(
        `SELECT
            COALESCE((
                SELECT SUM(quantity * unit_price)
                FROM repair_parts
                WHERE repair_id = $1
            ), 0) +
            COALESCE((
                SELECT SUM(labor_cost)
                FROM labor_charges
                WHERE repair_id = $1
            ), 0) AS total_amount`,
        [repairId]
    );

    return Math.round(
        Number(result.rows[0].total_amount) * 100
    );
}

async function getTotalPaid(repairId, db = pool) {
    const result = await db.query(
        `SELECT COALESCE(SUM(amount_paid), 0) AS total_paid
         FROM payments
         WHERE repair_id = $1
         AND payment_status = 'Completed'`,
        [repairId]
    );

    return Math.round(
        Number(result.rows[0].total_paid) * 100
    );
}

async function getRepairAccess(repairId, user) {
    const result = await pool.query(
        `SELECT r.repair_id, d.user_id
         FROM repair_requests r
         JOIN devices d ON r.device_id = d.device_id
         WHERE r.repair_id = $1`,
        [repairId]
    );

    if (result.rows.length === 0) {
        return {
            exists: false,
            allowed: false
        };
    }

    const ownerId = result.rows[0].user_id;

    const allowed =
        user.role === "admin" ||
        (
            user.role === "customer" &&
            Number(user.user_id) === Number(ownerId)
        );

    return {
        exists: true,
        allowed
    };
}

// =====================================
// GET PAYMENT HISTORY & BALANCE
// =====================================

router.get("/:repairId", authenticateToken, async (req, res) => {
    try {
        const repairId = Number(req.params.repairId);

        if (!validId(repairId)) {
            return res.status(400).json({
                message: "Invalid repair ID."
            });
        }

        const access = await getRepairAccess(
            repairId,
            req.user
        );

        if (!access.exists) {
            return res.status(404).json({
                message: "Repair not found."
            });
        }

        if (!access.allowed) {
            return res.status(403).json({
                message: "Access denied."
            });
        }

        const totalCents = await getRepairTotal(repairId);
        const paidCents = await getTotalPaid(repairId);

        const balanceCents = Math.max(
            0,
            totalCents - paidCents
        );

        const paymentsResult = await pool.query(
            `SELECT
                payment_id,
                repair_id,
                amount_paid,
                payment_method,
                payment_status,
                payment_date,
                created_at
             FROM payments
             WHERE repair_id = $1
             ORDER BY payment_id DESC`,
            [repairId]
        );

        let status = "Unpaid";

        if (paidCents > 0 && balanceCents > 0) {
            status = "Partially Paid";
        } else if (
            totalCents > 0 &&
            balanceCents === 0
        ) {
            status = "Paid";
        }

        return res.json({
            repair_id: repairId,
            total_amount: totalCents / 100,
            total_paid: paidCents / 100,
            remaining_balance: balanceCents / 100,
            payment_status: status,
            payments: paymentsResult.rows
        });

    } catch (error) {
        console.error("Get payments error:", error);

        return res.status(500).json({
            message: "Unable to load payment information."
        });
    }
});

// =====================================
// RECORD MANUAL PAYMENT
// ADMIN ONLY
// =====================================

router.post(
    "/:repairId",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        const repairId = Number(req.params.repairId);
        const amountCents = toCents(req.body?.amount_paid);
        const method = req.body?.payment_method;

        if (
            !validId(repairId) ||
            amountCents === null ||
            amountCents <= 0 ||
            typeof method !== "string" ||
            !method.trim() ||
            method.trim().length > 100
        ) {
            return res.status(400).json({
                message: "Enter a valid payment amount and method."
            });
        }

        // PayMongo payments must be verified through
        // PayMongo, never manually marked as completed.
        if (
            method.trim().toLowerCase().includes("paymongo")
        ) {
            return res.status(400).json({
                message: "Use PayMongo Checkout for online payments."
            });
        }

        const client = await pool.connect();
        let transactionStarted = false;

        try {
            await client.query("BEGIN");
            transactionStarted = true;

            const repairResult = await client.query(
                `SELECT repair_id
                 FROM repair_requests
                 WHERE repair_id = $1
                 FOR UPDATE`,
                [repairId]
            );

            if (repairResult.rows.length === 0) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(404).json({
                    message: "Repair not found."
                });
            }

            const totalCents = await getRepairTotal(
                repairId,
                client
            );

            const paidCents = await getTotalPaid(
                repairId,
                client
            );

            const remainingCents = Math.max(
                0,
                totalCents - paidCents
            );

            if (remainingCents === 0) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(400).json({
                    message: "This repair has no outstanding balance."
                });
            }

            if (amountCents > remainingCents) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(400).json({
                    message: "Payment exceeds the remaining balance."
                });
            }

            const result = await client.query(
                `INSERT INTO payments (
                    repair_id,
                    amount_paid,
                    payment_method,
                    payment_status,
                    payment_date
                )
                VALUES ($1, $2, $3, 'Completed', CURRENT_TIMESTAMP)
                RETURNING *`,
                [
                    repairId,
                    amountCents / 100,
                    method.trim()
                ]
            );

            await client.query("COMMIT");
            transactionStarted = false;

            return res.status(201).json({
                message: "Payment recorded successfully.",
                payment: result.rows[0],
                remaining_balance:
                    (remainingCents - amountCents) / 100
            });

        } catch (error) {
            if (transactionStarted) {
                await client.query("ROLLBACK");
            }

            console.error("Record payment error:", error);

            return res.status(500).json({
                message: "Unable to record payment."
            });

        } finally {
            client.release();
        }
    }
);

// =====================================
// PAYMONGO TEST CHECKOUT
// =====================================

router.post(
    "/:repairId/checkout",
    authenticateToken,
    async (req, res) => {
        try {
            const repairId = Number(req.params.repairId);

            if (!validId(repairId)) {
                return res.status(400).json({
                    message: "Invalid repair ID."
                });
            }

            // Test mode only.
            const secretKey = process.env.PAYMONGO_SECRET_KEY;

            if (
                process.env.PAYMONGO_MODE !== "test" ||
                !secretKey ||
                !secretKey.startsWith("sk_test_")
            ) {
                return res.status(503).json({
                    message: "PayMongo Test Mode is not configured."
                });
            }

            // Check repair ownership.
            const access = await getRepairAccess(
                repairId,
                req.user
            );

            if (!access.exists) {
                return res.status(404).json({
                    message: "Repair not found."
                });
            }

            if (!access.allowed) {
                return res.status(403).json({
                    message: "Access denied."
                });
            }

            // Calculate outstanding balance.
            const totalCents = await getRepairTotal(
                repairId
            );

            const paidCents = await getTotalPaid(
                repairId
            );

            const remainingCents = Math.max(
                0,
                totalCents - paidCents
            );

            if (remainingCents <= 0) {
                return res.status(400).json({
                    message: "This repair has no outstanding balance."
                });
            }

            // Temporary local URLs.
            // Replace with FixTrack result pages later.
            const successUrl = "http://localhost:5500";
            const cancelUrl = "http://localhost:5500";

            // Generate a unique reference.
            const referenceNumber =
                `FIXTRACK-${repairId}-${Date.now()}`;

            // Create checkout session.
            const checkoutResponse = await fetch(
                "https://api.paymongo.com/v1/checkout_sessions",
                {
                    method: "POST",
                    headers: {
                        Authorization:
                            "Basic " +
                            Buffer.from(
                                `${secretKey}:`
                            ).toString("base64"),
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({
                        data: {
                            attributes: {
                                description:
                                    `FixTrack Repair #${repairId}`,
                                line_items: [
                                    {
                                        currency: "PHP",
                                        amount: remainingCents,
                                        name:
                                            `FixTrack Repair #${repairId}`,
                                        quantity: 1
                                    }
                                ],
                                payment_method_types: [
                                    "gcash",
                                    "card"
                                ],
                                success_url: successUrl,
                                cancel_url: cancelUrl,
                                reference_number: referenceNumber,
                                send_email_receipt: false,
                                show_description: true,
                                show_line_items: true
                            }
                        }
                    })
                }
            );

            const checkoutData =
                await checkoutResponse.json().catch(() => ({}));

            if (!checkoutResponse.ok) {
                console.error(
                    "PayMongo checkout error:",
                    checkoutResponse.status,
                    checkoutData.errors?.map(error => ({
                        code: error.code,
                        detail: error.detail
                    }))
                );

                return res.status(502).json({
                    message:
                        "PayMongo could not create the checkout session."
                });
            }

            const session = checkoutData.data;

            if (
                !session?.id ||
                !session?.attributes?.checkout_url
            ) {
                return res.status(502).json({
                    message:
                        "PayMongo returned an invalid checkout session."
                });
            }

            // Do not record a completed payment here.
            // A checkout session is NOT proof of payment.
            return res.status(201).json({
                message: "PayMongo test checkout created.",
                checkout_session_id: session.id,
                checkout_url:
                    session.attributes.checkout_url,
                reference_number: referenceNumber,
                amount: remainingCents / 100,
                mode: "test"
            });

        } catch (error) {
            console.error(
                "Create PayMongo checkout error:",
                error
            );

            return res.status(500).json({
                message: "Unable to create PayMongo checkout."
            });
        }
    }
);

module.exports = router;
