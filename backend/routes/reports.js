"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// =====================================
// ADMIN AUTHENTICATION
// =====================================

async function requireAdmin(req, res, next) {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured.");

        return res.status(500).json({
            message: "Server authentication is not configured."
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Support the existing FixTrack JWT user ID.
        const userId = Number(
            decoded.user_id ?? decoded.userId
        );

        if (
            !Number.isSafeInteger(userId) ||
            userId <= 0
        ) {
            return res.status(401).json({
                message: "Invalid authentication token."
            });
        }

        // Check the CURRENT database role.
        // Do not trust a role stored in the browser.
        const result = await pool.query(
            `SELECT user_id, role
             FROM users
             WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "User account not found."
            });
        }

        if (result.rows[0].role !== "admin") {
            return res.status(403).json({
                message: "Admin access required."
            });
        }

        req.adminId = userId;
        next();

    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token."
            });
        }

        console.error(
            "Reports authentication error:",
            error
        );

        return res.status(500).json({
            message: "Unable to verify admin access."
        });
    }
}

// All report endpoints require admin access.
router.use(requireAdmin);

// =====================================
// ERROR HANDLER
// =====================================

function handleError(res, error) {
    console.error("Reports API error:", error);

    return res.status(500).json({
        message: "Unable to load reports."
    });
}

// =====================================
// REPORT QUERIES
// =====================================

async function getSummary() {
    const result = await pool.query(`
        SELECT
            (
                SELECT COUNT(*)
                FROM repair_requests
            )::int AS total_repairs,

            (
                SELECT COUNT(*)
                FROM repair_requests
                WHERE LOWER(status) = 'completed'
            )::int AS completed_repairs,

            (
                SELECT COUNT(*)
                FROM repair_requests
                WHERE LOWER(status) NOT IN (
                    'completed',
                    'cancelled',
                    'canceled'
                )
            )::int AS open_repairs,

            (
                SELECT COUNT(*)
                FROM users
                WHERE LOWER(role) = 'customer'
            )::int AS total_customers,

            (
                SELECT COUNT(*)
                FROM technicians
                WHERE LOWER(status) = 'active'
            )::int AS active_technicians,

            (
                SELECT COUNT(*)
                FROM devices
            )::int AS registered_devices,

            (
                SELECT COUNT(*)
                FROM parts
            )::int AS total_part_types,

            (
                SELECT COUNT(*)
                FROM parts
                WHERE stock_quantity <= 5
            )::int AS low_stock_parts,

            (
                SELECT COALESCE(
                    SUM(amount_paid),
                    0
                )
                FROM payments
                WHERE LOWER(payment_status) = 'completed'
            ) AS total_revenue,

            (
                SELECT COUNT(*)
                FROM payments
                WHERE LOWER(payment_status) = 'completed'
            )::int AS completed_payments,

            (
                SELECT COUNT(*)
                FROM payments
                WHERE LOWER(payment_status) = 'voided'
            )::int AS voided_payments
    `);

    return result.rows[0];
}

async function getRepairStatuses() {
    const result = await pool.query(`
        SELECT
            COALESCE(status, 'Unknown') AS status,
            COUNT(*)::int AS total
        FROM repair_requests
        GROUP BY status
        ORDER BY total DESC, status
    `);

    return result.rows;
}

async function getMonthlyRepairs() {
    const result = await pool.query(`
        SELECT
            TO_CHAR(
                DATE_TRUNC('month', date_submitted),
                'YYYY-MM'
            ) AS month,

            COUNT(*)::int AS total,

            COUNT(*) FILTER (
                WHERE LOWER(status) = 'completed'
            )::int AS completed

        FROM repair_requests
        WHERE date_submitted IS NOT NULL

        GROUP BY DATE_TRUNC(
            'month',
            date_submitted
        )

        ORDER BY DATE_TRUNC(
            'month',
            date_submitted
        ) DESC

        LIMIT 12
    `);

    return result.rows.reverse();
}

async function getPaymentStatuses() {
    const result = await pool.query(`
        SELECT
            COALESCE(
                payment_status,
                'Unknown'
            ) AS status,

            COUNT(*)::int AS total,

            COALESCE(
                SUM(amount_paid),
                0
            ) AS recorded_amount

        FROM payments

        GROUP BY payment_status

        ORDER BY total DESC, status
    `);

    return result.rows;
}

async function getMonthlyRevenue() {
    const result = await pool.query(`
        SELECT
            TO_CHAR(
                DATE_TRUNC(
                    'month',
                    COALESCE(payment_date, created_at)
                ),
                'YYYY-MM'
            ) AS month,

            COUNT(*)::int AS payments,

            COALESCE(
                SUM(amount_paid),
                0
            ) AS revenue

        FROM payments

        WHERE LOWER(payment_status) = 'completed'
          AND COALESCE(payment_date, created_at)
              IS NOT NULL

        GROUP BY DATE_TRUNC(
            'month',
            COALESCE(payment_date, created_at)
        )

        ORDER BY DATE_TRUNC(
            'month',
            COALESCE(payment_date, created_at)
        ) DESC

        LIMIT 12
    `);

    return result.rows.reverse();
}

async function getCustomerStatistics() {
    const result = await pool.query(`
        SELECT
            u.user_id,

            CONCAT_WS(
                ' ',
                u.first_name,
                NULLIF(u.middle_name, ''),
                u.last_name
            ) AS customer_name,

            u.email,

            COUNT(
                DISTINCT d.device_id
            )::int AS total_devices,

            COUNT(
                DISTINCT r.repair_id
            )::int AS total_repairs

        FROM users u

        LEFT JOIN devices d
            ON d.user_id = u.user_id

        LEFT JOIN repair_requests r
            ON r.device_id = d.device_id

        WHERE LOWER(u.role) = 'customer'

        GROUP BY
            u.user_id,
            u.first_name,
            u.middle_name,
            u.last_name,
            u.email

        ORDER BY total_repairs DESC, customer_name

        LIMIT 100
    `);

    return result.rows;
}

async function getInventoryStatistics() {
    const result = await pool.query(`
        SELECT
            p.part_id,
            p.part_name,
            p.description,
            p.unit_price,
            p.stock_quantity,

            (
                p.unit_price * p.stock_quantity
            ) AS stock_value,

            COALESCE(
                SUM(rp.quantity),
                0
            )::int AS units_used,

            CASE
                WHEN p.stock_quantity = 0
                    THEN 'Out of Stock'
                WHEN p.stock_quantity <= 5
                    THEN 'Low Stock'
                ELSE 'In Stock'
            END AS stock_status

        FROM parts p

        LEFT JOIN repair_parts rp
            ON rp.part_id = p.part_id

        GROUP BY
            p.part_id,
            p.part_name,
            p.description,
            p.unit_price,
            p.stock_quantity

        ORDER BY
            p.stock_quantity ASC,
            p.part_name ASC
    `);

    return result.rows;
}

async function getTechnicianStatistics() {
    const result = await pool.query(`
        SELECT
            t.technician_id,

            CONCAT_WS(
                ' ',
                u.first_name,
                NULLIF(u.middle_name, ''),
                u.last_name
            ) AS technician_name,

            t.specialization,
            t.status,

            COUNT(
                DISTINCT r.repair_id
            )::int AS assigned_repairs,

            COUNT(
                DISTINCT r.repair_id
            ) FILTER (
                WHERE LOWER(r.status) = 'completed'
            )::int AS completed_repairs,

            COUNT(
                DISTINCT r.repair_id
            ) FILTER (
                WHERE LOWER(r.status) NOT IN (
                    'completed',
                    'cancelled',
                    'canceled'
                )
            )::int AS open_repairs

        FROM technicians t

        JOIN users u
            ON u.user_id = t.user_id

        LEFT JOIN repair_requests r
            ON r.technician_id = t.technician_id

        GROUP BY
            t.technician_id,
            u.first_name,
            u.middle_name,
            u.last_name,
            t.specialization,
            t.status

        ORDER BY
            completed_repairs DESC,
            technician_name ASC
    `);

    return result.rows;
}

async function getLaborStatistics() {
    const result = await pool.query(`
        SELECT
            COUNT(*)::int AS total_labor_entries,

            COALESCE(
                SUM(labor_cost),
                0
            ) AS total_labor_charges

        FROM labor_charges
    `);

    return result.rows[0];
}

// =====================================
// COMPLETE REPORTS DASHBOARD
// GET /api/reports
// =====================================

router.get("/", async (req, res) => {
    try {
        const [
            summary,
            repairStatuses,
            monthlyRepairs,
            paymentStatuses,
            monthlyRevenue,
            customers,
            inventory,
            technicians,
            labor
        ] = await Promise.all([
            getSummary(),
            getRepairStatuses(),
            getMonthlyRepairs(),
            getPaymentStatuses(),
            getMonthlyRevenue(),
            getCustomerStatistics(),
            getInventoryStatistics(),
            getTechnicianStatistics(),
            getLaborStatistics()
        ]);

        res.json({
            summary,
            repair_statuses: repairStatuses,
            monthly_repairs: monthlyRepairs,
            payment_statuses: paymentStatuses,
            monthly_revenue: monthlyRevenue,
            customers,
            inventory,
            technicians,
            labor,
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        handleError(res, error);
    }
});

// =====================================
// INDIVIDUAL REPORT ENDPOINTS
// =====================================

// GET /api/reports/summary

router.get("/summary", async (req, res) => {
    try {
        res.json(await getSummary());
    } catch (error) {
        handleError(res, error);
    }
});

// GET /api/reports/repairs

router.get("/repairs", async (req, res) => {
    try {
        const [statuses, monthly] = await Promise.all([
            getRepairStatuses(),
            getMonthlyRepairs()
        ]);

        res.json({
            statuses,
            monthly
        });

    } catch (error) {
        handleError(res, error);
    }
});

// GET /api/reports/payments

router.get("/payments", async (req, res) => {
    try {
        const [statuses, monthly] = await Promise.all([
            getPaymentStatuses(),
            getMonthlyRevenue()
        ]);

        res.json({
            statuses,
            monthly
        });

    } catch (error) {
        handleError(res, error);
    }
});

// GET /api/reports/customers

router.get("/customers", async (req, res) => {
    try {
        res.json(await getCustomerStatistics());
    } catch (error) {
        handleError(res, error);
    }
});

// GET /api/reports/inventory

router.get("/inventory", async (req, res) => {
    try {
        res.json(await getInventoryStatistics());
    } catch (error) {
        handleError(res, error);
    }
});

// GET /api/reports/technicians

router.get("/technicians", async (req, res) => {
    try {
        res.json(await getTechnicianStatistics());
    } catch (error) {
        handleError(res, error);
    }
});

// GET /api/reports/labor

router.get("/labor", async (req, res) => {
    try {
        res.json(await getLaborStatistics());
    } catch (error) {
        handleError(res, error);
    }
});

// =====================================
// EXPORT ROUTER
// =====================================

module.exports = router;
