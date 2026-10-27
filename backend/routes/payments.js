
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

function validReason(value) {
    return typeof value === "string" &&
        value.trim().length >= 5 &&
        value.trim().length <= 1000;
}

function validManualMethod(value) {
    return typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= 100 &&
        !/paymongo/i.test(value);
}

function money(cents) {
    return cents / 100;
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

function getPaymentStatus(totalCents, paidCents) {
    if (totalCents <= 0) {
        return paidCents > 0
            ? "Overpaid"
            : "Unpaid";
    }

    if (paidCents <= 0) {
        return "Unpaid";
    }

    if (paidCents < totalCents) {
        return "Partially Paid";
    }

    if (paidCents === totalCents) {
        return "Paid";
    }

    return "Overpaid";
}

// =====================================
// GET PAYMENT HISTORY AND BALANCE
// =====================================

router.get(
    "/:repairId",
    authenticateToken,
    async (req, res) => {
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
                    p.payment_id,
                    p.repair_id,
                    p.amount_paid,
                    p.payment_method,
                    p.payment_status,
                    p.payment_date,
                    p.created_at,
                    EXISTS (
                        SELECT 1
                        FROM paymongo_transactions pt
                        WHERE pt.payment_id = p.payment_id
                    ) AS is_paymongo
                 FROM payments p
                 WHERE p.repair_id = $1
                 ORDER BY p.payment_id DESC`,
                [repairId]
            );

            return res.json({
                repair_id: repairId,
                total_amount: money(totalCents),
                total_paid: money(paidCents),
                remaining_balance: money(balanceCents),
                payment_status: getPaymentStatus(
                    totalCents,
                    paidCents
                ),
                payments: paymentsResult.rows
            });

        } catch (error) {
            console.error("Get payments error:", error);

            return res.status(500).json({
                message: "Unable to load payment information."
            });
        }
    }
);

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
            !validManualMethod(method)
        ) {
            return res.status(400).json({
                message: "Enter a valid payment amount and method."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const repairResult = await client.query(
                `SELECT repair_id
                 FROM repair_requests
                 WHERE repair_id = $1
                 FOR UPDATE`,
                [repairId]
            );

            if (repairResult.rows.length === 0) {
                await client.query("ROLLBACK");

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

            if (remainingCents <= 0) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "This repair has no outstanding balance."
                });
            }

            if (amountCents > remainingCents) {
                await client.query("ROLLBACK");

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
                VALUES (
                    $1, $2, $3, 'Completed', CURRENT_TIMESTAMP
                )
                RETURNING *`,
                [
                    repairId,
                    money(amountCents),
                    method.trim()
                ]
            );

            await client.query("COMMIT");

            return res.status(201).json({
                message: "Payment recorded successfully.",
                payment: result.rows[0],
                remaining_balance: money(
                    remainingCents - amountCents
                )
            });

        } catch (error) {
            await client.query("ROLLBACK");

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
// PAYMENT CORRECTION HELPER
// ADMIN ONLY
// =====================================

async function correctPayment(req, res, action) {
    const paymentId = Number(req.params.paymentId);
    const adminId = Number(req.user.user_id);
    const reason = req.body?.reason;

    if (!validId(paymentId) || !validId(adminId)) {
        return res.status(400).json({
            message: "Invalid payment or administrator ID."
        });
    }

    if (!validReason(reason)) {
        return res.status(400).json({
            message: "A reason of 5 to 1000 characters is required."
        });
    }

    let newAmountCents = null;
    let newMethod = null;

    if (action === "EDIT") {
        newAmountCents = toCents(req.body?.amount_paid);
        newMethod = req.body?.payment_method;

        if (
            newAmountCents === null ||
            newAmountCents <= 0 ||
            !validManualMethod(newMethod)
        ) {
            return res.status(400).json({
                message: "Enter a valid amount and manual payment method."
            });
        }

        newMethod = newMethod.trim();
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        // Find the repair associated with this payment.
        const lookup = await client.query(
            `SELECT repair_id
             FROM payments
             WHERE payment_id = $1`,
            [paymentId]
        );

        if (lookup.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                message: "Payment not found."
            });
        }

        const repairId = lookup.rows[0].repair_id;

        // Lock the repair before locking the payment.
        // This follows the same lock order used when
        // recording manual payments.
        await client.query(
            `SELECT repair_id
             FROM repair_requests
             WHERE repair_id = $1
             FOR UPDATE`,
            [repairId]
        );

        const paymentResult = await client.query(
            `SELECT *
             FROM payments
             WHERE payment_id = $1
             FOR UPDATE`,
            [paymentId]
        );

        const oldPayment = paymentResult.rows[0];

        if (!oldPayment) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                message: "Payment not found."
            });
        }

        if (
            Number(oldPayment.repair_id) !== Number(repairId)
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(409).json({
                message: "Payment changed. Please refresh."
            });
        }

        // Protect gateway-linked transactions.
        const gatewayResult = await client.query(
            `SELECT paymongo_id
             FROM paymongo_transactions
             WHERE payment_id = $1
             LIMIT 1`,
            [paymentId]
        );

        if (
            gatewayResult.rows.length > 0 ||
            /paymongo/i.test(oldPayment.payment_method || "")
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                message: "PayMongo-linked payments cannot be edited or voided here."
            });
        }

        // Prevent repeated voids and edits to voided payments.
        if (oldPayment.payment_status !== "Completed") {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(409).json({
                message: "Only completed manual payments can be corrected."
            });
        }

        const oldAmountCents = toCents(
            oldPayment.amount_paid
        );

        if (oldAmountCents === null) {
            throw new Error("Stored payment amount is invalid.");
        }

        if (action === "EDIT") {
            const repairTotalCents = await getRepairTotal(
                repairId,
                client
            );

            const totalPaidCents = await getTotalPaid(
                repairId,
                client
            );

            const otherPaymentsCents =
                totalPaidCents - oldAmountCents;

            // Prevent increasing payments beyond repair cost.
            // Existing historical overpayments can still be
            // reduced or voided.
            if (
                newAmountCents > oldAmountCents &&
                otherPaymentsCents + newAmountCents >
                    repairTotalCents
            ) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(400).json({
                    message: "Corrected amount exceeds the repair total."
                });
            }
        }

        let updatedPayment;

        if (action === "EDIT") {
            const result = await client.query(
                `UPDATE payments
                 SET amount_paid = $1,
                     payment_method = $2
                 WHERE payment_id = $3
                 RETURNING *`,
                [
                    money(newAmountCents),
                    newMethod,
                    paymentId
                ]
            );

            updatedPayment = result.rows[0];

        } else if (action === "VOID") {
            const result = await client.query(
                `UPDATE payments
                 SET payment_status = 'Voided'
                 WHERE payment_id = $1
                 RETURNING *`,
                [paymentId]
            );

            updatedPayment = result.rows[0];

        } else {
            throw new Error("Unsupported correction action.");
        }

        // Record the original and updated values.
        await client.query(
            `INSERT INTO payment_audit_logs (
                payment_id,
                admin_user_id,
                action,
                old_amount,
                new_amount,
                old_method,
                new_method,
                old_status,
                new_status,
                reason
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )`,
            [
                paymentId,
                adminId,
                action,
                oldPayment.amount_paid,
                updatedPayment.amount_paid,
                oldPayment.payment_method,
                updatedPayment.payment_method,
                oldPayment.payment_status,
                updatedPayment.payment_status,
                reason.trim()
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.json({
            message: action === "EDIT"
                ? "Payment corrected successfully."
                : "Payment voided successfully.",
            payment: updatedPayment
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Payment correction error:", error);

        return res.status(500).json({
            message: "Unable to update payment."
        });

    } finally {
        client.release();
    }
}

// =====================================
// EDIT MANUAL PAYMENT
// ADMIN ONLY
// =====================================

router.patch(
    "/transaction/:paymentId",
    authenticateToken,
    requireAdmin,
    (req, res) => correctPayment(req, res, "EDIT")
);

// =====================================
// VOID MANUAL PAYMENT
// ADMIN ONLY
// =====================================

router.post(
    "/transaction/:paymentId/void",
    authenticateToken,
    requireAdmin,
    (req, res) => correctPayment(req, res, "VOID")
);

// =====================================
// GET PAYMENT AUDIT HISTORY
// ADMIN ONLY
// =====================================

router.get(
    "/transaction/:paymentId/audit",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const paymentId = Number(req.params.paymentId);

            if (!validId(paymentId)) {
                return res.status(400).json({
                    message: "Invalid payment ID."
                });
            }

            const result = await pool.query(
                `SELECT
                    audit_id,
                    payment_id,
                    admin_user_id,
                    action,
                    old_amount,
                    new_amount,
                    old_method,
                    new_method,
                    old_status,
                    new_status,
                    reason,
                    created_at
                 FROM payment_audit_logs
                 WHERE payment_id = $1
                 ORDER BY created_at DESC, audit_id DESC`,
                [paymentId]
            );

            return res.json({
                payment_id: paymentId,
                audit_logs: result.rows
            });

        } catch (error) {
            console.error("Payment audit error:", error);

            return res.status(500).json({
                message: "Unable to load payment audit history."
            });
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

            const secretKey = process.env.PAYMONGO_SECRET_KEY;

            // Strictly test mode only.
            if (
                process.env.PAYMONGO_MODE !== "test" ||
                !secretKey ||
                !secretKey.startsWith("sk_test_")
            ) {
                return res.status(503).json({
                    message: "PayMongo Test Mode is not configured."
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

            // Use deployed frontend for checkout redirects.
            const frontendUrl = (
                process.env.FRONTEND_URL ||
                "https://fixtrack-management.vercel.app"
            ).replace(/\/+$/, "");

            const successUrl =
                `${frontendUrl}/admin-repairs.html`;

            const cancelUrl =
                `${frontendUrl}/admin-repairs.html`;

            const referenceNumber =
                `FIXTRACK-${repairId}-${Date.now()}`;

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
                    message: "PayMongo could not create the checkout session."
                });
            }

            const session = checkoutData.data;

            if (
                !session?.id ||
                !session?.attributes?.checkout_url
            ) {
                return res.status(502).json({
                    message: "PayMongo returned an invalid checkout session."
                });
            }

            // Do not record a completed payment here.
            // Checkout creation is not proof of payment.
            return res.status(201).json({
                message: "PayMongo test checkout created.",
                checkout_session_id: session.id,
                checkout_url:
                    session.attributes.checkout_url,
                reference_number: referenceNumber,
                amount: money(remainingCents),
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

// =====================================
// EXPORT ROUTER
// =====================================

module.exports = router;
