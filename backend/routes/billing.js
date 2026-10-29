
const express = require("express");
const pool = require("../config/db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

const requireAdmin = requireRole("admin", "Administrator access only.");

// =====================================
// VALIDATION HELPERS
// =====================================

function validId(value) {
    const number = Number(value);

    return Number.isSafeInteger(number) && number > 0;
}

function validMoney(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0 &&
        Math.round(Number(value) * 100) ===
            Number(value) * 100
    );
}

// =====================================
// GET REPAIR BILL
// Admin or owner of the repair
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

            const repairResult = await pool.query(
                `SELECT
                    r.repair_id,
                    r.status,
                    d.user_id
                 FROM repair_requests r
                 JOIN devices d
                    ON r.device_id = d.device_id
                 WHERE r.repair_id = $1`,
                [repairId]
            );

            if (repairResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Repair not found."
                });
            }

            const repair = repairResult.rows[0];

            const isAdmin = req.user.role === "admin";
            const isOwner =
                req.user.role === "customer" &&
                Number(repair.user_id) ===
                    Number(req.user.user_id);

            if (!isAdmin && !isOwner) {
                return res.status(403).json({
                    message: "Access denied."
                });
            }

            const partsResult = await pool.query(
                `SELECT
                    rp.repair_part_id,
                    rp.part_id,
                    p.part_name,
                    rp.quantity,
                    rp.unit_price,
                    rp.quantity * rp.unit_price
                        AS line_total
                 FROM repair_parts rp
                 JOIN parts p
                    ON rp.part_id = p.part_id
                 WHERE rp.repair_id = $1
                 ORDER BY rp.repair_part_id`,
                [repairId]
            );

            const laborResult = await pool.query(
                `SELECT
                    labor_id,
                    description,
                    labor_cost
                 FROM labor_charges
                 WHERE repair_id = $1
                 ORDER BY labor_id`,
                [repairId]
            );

            const partsTotal = partsResult.rows.reduce(
                (total, part) =>
                    total + Number(part.line_total),
                0
            );

            const laborTotal = laborResult.rows.reduce(
                (total, labor) =>
                    total + Number(labor.labor_cost),
                0
            );

            res.json({
                repair_id: repairId,
                repair_status: repair.status,
                parts: partsResult.rows,
                labor: laborResult.rows,
                parts_total: Number(partsTotal.toFixed(2)),
                labor_total: Number(laborTotal.toFixed(2)),
                total_amount: Number(
                    (partsTotal + laborTotal).toFixed(2)
                )
            });

        } catch (error) {
            console.error("Get repair bill error:", error);

            res.status(500).json({
                message: "Unable to load repair bill."
            });
        }
    }
);

// =====================================
// ADD PART TO REPAIR
// Deduct inventory stock safely
// =====================================

