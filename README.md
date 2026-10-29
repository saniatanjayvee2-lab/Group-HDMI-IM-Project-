# FixTrack — Computer Repair Shop Management System

FixTrack helps a computer repair shop manage repair requests from intake through completion. Customers can register devices, submit repair requests, and follow repair progress. Technicians can view assigned work, record diagnoses, and update repair statuses. Administrators can manage customers, technicians, repairs, parts, billing, payments, and reports.

## Roles

- **Customer:** Manage devices, submit repair requests, review diagnoses, and track repair status.
- **Technician:** View assigned repairs, update status, and record or edit diagnoses.
- **Admin:** Manage repair assignments and statuses, customers, technicians, inventory, billing, payments, and reports.

## Run locally

1. Install backend dependencies:
   `cd backend && npm install`
2. Copy `backend/.env.example` to `backend/.env` and add your database and authentication settings.
3. Create the database using `backend/database/schema.sql`.
4. Start the API from the `backend` directory with `npx nodemon server.js`. The API listens on port 3000 by default.
5. Serve `frontend/index.html` with a local static web server such as VS Code Live Server. The frontend currently uses the deployed API at `https://fixtrack-backend.vercel.app/api`.

## Project structure

- `backend/server.js`: Express API setup and route registration.
- `backend/routes/`: Authentication, repairs, devices, technicians, customers, billing, payments, parts, and reports endpoints.
- `backend/database/schema.sql`: PostgreSQL database schema.
- `frontend/index.html` and `frontend/app.js`: Login, registration, and admin setup.
- `frontend/admin-*.html/js`: Administrator dashboards and management pages.
- `frontend/technician-dashboard.html/js`: Technician dashboard.
- Customer pages such as `dashboard.html`, `devices.html`, `repairs.html`, `history.html`, and `profile.html` are in `frontend/`.
