
const express = require("express");
const pool = require("../config/db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

const requireAdmin = requireRole("admin", "Administrator access only.");

router.use(authenticateToken, requireAdmin);

// =====================================
// VALIDATE PART INFORMATION
// =====================================

function validatePart(data) {
    const name = data.name;
    const description = data.description;
    const price = Number(data.unit_price);
    const quantity = Number(data.stock_quantity);

    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 255
    ) {
        return {
            error: "Part name is required."
        };
    }

    if (
        description != null &&
        typeof description !== "string" ||
        description.trim().length > 255
    ) {
        return {
            error: "Description must be text."
        };
    }

    if (
        data.unit_price === null ||
        data.unit_price === undefined ||
        data.unit_price === "" ||
        !Number.isFinite(price) ||
        price < 0
    ) {
        return {
            error: "Enter a valid price of zero or more."
        };
    }

    if (
        data.stock_quantity === null ||
        data.stock_quantity === undefined ||
        data.stock_quantity === "" ||
        !Number.isSafeInteger(quantity) ||
        quantity < 0
    ) {
        return {
            error: "Stock quantity must be a whole number of zero or more."
        };
    }

    return {
        value: {
            name: name.trim(),
            description:
                typeof description === "string"
                    ? description.trim() || null
                    : null,
            unit_price: price,
            stock_quantity: quantity
        }
    };
}

// =====================================
// GET ALL PARTS
// =====================================

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                part_id,
                part_name AS name,
                description,
                unit_price,
                stock_quantity
             FROM parts
             ORDER BY part_id DESC`
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get parts error:", error);

        res.status(500).json({
            message: "Unable to load parts."
        });
    }
});

// =====================================
// ADD NEW PART
// =====================================

router.post("/", async (req, res) => {
    try {
        const validation = validatePart(req.body || {});

        if (validation.error) {
            return res.status(400).json({
                message: validation.error
            });
        }

        const {
            name,
            description,
            unit_price,
            stock_quantity
        } = validation.value;

        const result = await pool.query(
            `INSERT INTO parts (
                part_name,
                description,
                unit_price,
                stock_quantity
             )
             VALUES ($1, $2, $3, $4)
             RETURNING
                part_id,
                part_name AS name,
                description,
                unit_price,
                stock_quantity`,
            [
                name,
                description,
                unit_price,
                stock_quantity
            ]
        );

        res.status(201).json({
            message: "Part added successfully.",
            part: result.rows[0]
        });

    } catch (error) {
        console.error("Add part error:", error);

        res.status(500).json({
            message: "Unable to add part."
        });
    }
});

// =====================================
// UPDATE PART
// =====================================

router.put("/:partId", async (req, res) => {
    try {
        const partId = Number(req.params.partId);

        if (
            !Number.isSafeInteger(partId) ||
            partId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid part ID."
            });
        }

        const validation = validatePart(req.body || {});

        if (validation.error) {
            return res.status(400).json({
                message: validation.error
            });
        }

        const {
            name,
            description,
            unit_price,
            stock_quantity
        } = validation.value;

        const result = await pool.query(
            `UPDATE parts
             SET
                part_name = $1,
                description = $2,
                unit_price = $3,
                stock_quantity = $4
             WHERE part_id = $5
             RETURNING
                part_id,
                part_name AS name,
                description,
                unit_price,
                stock_quantity`,
            [
                name,
                description,
                unit_price,
                stock_quantity,
                partId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Part not found."
            });
        }

        res.json({
            message: "Part updated successfully.",
            part: result.rows[0]
        });

    } catch (error) {
        console.error("Update part error:", error);

        res.status(500).json({
            message: "Unable to update part."
        });
    }
});

// =====================================
// DELETE PART
// =====================================

router.delete("/:partId", async (req, res) => {
    try {
        const partId = Number(req.params.partId);

        if (
            !Number.isSafeInteger(partId) ||
            partId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid part ID."
            });
        }

        const result = await pool.query(
            `DELETE FROM parts
             WHERE part_id = $1
             RETURNING part_id`,
            [partId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Part not found."
            });
        }

        res.json({
            message: "Part deleted successfully."
        });

    } catch (error) {
        console.error("Delete part error:", error);

        if (error.code === "23503") {
            return res.status(409).json({
                message:
                    "This part is already used in a repair and cannot be deleted."
            });
        }

        res.status(500).json({
            message: "Unable to delete part."
        });
    }
});

module.exports = router;