router.post(
    "/:repairId/parts",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        const repairId = Number(req.params.repairId);
        const partId = Number(req.body?.part_id);
        const quantity = Number(req.body?.quantity);

        if (
            !validId(repairId) ||
            !validId(partId) ||
            !Number.isSafeInteger(quantity) ||
            quantity <= 0
        ) {
            return res.status(400).json({
                message:
                    "Provide a valid repair, part, and quantity."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const repairResult = await client.query(
                `SELECT repair_id, status
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

            if (repairResult.rows[0].status === "Released") {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    message:
                        "Cannot change billing for a released repair."
                });
            }

            const partResult = await client.query(
                `SELECT
                    part_id,
                    part_name,
                    unit_price,
                    stock_quantity
                 FROM parts
                 WHERE part_id = $1
                 FOR UPDATE`,
                [partId]
            );

            if (partResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: "Inventory part not found."
                });
            }

            const part = partResult.rows[0];

            if (part.stock_quantity < quantity) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message:
                        `Not enough stock. Available: ${part.stock_quantity}.`
                });
            }

            await client.query(
                `UPDATE parts
                 SET stock_quantity = stock_quantity - $1
                 WHERE part_id = $2`,
                [quantity, partId]
            );

            const result = await client.query(
                `INSERT INTO repair_parts (
                    repair_id,
                    part_id,
                    quantity,
                    unit_price
                 )
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [
                    repairId,
                    partId,
                    quantity,
                    part.unit_price
                ]
            );

            await client.query("COMMIT");

            res.status(201).json({
                message:
                    "Part added to repair and stock updated.",
                repair_part: result.rows[0]
            });

        } catch (error) {
            await client.query("ROLLBACK");

            console.error("Add repair part error:", error);

            res.status(500).json({
                message: "Unable to add part to repair."
            });

        } finally {
            client.release();
        }
    }
);

// =====================================
// REMOVE PART FROM REPAIR
// Restore inventory stock
// =====================================

router.delete(
    "/:repairId/parts/:repairPartId",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        const repairId = Number(req.params.repairId);
        const repairPartId = Number(req.params.repairPartId);

        if (!validId(repairId) || !validId(repairPartId)) {
            return res.status(400).json({
                message: "Invalid repair or part ID."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const repairResult = await client.query(
                `SELECT status
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

            if (repairResult.rows[0].status === "Released") {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    message:
                        "Cannot change billing for a released repair."
                });
            }

            const partResult = await client.query(
                `SELECT
                    repair_part_id,
                    part_id,
                    quantity
                 FROM repair_parts
                 WHERE repair_part_id = $1
                 AND repair_id = $2
                 FOR UPDATE`,
                [repairPartId, repairId]
            );

            if (partResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: "Repair part not found."
                });
            }

            const part = partResult.rows[0];

            await client.query(
                `UPDATE parts
                 SET stock_quantity =
                    stock_quantity + $1
                 WHERE part_id = $2`,
                [part.quantity, part.part_id]
            );

            await client.query(
                `DELETE FROM repair_parts
                 WHERE repair_part_id = $1`,
                [repairPartId]
            );

            await client.query("COMMIT");

            res.json({
                message:
                    "Part removed and inventory stock restored."
            });

        } catch (error) {
            await client.query("ROLLBACK");

            console.error("Remove repair part error:", error);

            res.status(500).json({
                message: "Unable to remove repair part."
            });

        } finally {
            client.release();
        }
    }
);

// =====================================
// ADD LABOR CHARGE
// =====================================

router.post(
    "/:repairId/labor",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const repairId = Number(req.params.repairId);
            const { description, labor_cost } = req.body || {};

            if (
                !validId(repairId) ||
                typeof description !== "string" ||
                !description.trim() ||
                !validMoney(labor_cost)
            ) {
                return res.status(400).json({
                    message:
                        "Enter a description and valid labor cost."
                });
            }

            const result = await pool.query(
                `INSERT INTO labor_charges (
                    repair_id,
                    description,
                    labor_cost
                 )
                 SELECT
                    repair_id,
                    $2,
                    $3
                 FROM repair_requests
                 WHERE repair_id = $1
                 AND status <> 'Released'
                 RETURNING *`,
                [
                    repairId,
                    description.trim(),
                    Number(labor_cost)
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Repair not found or already released."
                });
            }

            res.status(201).json({
                message: "Labor charge added successfully.",
                labor: result.rows[0]
            });

        } catch (error) {
            console.error("Add labor error:", error);

            res.status(500).json({
                message: "Unable to add labor charge."
            });
        }
    }
);

// =====================================
// REMOVE LABOR CHARGE
// =====================================

router.delete(
    "/:repairId/labor/:laborId",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const repairId = Number(req.params.repairId);
            const laborId = Number(req.params.laborId);

            if (!validId(repairId) || !validId(laborId)) {
                return res.status(400).json({
                    message: "Invalid repair or labor ID."
                });
            }

            const result = await pool.query(
                `DELETE FROM labor_charges
                 WHERE labor_id = $1
                 AND repair_id = $2
                 AND EXISTS (
                    SELECT 1
                    FROM repair_requests
                    WHERE repair_id = $2
                    AND status <> 'Released'
                 )
                 RETURNING labor_id`,
                [laborId, repairId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Labor charge not found or repair released."
                });
            }

            res.json({
                message: "Labor charge removed successfully."
            });

        } catch (error) {
            console.error("Remove labor error:", error);

            res.status(500).json({
                message: "Unable to remove labor charge."
            });
        }
    }
);

module.exports = router;
