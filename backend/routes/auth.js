const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
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
            first_name.trim().length > 100 ||
            typeof last_name !== "string" ||
            !last_name.trim() ||
            last_name.trim().length > 100 ||
            typeof email !== "string" ||
            email.trim().length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                message:
                    "First name, last name, valid email, and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        client = await pool.connect();
        await client.query("BEGIN");

        // Serialize first-admin setup so concurrent requests cannot
        // both pass the no-admin check.
        await client.query(
            "SELECT pg_advisory_xact_lock($1)",
            [827421]
        );

        const existingAdmin = await client.query(
            `SELECT user_id
             FROM users
             WHERE role = 'admin'
             LIMIT 1`
        );

        if (existingAdmin.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message:
                    "Administrator setup has already been completed."
            });
        }

        const existingUser = await client.query(
            `SELECT user_id
             FROM users
             WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message:
                    "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await client.query(
            `INSERT INTO users
            (
                first_name,
                middle_name,
                last_name,
                email,
                password_hash,
                role
            )
            VALUES ($1, $2, $3, $4, $5, 'admin')
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

        await client.query("COMMIT");

        res.status(201).json({
            message:
                "Administrator account created successfully.",
            user: result.rows[0]
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "An account with this email already exists."
            });
        }

        console.error("Admin setup error:", error);
        res.status(500).json({
            message: "Unable to create administrator account."
        });

    } finally {
        if (client) client.release();
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

// =========================
// FORGOT / RESET PASSWORD
// Customers and admins only. Technician passwords are reset by the admin.
// =========================

let resetTableReady = false;

async function ensureResetTable() {
    if (resetTableReady) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS password_resets (
            reset_id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    resetTableReady = true;
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail(to, link) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error("SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS).");
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    await transporter.sendMail({
        from: MAIL_FROM || SMTP_USER,
        to,
        subject: "FixTrack password reset",
        text:
            "We received a request to reset your FixTrack password.\n\n" +
            `Open this link within 30 minutes:\n${link}\n\n` +
            "If you did not ask for this, you can ignore this email."
    });
}

const GENERIC_FORGOT_MESSAGE =
    "If that email belongs to a customer or admin account, a reset link has been sent.";

router.post("/forgot-password", async (req, res) => {
    try {
        const email = typeof req.body?.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";

        if (email) {
            await ensureResetTable();

            const found = await pool.query(
                `SELECT user_id, role FROM users WHERE LOWER(email) = $1`,
                [email]
            );
            const user = found.rows[0];

            if (user && ["customer", "admin"].includes(user.role)) {
                const recent = await pool.query(
                    `SELECT 1 FROM password_resets
                     WHERE user_id = $1
                       AND created_at > NOW() - INTERVAL '60 seconds'`,
                    [user.user_id]
                );

                if (recent.rows.length === 0) {
                    const token = crypto.randomBytes(32).toString("hex");

                    await pool.query(
                        `UPDATE password_resets SET used = TRUE
                         WHERE user_id = $1 AND used = FALSE`,
                        [user.user_id]
                    );
                    await pool.query(
                        `INSERT INTO password_resets (user_id, token_hash, expires_at)
                         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
                        [user.user_id, hashToken(token)]
                    );

                    const base = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
                    await sendResetEmail(email, `${base}/index.html?reset=${token}`);
                }
            }
        }
    } catch (error) {
        // Never reveal whether the account exists or whether mail failed
        console.error("Forgot password error:", error.message);
    }

    res.json({ message: GENERIC_FORGOT_MESSAGE });
});

router.post("/reset-password", async (req, res) => {
    try {
        const { token, password } = req.body || {};

        if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
            return res.status(400).json({ message: "This reset link is invalid." });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters."
            });
        }

        await ensureResetTable();

        const found = await pool.query(
            `SELECT pr.reset_id, pr.user_id, u.role
             FROM password_resets pr
             INNER JOIN users u ON u.user_id = pr.user_id
             WHERE pr.token_hash = $1
               AND pr.used = FALSE
               AND pr.expires_at > NOW()`,
            [hashToken(token)]
        );
        const reset = found.rows[0];

        if (!reset || !["customer", "admin"].includes(reset.role)) {
            return res.status(400).json({
                message: "This reset link is invalid or has expired."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
            [passwordHash, reset.user_id]
        );
        await pool.query(
            `UPDATE password_resets SET used = TRUE WHERE user_id = $1`,
            [reset.user_id]
        );

        res.json({ message: "Password updated. You can now log in." });

    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: "Unable to reset password." });
    }
});

module.exports = router;