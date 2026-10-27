# FixTrack local comparison build

This branch is a full copy of the ORIGINAL FixTrack repository on main with a local launcher added.
The backend routes (including PayMongo checkout/webhooks), frontend HTML/JS, PostgreSQL queries, auth, and roles are unchanged.

## Windows launch (no Docker)
1. Download this **branch** as ZIP and extract it.
2. Copy your **existing working** `backend/.env` from your other FixTrack folder into this copy at `backend/.env`. Never commit or share `.env`.
3. Set `FRONTEND_URL=http://localhost:3000` in the **local copy** of `.env`. Keep `DATABASE_URL` pointing at the database you intend to test (preferably a **separate test PostgreSQL database**, not production). Use PayMongo **test** keys for `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, and `PAYMONGO_MODE=test` if supported by your account settings.
4. Double click `start-local.cmd`, or run `cd backend && npm.cmd install && node local-server.js` in PowerShell.
5. Open `http://localhost:3000`. Do NOT use Go Live.

## How it works
`backend/local-server.js` loads the existing `backend/server.js` Express app and routes, then serves all original `frontend` files. It rewrites old hosted-API URLs in JS *in memory* to local same-origin calls, without editing any original frontend source files.

## Important limits
- You MUST use PostgreSQL with the **existing application's actual schema**. This branch does not migrate the older SQLite prototype's data.
- If the configured PostgreSQL database is your production Neon DB, local actions can change REAL data. Use a separate cloned/test DB to avoid that.
- PayMongo checkout can require externally reachable success/cancel URLs and webhooks. PayMongo cannot send webhooks directly to localhost. Use a secure HTTPS forwarding endpoint for **test** webhooks, then configure the PayMongo test webhook URL accordingly.
- No .env, DB password, JWT signing key, or payment credential is bundled, for credential security.
- This branch has not passed end-to-end integration testing. Do not deploy it as a verified production build.
- `main` and your existing Vercel deployment remain untouched.
