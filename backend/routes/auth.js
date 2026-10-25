const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();


// =========================
// REGISTER CUSTOMER
// =========================

router.post("/register", async (req, res) => {
    try {
        const {
            first_name,
            middle_name,
            last_name,
            email,
            password
        } = req.body;

        // Check required fields
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({
                message: "Please fill in all required fields."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if email already exists
        const existingUser = await pool.query(
            `SELECT user_id
             FROM users
             WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email is already registered."
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(
            password,
            10
        );

        // Create customer
        const result = await pool.query(
            `INSERT INTO users
            (
                first_name,
                middle_name,
                last_name,
                email,
                password_hash,
                role
            )
            VALUES ($1, $2, $3, $4, $5, $6)
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
                middle_name
                    ? middle_name.trim()
                    : null,
                last_name.trim(),
                normalizedEmail,
                passwordHash,
                "customer"
            ]
        );

        res.status(201).json({
            message:
                "Customer account created successfully.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Registration error:",
            error
        );

        res.status(500).json({
            message:
                "Server error while creating account."
        });
    }
});


// =========================
// LOGIN
// =========================

router.post("/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                message:
                    "Email and password are required."
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        // Find user
        const result = await pool.query(
            `SELECT *
             FROM users
             WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message:
                    "Invalid email or password."
            });
        }

        const user = result.rows[0];

        // Check password
        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password_hash
            );

        if (!passwordMatches) {
            return res.status(401).json({
                message:
                    "Invalid email or password."
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.json({
            message: "Login successful.",

            token: token,

            user: {
                user_id: user.user_id,
                first_name: user.first_name,
                middle_name: user.middle_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error(
            "Login error:",
            error
        );

        res.status(500).json({
            message:
                "Server error while logging in."
        });
    }
});


// =========================
// FIRST ADMIN SETUP
// =========================

router.post("/setup-admin", async (req, res) => {
    try {
        const {
            first_name,
            middle_name,
            last_name,
            email,
            password
        } = req.body;

        // Check required fields
        if (
            !first_name ||
            !last_name ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                message:
                    "First name, last name, email, and password are required."
            });
        }

        // Check if an admin already exists
        const existingAdmin = await pool.query(
            `SELECT user_id
             FROM users
             WHERE role = $1
             LIMIT 1`,
            ["admin"]
        );

        if (existingAdmin.rows.length > 0) {
            return res.status(403).json({
                message:
                    "Administrator setup has already been completed."
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        // Check if email already belongs to another account
        const existingUser = await pool.query(
            `SELECT user_id
             FROM users
             WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message:
                    "An account with this email already exists."
            });
        }

        // Hash admin password
        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );

        // Create first administrator
        const result = await pool.query(
            `INSERT INTO users
            (
                first_name,
                middle_name,
                last_name,
                email,
                password_hash,
                role
            )
            VALUES ($1, $2, $3, $4, $5, $6)
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

                middle_name
                    ? middle_name.trim()
                    : null,

                last_name.trim(),

                normalizedEmail,

                passwordHash,

                "admin"
            ]
        );

        res.status(201).json({
            message:
                "Administrator account created successfully.",

            user: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Admin setup error:",
            error
        );

        res.status(500).json({
            message:
                "Unable to create administrator account."
        });
    }
});

// =========================
// CHECK ADMIN SETUP STATUS
// =========================

router.get("/setup-status", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id
             FROM users
             WHERE role = $1
             LIMIT 1`,
            ["admin"]
        );

        res.json({
            adminExists: result.rows.length > 0
        });

    } catch (error) {
        console.error(
            "Setup status error:",
            error
        );

        res.status(500).json({
            message: "Unable to check setup status."
        });
    }
});

module.exports = router;