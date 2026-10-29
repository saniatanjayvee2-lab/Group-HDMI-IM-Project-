const express = require("express");
const pool = require("../config/db");
const {
    authenticateToken,
    requireRole
} = require("../middleware/auth");

const router = express.Router();

router.use(
    authenticateToken,
    requireRole("customer", "Customer access only.")
);

function validateDevice(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Invalid device information." };
    }

    const required = {};
    for (const field of ["device_type", "brand", "model"]) {
        const value = body[field];
        if (
            typeof value !== "string" ||
            !value.trim() ||
            value.trim().length > 100
        ) {
            return {
                error: "Device type, brand, and model are required and must be 100 characters or fewer."
            };
        }
        required[field] = value.trim();
    }

    const optional = {};
    for (const [field, max] of [
        ["serial_number", 100],
        ["accessories_included", 10000]
    ]) {
        const value = body[field];
        if (value == null || value === "") {
            optional[field] = null;
            continue;
        }
        if (typeof value !== "string" || value.trim().length > max) {
            return {
                error: `${field === "serial_number" ? "Serial number" : "Accessories"} must be text of ${max} characters or fewer.`
            };
        }
        optional[field] = value.trim() || null;
    }

    return { value: { ...required, ...optional } };
}

function validDeviceId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
}

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM devices
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.user_id]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error("Get devices error:", error);
        return res.status(500).json({
            message: "Unable to load devices."
        });
    }
});

router.post("/", async (req, res) => {
    const validation = validateDevice(req.body);
    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    const device = validation.value;

    try {
        const result = await pool.query(
            `INSERT INTO devices (
                user_id,
                device_type,
                brand,
                model,
                serial_number,
                accessories_included
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user.user_id,
                device.device_type,
                device.brand,
                device.model,
                device.serial_number,
                device.accessories_included
            ]
        );

        return res.status(201).json({
            message: "Device added successfully.",
            device: result.rows[0]
        });
    } catch (error) {
        console.error("Add device error:", error);
        return res.status(500).json({
            message: "Unable to add device."
        });
    }
});

router.put("/:deviceId", async (req, res) => {
    if (!validDeviceId(req.params.deviceId)) {
        return res.status(400).json({ message: "Invalid device ID." });
    }

    const validation = validateDevice(req.body);
    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    const device = validation.value;

    try {
        const result = await pool.query(
            `UPDATE devices
             SET device_type = $1,
                 brand = $2,
                 model = $3,
                 serial_number = $4,
                 accessories_included = $5
             WHERE device_id = $6
               AND user_id = $7
             RETURNING *`,
            [
                device.device_type,
                device.brand,
                device.model,
                device.serial_number,
                device.accessories_included,
                req.params.deviceId,
                req.user.user_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message:
                    "Device not found or you do not have permission to edit it."
            });
        }

        return res.json({
            message: "Device updated successfully.",
            device: result.rows[0]
        });
    } catch (error) {
        console.error("Update device error:", error);
        return res.status(500).json({
            message: "Unable to update device."
        });
    }
});

router.delete("/:deviceId", async (req, res) => {
    if (!validDeviceId(req.params.deviceId)) {
        return res.status(400).json({ message: "Invalid device ID." });
    }

    try {
        const result = await pool.query(
            `DELETE FROM devices
             WHERE device_id = $1
               AND user_id = $2
             RETURNING device_id`,
            [req.params.deviceId, req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message:
                    "Device not found or you do not have permission to remove it."
            });
        }

        return res.json({
            message: "Device removed successfully."
        });
    } catch (error) {
        console.error("Delete device error:", error);
        return res.status(500).json({
            message: "Unable to remove device."
        });
    }
});

module.exports = router;
