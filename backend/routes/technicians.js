
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// ==================================
// AUTHENTICATE TOKEN
// ==================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Please log in first."
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

// ==================================
// ADMIN ONLY
// ==================================

function requireAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Administrator access only."
        });
    }

    next();
}

// ==================================
// TECHNICIAN ONLY
// ==================================

function requireTechnician(req, res, next) {
    if (req.user.role !== "technician") {
        return res.status(403).json({
            message: "Technician access only."
        });
    }

    next();
}

// ==================================
// GET ALL TECHNICIANS - ADMIN
// ==================================

router.get(
    "/",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    t.technician_id,
                    t.user_id,
                    u.first_name,
                    u.middle_name,
                    u.last_name,
                    u.email,
                    u.role,
                    u.created_at,
                    t.specialization,
                    t.hire_date,
                    t.status
                 FROM technicians t
                 INNER JOIN users u
                    ON t.user_id = u.user_id
                 WHERE u.role = 'technician'
                 ORDER BY u.created_at DESC`
            );

            res.json(result.rows);

        } catch (error) {
            console.error(
                "Get technicians error:",
                error
            );

            res.status(500).json({
                message: "Unable to load technicians."
            });
        }
    }
);

// ==================================
// CREATE TECHNICIAN - ADMIN
// ==================================

router.post(
    "/",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        let client;

        try {
            const {
                first_name,
                middle_name,
                last_name,
                email,
                password
            } = req.body || {};

            if (
                typeof first_name !== "string" ||
                !first_name.trim() ||
                typeof last_name !== "string" ||
                !last_name.trim() ||
                typeof email !== "string" ||
                !email.trim() ||
                typeof password !== "string" ||
                password.length < 8
            ) {
                return res.status(400).json({
                    message:
                        "First name, last name, email, and a password of at least 8 characters are required."
                });
            }

            const normalizedEmail =
                email.trim().toLowerCase();

            const passwordHash = await bcrypt.hash(
                password,
                10
            );

            client = await pool.connect();

            await client.query("BEGIN");

            // Create user account
            const userResult = await client.query(
                `INSERT INTO users (
                    first_name,
                    middle_name,
                    last_name,
                    email,
                    password_hash,
                    role
                )
                VALUES ($1, $2, $3, $4, $5, 'technician')
                RETURNING
                    user_id,
                    first_name,
                    middle_name,
                    last_name,
                    email,
                    role,
                    created_at`,
                [
                    first_name.trim(),
                    typeof middle_name === "string"
                        ? middle_name.trim() || null
                        : null,
                    last_name.trim(),
                    normalizedEmail,
                    passwordHash
                ]
            );

            const newUser = userResult.rows[0];

            // Create technician record
            const technicianResult = await client.query(
                `INSERT INTO technicians (
                    user_id,
                    specialization,
                    hire_date,
                    status
                )
                VALUES ($1, NULL, CURRENT_DATE, 'Active')
                RETURNING
                    technician_id,
                    user_id,
                    specialization,
                    hire_date,
                    status`,
                [newUser.user_id]
            );

            await client.query("COMMIT");

            res.status(201).json({
                message:
                    "Technician account created successfully.",
                technician: {
                    ...newUser,
                    ...technicianResult.rows[0]
                }
            });

        } catch (error) {
            if (client) {
                try {
                    await client.query("ROLLBACK");
                } catch (rollbackError) {
                    console.error(
                        "Rollback error:",
                        rollbackError
                    );
                }
            }

            console.error(
                "Create technician error:",
                error
            );

            if (error.code === "23505") {
                return res.status(409).json({
                    message:
                        "An account with this email already exists."
                });
            }

            res.status(500).json({
                message:
                    "Unable to create technician account."
            });

        } finally {
            if (client) {
                client.release();
            }
        }
    }
);

// ==================================
// GET MY DIAGNOSES - TECHNICIAN
// ==================================

router.get(
    "/diagnoses/mine",
    authenticateToken,
    requireTechnician,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    dg.diagnosis_id,
                    dg.repair_id,
                    dg.technician_id,
                    dg.diagnosis_details,
                    dg.recommended_action,
                    dg.date_diagnosed,
                    d.device_type,
                    d.brand,
                    d.model,
                    r.status
                 FROM diagnoses dg
                 INNER JOIN technicians t
                    ON dg.technician_id = t.technician_id
                 INNER JOIN repair_requests r
                    ON dg.repair_id = r.repair_id
                 INNER JOIN devices d
                    ON r.device_id = d.device_id
                 WHERE t.user_id = $1
                   AND r.technician_id = t.technician_id
                 ORDER BY dg.date_diagnosed DESC,
                          dg.diagnosis_id DESC`,
                [req.user.user_id]
            );

            res.json(result.rows);

        } catch (error) {
            console.error(
                "Get diagnoses error:",
                error
            );

            res.status(500).json({
                message: "Unable to load diagnoses."
            });
        }
    }
);

// ==================================
// SAVE DIAGNOSIS - TECHNICIAN
// ==================================

router.post(
    "/diagnoses",
    authenticateToken,
    requireTechnician,
    async (req, res) => {
        try {
            const {
                repair_id,
                diagnosis_details,
                recommended_action
            } = req.body || {};

            const repairId = Number(repair_id);

            if (
                !Number.isSafeInteger(repairId) ||
                repairId <= 0 ||
                typeof diagnosis_details !== "string" ||
                !diagnosis_details.trim()
            ) {
                return res.status(400).json({
                    message:
                        "Repair ID and diagnosis details are required."
                });
            }

            if (
                recommended_action !== undefined &&
                recommended_action !== null &&
                typeof recommended_action !== "string"
            ) {
                return res.status(400).json({
                    message: "Invalid recommended action."
                });
            }

            // Verify repair belongs to logged-in technician
            const assignedRepair = await pool.query(
                `SELECT
                    t.technician_id
                 FROM technicians t
                 INNER JOIN repair_requests r
                    ON r.technician_id = t.technician_id
                 WHERE t.user_id = $1
                   AND r.repair_id = $2`,
                [req.user.user_id, repairId]
            );

            if (assignedRepair.rows.length === 0) {
                return res.status(403).json({
                    message:
                        "This repair is not assigned to you."
                });
            }

            const technicianId =
                assignedRepair.rows[0].technician_id;

            // Save diagnosis
            const result = await pool.query(
                `INSERT INTO diagnoses (
                    repair_id,
                    technician_id,
                    diagnosis_details,
                    recommended_action,
                    date_diagnosed
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    CURRENT_TIMESTAMP
                )
                RETURNING *`,
                [
                    repairId,
                    technicianId,
                    diagnosis_details.trim(),
                    typeof recommended_action === "string"
                        ? recommended_action.trim() || null
                        : null
                ]
            );

            res.status(201).json({
                message: "Diagnosis saved successfully.",
                diagnosis: result.rows[0]
            });

        } catch (error) {
            console.error(
                "Save diagnosis error:",
                error
            );

            res.status(500).json({
                message: "Unable to save diagnosis."
            });
        }
    }
);

// ==================================
// EXPORT ROUTER
// ==================================

module.exports = router;
