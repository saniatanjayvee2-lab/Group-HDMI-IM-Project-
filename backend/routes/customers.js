
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

const columns =
    "user_id, first_name, middle_name, last_name, email, created_at";

// =====================================
// ADMIN AUTHENTICATION
// =====================================

router.use(async (req, res, next) => {
    const match = /^Bearer (\S+)$/i.exec(
        req.headers.authorization || ""
    );

    if (!match) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    let user;

    try {
        user = jwt.verify(
            match[1],
            process.env.JWT_SECRET
        );
    } catch {
        return res.status(401).json({
            message: "Invalid or expired login."
        });
    }

    if (user.role !== "admin") {
        return res.status(403).json({
            message: "Administrator access only."
        });
    }

    try {
        const admin = await pool.query(
            `SELECT user_id
             FROM users
             WHERE user_id = $1
             AND role = 'admin'`,
            [user.user_id]
        );

        if (!admin.rows.length) {
            return res.status(403).json({
                message: "Administrator access only."
            });
        }

        next();
    } catch (error) {
        next(error);
    }
});

// =====================================
// GET ALL CUSTOMERS
// =====================================

router.get("/", async (req, res, next) => {
    try {
        if (
            req.query.search !== undefined &&
            (
                typeof req.query.search !== "string" ||
                req.query.search.length > 255
            )
        ) {
            return res.status(400).json({
                message:
                    "Search must be text of at most 255 characters."
            });
        }

        const result = await pool.query(
            `SELECT ${columns},
                COALESCE(
                    (
                        SELECT json_agg(p ORDER BY phone_id)
                        FROM (
                            SELECT
                                phone_id,
                                phone_number,
                                type
                            FROM user_phones
                            WHERE user_id = u.user_id
                        ) p
                    ),
                    '[]'
                ) AS phones
             FROM users u
             WHERE role = 'customer'
             AND (
                 $1 = ''
                 OR strpos(
                     lower(
                         concat_ws(
                             ' ',
                             first_name,
                             middle_name,
                             last_name
                         )
                     ),
                     lower($1)
                 ) > 0
                 OR strpos(lower(email), lower($1)) > 0
             )
             ORDER BY created_at DESC, user_id DESC`,
            [(req.query.search || "").trim()]
        );

        res.json(result.rows);

    } catch (error) {
        next(error);
    }
});

// =====================================
// VALIDATE CUSTOMER ID
// =====================================

router.param("id", (req, res, next, value) => {
    const id = Number(value);

    if (
        !/^[1-9]\d*$/.test(value) ||
        !Number.isSafeInteger(id) ||
        id > 2147483647
    ) {
        return res.status(400).json({
            message: "Invalid customer ID."
        });
    }

    next();
});

// =====================================
// GET CUSTOMER DETAILS
// =====================================

router.get("/:id", async (req, res, next) => {
    try {
        const customer = await pool.query(
            `SELECT ${columns}
             FROM users
             WHERE user_id = $1
             AND role = 'customer'`,
            [req.params.id]
        );

        if (!customer.rows.length) {
            return res.status(404).json({
                message: "Customer not found."
            });
        }

        const queries = [
            `SELECT
                phone_id,
                phone_number,
                type
             FROM user_phones
             WHERE user_id = $1
             ORDER BY phone_id`,

            `SELECT
                address_id,
                street_address,
                city,
                province,
                postal_code,
                is_primary
             FROM user_addresses
             WHERE user_id = $1
             ORDER BY is_primary DESC, address_id`,

            `SELECT
                device_id,
                device_type,
                brand,
                model,
                serial_number,
                accessories_included,
                created_at
             FROM devices
             WHERE user_id = $1
             ORDER BY device_id DESC`,

            `SELECT
                r.repair_id,
                r.device_id,
                r.problem_description,
                r.status,
                r.date_submitted,
                r.date_completed,
                d.device_type,
                d.brand,
                d.model
             FROM repair_requests r
             JOIN devices d
                ON d.device_id = r.device_id
             WHERE d.user_id = $1
             ORDER BY
                r.date_submitted DESC,
                r.repair_id DESC`
        ];

        const results = await Promise.all(
            queries.map(sql =>
                pool.query(sql, [req.params.id])
            )
        );

        res.json({
            ...customer.rows[0],
            phones: results[0].rows,
            addresses: results[1].rows,
            devices: results[2].rows,
            repairs: results[3].rows
        });

    } catch (error) {
        next(error);
    }
});

