// FixTrack local launcher. Reuses the ORIGINAL Express API without changing it.
// It serves existing frontend pages and replaces their hosted API URL at response time.
require("dotenv").config();
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const api = require("./server");
const frontend = path.resolve(__dirname, "..", "frontend");
const local = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error("Missing DATABASE_URL or JWT_SECRET in backend/.env");
  process.exit(1);
}

// Serve local JS with API addresses pointing at this same local server.
local.get(/^\/[^/]+\.js$/, (req, res, next) => {
  const name = path.basename(req.path);
  const file = path.join(frontend, name);
  if (!fs.existsSync(file)) return next();
  try {
    const source = fs.readFileSync(file, "utf8");
    const transformed = source
      .replaceAll("https://fixtrack-backend.vercel.app", "")
      .replaceAll("http://fixtrack-backend.vercel.app", "");
    res.type("application/javascript").send(transformed);
  } catch (err) { next(err); }
});

local.get("/", (req, res) => res.sendFile(path.join(frontend, "index.html")));
local.use(express.static(frontend));
local.use(api);

local.listen(PORT, "127.0.0.1", () => {
  console.log("FixTrack original API + frontend: http://localhost:" + PORT);
  console.log("Database: configured through backend/.env");
  console.log("PayMongo: original payment routes preserved; use TEST keys locally.");
});
