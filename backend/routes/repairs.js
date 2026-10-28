
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// =====================================
// AUTHENTICATE TOKEN
// =====================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

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

// =====================================
// GET ALL REPAIRS - ADMIN
// =====================================

router.get("/admin", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                message: "Administrator access only."
            });
        }

        const result = await pool.query(
            `SELECT
                r.repair_id,
                r.device_id,
                r.technician_id,
                r.problem_description,
                r.status,
                r.date_submitted,
                r.date_completed,
                d.device_type,
                d.brand,
                d.model,
                u.user_id,
                u.first_name,
                u.last_name,
                u.email
             FROM repair_requests r
             JOIN devices d ON r.device_id = d.device_id
             JOIN users u ON d.user_id = u.user_id
             ORDER BY r.date_submitted DESC, r.repair_id DESC`
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get admin repairs error:", error);

        res.status(500).json({
            message: "Unable to load customer repair requests."
        });
    }
});

// =====================================
// GET ASSIGNED REPAIRS - TECHNICIAN
// =====================================

router.get("/technician", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== "technician") {
            return res.status(403).json({
                message: "Technician access only."
            });
        }

        const result = await pool.query(
            `SELECT
                r.repair_id,
                r.device_id,
                r.technician_id,
                r.problem_description,
                r.status,
                r.date_submitted,
                r.date_completed,
                d.device_type,
                d.brand,
                d.model,
                u.first_name,
                u.last_name
             FROM repair_requests r
             JOIN devices d ON r.device_id = d.device_id
             JOIN users u ON d.user_id = u.user_id
             JOIN technicians t
                ON r.technician_id = t.technician_id
             WHERE t.user_id = $1
             ORDER BY r.date_submitted DESC, r.repair_id DESC`,
            [req.user.user_id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get technician repairs error:", error);

        res.status(500).json({
            message: "Unable to load assigned repairs."
        });
    }
});

// =====================================
// UPDATE STATUS - TECHNICIAN
// =====================================

router.put(
    "/technician/:repairId/status",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.role !== "technician") {
                return res.status(403).json({
                    message: "Technician access only."
                });
            }

            const repairId = Number(req.params.repairId);
            const { status } = req.body || {};

            if (
                !Number.isSafeInteger(repairId) ||
                repairId <= 0
            ) {
                return res.status(400).json({
                    message: "Invalid repair ID."
                });
            }

            const allowedStatuses = [
                "Pending",
                "In Progress",
                "Completed"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message: "Invalid repair status."
                });
            }

            const result = await pool.query(
                `UPDATE repair_requests r
                 SET
                    status = $1::VARCHAR,
                    date_completed = CASE
                        WHEN $1::VARCHAR = 'Completed'
                            THEN COALESCE(
                                r.date_completed,
                                CURRENT_TIMESTAMP
                            )
                        ELSE NULL
                    END,
                    updated_at = CURRENT_TIMESTAMP
                 FROM technicians t
                 WHERE
                    r.repair_id = $2
                    AND r.technician_id = t.technician_id
                    AND t.user_id = $3
                    AND r.status <> 'Released'
                 RETURNING r.*`,
                [status, repairId, req.user.user_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Assigned repair not found or already released."
                });
            }

            res.json({
                message: "Repair status updated successfully.",
                repair: result.rows[0]
            });

        } catch (error) {
            console.error(
                "Technician status update error:",
                error
            );

            res.status(500).json({
                message: "Unable to update repair status."
            });
        }
    }
);

// =====================================
// GET CUSTOMER REPAIRS WITH DIAGNOSIS
// =====================================

