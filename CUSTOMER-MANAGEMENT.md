# Administrator customer management

The Admin Dashboard's Manage Customers button opens `frontend/admin-customers.html`.
The page uses actual records from `https://fixtrack-backend.vercel.app/api/customers`.
It supports name/email search, customer details, and editing names, email, contact
numbers and addresses. Existing contact and address IDs are retained; omitted
records are not deleted. Devices and repairs are displayed without modifying them.
The schema does not provide a customer account-status column, so none is shown.

Customers are `users` rows with `role = 'customer'`. `user_phones` and
`user_addresses` reference `users.user_id`; `devices.user_id` identifies the
customer, and `repair_requests.device_id` identifies the device. No separate
customer table or migration is required.

## API

- `GET /api/customers?search=...`: customers and contact numbers.
- `GET /api/customers/:id`: customer, contact numbers, addresses, devices, repairs.
- `PUT /api/customers/:id`: names, email, optional phone/address arrays.

Requests require the existing Bearer JWT. Each request checks both its admin
claim and the account's current database role. Existing authentication middleware
is local to individual routers and not exported; the customer router follows the
existing verification pattern without changing authentication or technician files.
Password fields, roles and IDs are never editable. Responses explicitly select
safe columns. Updates use parameterized SQL in a transaction; email checks include
all account roles and ignore case. A users-table write lock serializes these edits
with account creation to protect email uniqueness without a schema migration.
This short-lived lock can briefly delay concurrent user writes while saving.

## Changed files

- `backend/server.js`: mount the customer router.
- `backend/routes/customers.js`: new admin-only customer API.
- `frontend/admin-dashboard.js`: connect the existing customer button.
- `frontend/admin-customers.html`: customer table and dialogs.
- `frontend/admin-customers.js`: search, details and edit behavior.
- `frontend/style.css`: scoped customer styles and mobile layout.
- `backend/tests/customers.integration.js`: rollback-protected live database/API checks.
- `backend/tests/customers.browser.js`: optional headless Chrome UI checks.
- `CUSTOMER-MANAGEMENT.md`: implementation and deployment notes.

No billing, payment, parts, technician, login, registration, schema, or repair
workflow files were changed. No database records were deleted or reset.

## Validation

From `backend`, run:

```powershell
node --check routes/customers.js
node --check server.js
node --check ../frontend/admin-customers.js
node --check ../frontend/admin-dashboard.js
node tests/customers.integration.js --browser
```

The integration runner uses the configured Neon database and existing accounts;
it does not create mock customers. All test edits, including the browser save,
are rolled back by an outer transaction. It verifies actual list/search/details,
editing, duplicate email rejection, invalid inputs, forbidden password/role
fields, missing customers, authentication and authorization, contact ownership,
preserved passwords/roles/IDs, and unchanged device/repair associations. The test
also verifies duplicate registration and invalid login still reject requests.
It does not test successful login or new registration with real credentials.

The browser checks desktop (1440px) and mobile (390px) layouts, table scrolling,
search, details, populated edit forms, saving and refreshing, empty states, and
JavaScript exceptions. It substitutes the API URL only in its local HTTP response;
the deployed JavaScript retains the production URL. It requires installed Chrome;
set `CHROME_PATH` if Chrome is not installed at its default Windows location.

Still verify successful login/registration and the deployed frontend/backend
together after release. No deployment is performed by these changes.

## Deployment

No SQL migration or new dependency is required. Keep the existing backend
`DATABASE_URL` and `JWT_SECRET` environment variables configured in Vercel; never
put either in frontend code. Deploy the backend first, then the frontend at
`https://fixtrack-management.vercel.app`. Existing accounts continue using the
same JWT format. `PORT` remains optional for local backend startup.

Suggested commit message: `feat: implement admin customer management with secure editing`
