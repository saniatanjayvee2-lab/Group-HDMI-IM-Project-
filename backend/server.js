
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

// =====================================
// IMPORT ROUTES
// =====================================

const authRoutes = require("./routes/auth");
const deviceRoutes = require("./routes/devices");
const technicianRoutes = require("./routes/technicians");
const repairRoutes = require("./routes/repairs");
const partRoutes = require("./routes/parts");
const billingRoutes = require("./routes/billing");
const paymentRoutes = require("./routes/payments");
const customerRoutes = require("./routes/customers");

// =====================================
// CREATE EXPRESS APPLICATION
// =====================================

const app = express();

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());

// Preserve the raw request body for
// PayMongo webhook signature verification.
app.use(
    express.json({
        verify: (req, res, buffer) => {
            if (
                req.originalUrl.startsWith(
                    "/api/payments/webhook"
                )
            ) {
                req.rawBody = Buffer.from(buffer);
            }
        }
    })
);

// =====================================
// API ROUTES
// =====================================

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/technicians", technicianRoutes);
app.use("/api/repairs", repairRoutes);
app.use("/api/parts", partRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/payments", paymentRoutes);

// =====================================
// HOME ROUTE
// =====================================

app.get("/", (req, res) => {
    res.send("FixTrack API is running!");
});

// =====================================
// TEST DATABASE CONNECTION
// =====================================

async function testDatabaseConnection() {
    try {
        const result = await pool.query("SELECT NOW()");

        console.log(
            "Connected to FixTrack database successfully!"
        );

        console.log(
            "Database time:",
            result.rows[0].now
        );

    } catch (error) {
        console.error("Database connection failed:");
        console.error(error.message);
    }
}

// =====================================
// START SERVER (LOCAL DEVELOPMENT)
// =====================================

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    testDatabaseConnection();

    app.listen(PORT, () => {
        console.log(
            `FixTrack server running on port ${PORT}`
        );
    });
}

// =====================================
// EXPORT FOR VERCEL
// =====================================

module.exports = app;