router.get("/", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== "customer") {
            return res.status(403).json({
                message: "Customer access only."
            });
        }

        const result = await pool.query(
            `SELECT
                r.repair_id,
                r.device_id,
                r.technician_id,
                r.problem_description,
                r.status,
                r.date_submitted,
                r.date_completed,

                d.device_type,
                d.brand,
                d.model,

                diagnosis.diagnosis_id,
                diagnosis.diagnosis_details,
                diagnosis.recommended_action,
                diagnosis.date_diagnosed,

                tech_user.first_name AS technician_first_name,
                tech_user.last_name AS technician_last_name

             FROM repair_requests r

             JOIN devices d
                ON r.device_id = d.device_id

             LEFT JOIN technicians t
                ON r.technician_id = t.technician_id

             LEFT JOIN users tech_user
                ON t.user_id = tech_user.user_id

             LEFT JOIN LATERAL (
                SELECT
                    dg.diagnosis_id,
                    dg.diagnosis_details,
                    dg.recommended_action,
                    dg.date_diagnosed
                FROM diagnoses dg
                WHERE dg.repair_id = r.repair_id
                ORDER BY
                    dg.date_diagnosed DESC NULLS LAST,
                    dg.diagnosis_id DESC
                LIMIT 1
             ) diagnosis ON TRUE

             WHERE d.user_id = $1

             ORDER BY
                r.date_submitted DESC,
                r.repair_id DESC`,
            [req.user.user_id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(
            "Get customer repairs with diagnosis error:",
            error
        );

        res.status(500).json({
            message:
                "Unable to load repair requests and diagnosis."
        });
    }
});

// =====================================
// CREATE CUSTOMER REPAIR
// =====================================

router.post("/", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== "customer") {
            return res.status(403).json({
                message: "Customer access only."
            });
        }

        const {
            device_id,
            problem_description
        } = req.body || {};

        const deviceId = Number(device_id);

        if (
            !Number.isSafeInteger(deviceId) ||
            deviceId <= 0 ||
            typeof problem_description !== "string" ||
            !problem_description.trim()
        ) {
            return res.status(400).json({
                message:
                    "Select a device and describe the problem."
            });
        }

        const deviceResult = await pool.query(
            `SELECT device_id
             FROM devices
             WHERE device_id = $1
             AND user_id = $2`,
            [deviceId, req.user.user_id]
        );

        if (deviceResult.rows.length === 0) {
            return res.status(404).json({
                message:
                    "Device not found in your account."
            });
        }

        const result = await pool.query(
            `INSERT INTO repair_requests (
                device_id,
                problem_description,
                status
             )
             VALUES ($1, $2, 'Pending')
             RETURNING *`,
            [
                deviceId,
                problem_description.trim()
            ]
        );

        res.status(201).json({
            message:
                "Repair request submitted successfully.",
            repair: result.rows[0]
        });

    } catch (error) {
        console.error("Create repair error:", error);

        res.status(500).json({
            message: "Unable to submit repair request."
        });
    }
});

// =====================================
// UPDATE REPAIR - ADMIN
// =====================================

router.put(
    "/admin/:repairId",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({
                    message: "Administrator access only."
                });
            }

            const repairId = Number(req.params.repairId);

            const {
                technician_id,
                status
            } = req.body || {};

            const allowedStatuses = [
                "Pending",
                "In Progress",
                "Completed",
                "Released"
            ];

            if (
                !Number.isSafeInteger(repairId) ||
                repairId <= 0
            ) {
                return res.status(400).json({
                    message: "Invalid repair ID."
                });
            }

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message: "Invalid repair status."
                });
            }

            let technicianId = null;

            if (
                technician_id !== null &&
                technician_id !== undefined &&
                technician_id !== ""
            ) {
                technicianId = Number(technician_id);

                if (
                    !Number.isSafeInteger(technicianId) ||
                    technicianId <= 0
                ) {
                    return res.status(400).json({
                        message: "Invalid technician ID."
                    });
                }

                const technicianResult = await pool.query(
                    `SELECT technician_id
                     FROM technicians
                     WHERE technician_id = $1`,
                    [technicianId]
                );

                if (technicianResult.rows.length === 0) {
                    return res.status(404).json({
                        message: "Technician not found or inactive. Select an active technician."
                    });
                }
            }

            const result = await pool.query(
                `UPDATE repair_requests
                 SET
                    technician_id = $1,
                    status = $2::VARCHAR,

                    date_completed = CASE
                        WHEN $2::VARCHAR IN (
                            'Completed',
                            'Released'
                        )
                        THEN COALESCE(
                            date_completed,
                            CURRENT_TIMESTAMP
                        )
                        ELSE NULL
                    END,

                    updated_at = CURRENT_TIMESTAMP

                 WHERE repair_id = $3

                 RETURNING *`,
                [
                    technicianId,
                    status,
                    repairId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Repair request not found."
                });
            }

            res.json({
                message:
                    "Repair request updated successfully.",
                repair: result.rows[0]
            });

        } catch (error) {
            console.error("Update repair error:", error);

            res.status(500).json({
                message: "Unable to update repair request."
            });
        }
    }
);

module.exports = router;