// =====================================
// VALIDATE CUSTOMER INFORMATION
// =====================================

function validate(body) {
    if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
    ) {
        throw new Error("Invalid customer information.");
    }

    const allowed = [
        "first_name",
        "middle_name",
        "last_name",
        "email",
        "phones",
        "addresses"
    ];

    if (
        Object.keys(body).some(
            key => !allowed.includes(key)
        )
    ) {
        throw new Error(
            "Only customer contact information may be edited."
        );
    }

    const text = (value, max, required = false) => {
        if (value == null && !required) {
            return null;
        }

        if (
            typeof value !== "string" ||
            value.trim().length > max ||
            (required && !value.trim())
        ) {
            throw new Error(
                "Check required fields and field lengths."
            );
        }

        return value.trim() || null;
    };

    const data = {
        first_name: text(body.first_name, 100, true),
        middle_name: text(body.middle_name, 100),
        last_name: text(body.last_name, 100, true),
        email: text(body.email, 255, true).toLowerCase()
    };

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
        throw new Error("Enter a valid email address.");
    }

    for (const field of ["phones", "addresses"]) {
        if (body[field] === undefined) {
            continue;
        }

        if (
            !Array.isArray(body[field]) ||
            body[field].length > 100
        ) {
            throw new Error("Invalid contact information.");
        }

        const ids = new Set();

        data[field] = body[field].map(row => {
            if (
                !row ||
                typeof row !== "object" ||
                Array.isArray(row)
            ) {
                throw new Error("Invalid contact information.");
            }

            const key =
                field === "phones"
                    ? "phone_id"
                    : "address_id";

            const id = row[key];

            if (
                id != null &&
                (
                    !Number.isInteger(id) ||
                    id <= 0 ||
                    id > 2147483647 ||
                    ids.has(id)
                )
            ) {
                throw new Error("Invalid contact ID.");
            }

            if (id != null) {
                ids.add(id);
            }

            if (field === "phones") {
                const phone = text(
                    row.phone_number,
                    30,
                    true
                );

                if (
                    !/^[+\d][\d\s().-]{2,29}$/.test(phone)
                ) {
                    throw new Error(
                        "Enter a valid contact number."
                    );
                }

                return {
                    phone_id: id,
                    phone_number: phone,
                    type: text(row.type, 50)
                };
            }

            return {
                address_id: id,
                street_address: text(
                    row.street_address,
                    255
                ),
                city: text(row.city, 100),
                province: text(row.province, 100),
                postal_code: text(row.postal_code, 20)
            };
        });
    }

    return data;
}

// =====================================
// UPDATE CUSTOMER
// =====================================

