
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

// =====================================
// CREATE EXPRESS APPLICATION
// =====================================

const app = express();

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());
app.use(express.json());

// =====================================
// API ROUTES
// =====================================

app.use("/api/auth", authRoutes);

app.use("/api/devices", deviceRoutes);

app.use("/api/technicians", technicianRoutes);

app.use("/api/repairs", repairRoutes);

app.use("/api/parts", partRoutes);

app.use("/api/billing", billingRoutes);

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

testDatabaseConnection();

// =====================================
// START SERVER
// =====================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `FixTrack server running on port ${PORT}`
    );
});
