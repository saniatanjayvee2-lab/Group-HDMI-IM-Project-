const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();


// =========================
// CHECK JWT TOKEN
// =========================

function authenticateToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({
            message: "Access denied. Please log in."
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Access denied. Invalid token."
        });
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (error, user) => {

            if (error) {
                return res.status(403).json({
                    message: "Invalid or expired login."
                });
            }

            req.user = user;

            next();
        }
    );
}


// =========================
// GET CUSTOMER DEVICES
// =========================

router.get("/", authenticateToken, async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT *
             FROM devices
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.user_id]
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get devices error:", error);

        res.status(500).json({
            message: "Unable to load devices."
        });
    }
});


// =========================
// ADD DEVICE
// =========================

router.post("/", authenticateToken, async (req, res) => {

    try {

        const {
            device_type,
            brand,
            model,
            serial_number,
            accessories_included
        } = req.body;


        // Required fields
        if (!device_type || !brand || !model) {

            return res.status(400).json({
                message:
                    "Device type, brand, and model are required."
            });
        }


        const result = await pool.query(
            `INSERT INTO devices
            (
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
                device_type.trim(),
                brand.trim(),
                model.trim(),
                serial_number
                    ? serial_number.trim()
                    : null,
                accessories_included
                    ? accessories_included.trim()
                    : null
            ]
        );


        res.status(201).json({
            message: "Device added successfully.",
            device: result.rows[0]
        });

    } catch (error) {

        console.error("Add device error:", error);

        res.status(500).json({
            message: "Unable to add device."
        });
    }
});


// =========================
// UPDATE DEVICE
// =========================

router.put(
    "/:deviceId",
    authenticateToken,
    async (req, res) => {

        try {

            const deviceId = req.params.deviceId;

            const {
                device_type,
                brand,
                model,
                serial_number,
                accessories_included
            } = req.body;


            // Required fields
            if (!device_type || !brand || !model) {

                return res.status(400).json({
                    message:
                        "Device type, brand, and model are required."
                });
            }


            const result = await pool.query(
                `UPDATE devices

                 SET
                    device_type = $1,
                    brand = $2,
                    model = $3,
                    serial_number = $4,
                    accessories_included = $5

                 WHERE device_id = $6
                 AND user_id = $7

                 RETURNING *`,
                [
                    device_type.trim(),
                    brand.trim(),
                    model.trim(),

                    serial_number
                        ? serial_number.trim()
                        : null,

                    accessories_included
                        ? accessories_included.trim()
                        : null,

                    deviceId,
                    req.user.user_id
                ]
            );


            // Device doesn't exist
            // OR belongs to another customer
            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Device not found or you do not have permission to edit it."
                });
            }


            res.json({
                message: "Device updated successfully.",
                device: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Update device error:",
                error
            );

            res.status(500).json({
                message: "Unable to update device."
            });
        }
    }
);


// =========================
// DELETE DEVICE
// =========================

router.delete(
    "/:deviceId",
    authenticateToken,
    async (req, res) => {

        try {

            const deviceId = req.params.deviceId;


            // Only delete if the device
            // belongs to the logged-in customer
            const result = await pool.query(
                `DELETE FROM devices

                 WHERE device_id = $1
                 AND user_id = $2

                 RETURNING *`,
                [
                    deviceId,
                    req.user.user_id
                ]
            );


            // Device doesn't exist
            // OR belongs to another customer
            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "Device not found or you do not have permission to remove it."
                });
            }


            res.json({
                message:
                    "Device removed successfully."
            });

        } catch (error) {

            console.error(
                "Delete device error:",
                error
            );

            res.status(500).json({
                message: "Unable to remove device."
            });
        }
    }
);


// =========================
// EXPORT ROUTER
// =========================

module.exports = router;