router.put("/:id", async (req, res, next) => {
    let data;

    try {
        data = validate(req.body);
    } catch (error) {
        return res.status(400).json({
            message: error.message
        });
    }

    let client;

    try {
        client = await pool.connect();

        await client.query("BEGIN");

        await client.query(
            "LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE"
        );

        const found = await client.query(
            `SELECT user_id
             FROM users
             WHERE user_id = $1
             AND role = 'customer'
             FOR UPDATE`,
            [req.params.id]
        );

        if (!found.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Customer not found."
            });
        }

        const duplicate = await client.query(
            `SELECT user_id
             FROM users
             WHERE lower(email) = $1
             AND user_id <> $2`,
            [data.email, req.params.id]
        );

        if (duplicate.rows.length) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                message:
                    "An account with this email already exists."
            });
        }

        // UPDATE CUSTOMER PROFILE

        const result = await client.query(
            `UPDATE users
             SET
                first_name = $1,
                middle_name = $2,
                last_name = $3,
                email = $4
             WHERE user_id = $5
             AND role = 'customer'
             RETURNING ${columns}`,
            [
                data.first_name,
                data.middle_name,
                data.last_name,
                data.email,
                req.params.id
            ]
        );

        // =====================================
        // UPDATE / ADD PHONE NUMBERS
        // =====================================

        if (data.phones !== undefined) {
            for (const phone of data.phones) {
                if (phone.phone_id != null) {
                    const updated = await client.query(
                        `UPDATE user_phones
                         SET
                            phone_number = $1,
                            type = $2
                         WHERE phone_id = $3
                         AND user_id = $4
                         RETURNING phone_id`,
                        [
                            phone.phone_number,
                            phone.type,
                            phone.phone_id,
                            req.params.id
                        ]
                    );

                    if (!updated.rows.length) {
                        throw Object.assign(
                            new Error(
                                "Contact number does not belong to this customer."
                            ),
                            { status: 400 }
                        );
                    }

                } else {
                    await client.query(
                        `INSERT INTO user_phones
                            (user_id, phone_number, type)
                         VALUES ($1, $2, $3)`,
                        [
                            req.params.id,
                            phone.phone_number,
                            phone.type
                        ]
                    );
                }
            }

            // NEW: DELETE REMOVED PHONE NUMBERS
            const keptPhoneIds = data.phones
                .filter(phone => phone.phone_id != null)
                .map(phone => phone.phone_id);

            await client.query(
                `DELETE FROM user_phones
                 WHERE user_id = $1
                 AND NOT (phone_id = ANY($2::int[]))`,
                [req.params.id, keptPhoneIds]
            );
        }

        // =====================================
        // UPDATE / ADD ADDRESSES
        // =====================================

        if (data.addresses !== undefined) {
            for (const address of data.addresses) {
                const values = [
                    address.street_address,
                    address.city,
                    address.province,
                    address.postal_code
                ];

                if (address.address_id != null) {
                    const updated = await client.query(
                        `UPDATE user_addresses
                         SET
                            street_address = $1,
                            city = $2,
                            province = $3,
                            postal_code = $4
                         WHERE address_id = $5
                         AND user_id = $6
                         RETURNING address_id`,
                        [
                            ...values,
                            address.address_id,
                            req.params.id
                        ]
                    );

                    if (!updated.rows.length) {
                        throw Object.assign(
                            new Error(
                                "Address does not belong to this customer."
                            ),
                            { status: 400 }
                        );
                    }

                } else if (values.some(Boolean)) {
                    await client.query(
                        `INSERT INTO user_addresses
                            (
                                street_address,
                                city,
                                province,
                                postal_code,
                                user_id
                            )
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            ...values,
                            req.params.id
                        ]
                    );
                }
            }

            // NEW: DELETE REMOVED ADDRESSES
            const keptAddressIds = data.addresses
                .filter(
                    address => address.address_id != null
                )
                .map(address => address.address_id);

            await client.query(
                `DELETE FROM user_addresses
                 WHERE user_id = $1
                 AND NOT (address_id = ANY($2::int[]))`,
                [req.params.id, keptAddressIds]
            );
        }

        await client.query("COMMIT");

        res.json({
            message: "Customer updated successfully.",
            customer: result.rows[0]
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

        if (error.status === 400) {
            return res.status(400).json({
                message: error.message
            });
        }

        next(error);

    } finally {
        if (client) {
            client.release();
        }
    }
});

// =====================================
// ERROR HANDLING
// =====================================

router.use((error, req, res, next) => {
    console.error(
        "Customer management error:",
        error.code || error.message
    );

    res.status(500).json({
        message:
            "Unable to complete the customer request. Please try again."
    });
});

module.exports = router;
