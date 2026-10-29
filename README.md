# FixTrack - Computer Repair Shop Management System

Roles: **Customer**, **Technician**, **Admin** (animated role-based login -> dedicated dashboards).

## Run locally
1. `cd backend && npm install`, create `.env` from `.env.example` **only if you don't already have a `.env`** (copying over an existing one replaces your real keys), then fill it in.
2. Create the database with `backend/database/schema.sql`.
3. `npx nodemon server.js` (API on :3000).
4. Open `frontend/index.html` (e.g. Live Server). Frontend calls the deployed API at fixtrack-backend.vercel.app by default.

## Frontend map
- `index.html` + `app.js` + `login.css`: login/register/admin setup
- `admin-*.html`, `technicians.html`: admin
- `technician-dashboard.*`: technician
- `dashboard.html`, `devices`, `repairs`, `history`, `profile`: customer
- `dashboard-anim.*`: shared dashboard animations
