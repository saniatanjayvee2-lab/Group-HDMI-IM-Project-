
const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function createProfileRouter(pool) {
    const router = express.Router();

    // VERIFY CUSTOMER LOGIN
    router.use((req, res, next) => {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ")
            ? auth.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                error: "Please log in."
            });
        }

        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            const userId = Number(
                decoded.user_id ?? decoded.userId ?? decoded.id
            );

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                return res.status(401).json({
                    error: "Invalid login token."
                });
            }

            req.profileUserId = userId;
            next();

        } catch (error) {
            return res.status(401).json({
                error: "Your session has expired."
            });
        }
    });

    // GET CUSTOMER PROFILE
    router.get("/", async (req, res) => {
        try {
            const user = await pool.query(
                `SELECT user_id, first_name, middle_name,
                        last_name, email, role, created_at
                 FROM users
                 WHERE user_id = $1
                 AND LOWER(role) = 'customer'`,
                [req.profileUserId]
            );

            if (!user.rows.length) {
                return res.status(403).json({
                    error: "Customer account not found."
                });
            }

            const phones = await pool.query(
                `SELECT phone_id, phone_number, type
                 FROM user_phones
                 WHERE user_id = $1
                 ORDER BY phone_id`,
                [req.profileUserId]
            );

            const addresses = await pool.query(
                `SELECT address_id, street_address, city,
                        province, postal_code, is_primary
                 FROM user_addresses
                 WHERE user_id = $1
                 ORDER BY is_primary DESC, address_id`,
                [req.profileUserId]
            );

            return res.json({
                user: user.rows[0],
                phones: phones.rows,
                addresses: addresses.rows
            });

        } catch (error) {
            console.error("Load profile error:", error);

            return res.status(500).json({
                error: "Unable to load customer profile."
            });
        }
    });

    // UPDATE CUSTOMER PROFILE
    router.put("/", async (req, res) => {
        const {
            first_name,
            middle_name,
            last_name,
            email,
            phones,
            addresses
        } = req.body || {};

        const first = String(first_name || "").trim();
        const middle = String(middle_name || "").trim();
        const last = String(last_name || "").trim();
        const mail = String(email || "").trim().toLowerCase();

        if (
            !first || first.length > 100 ||
            middle.length > 100 ||
            !last || last.length > 100 ||
            mail.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)
        ) {
            return res.status(400).json({
                error: "Please enter valid personal information."
            });
        }

        if (
            !Array.isArray(phones) ||
            !Array.isArray(addresses) ||
            phones.length > 10 ||
            addresses.length > 10
        ) {
            return res.status(400).json({
                error: "Invalid phone or address information."
            });
        }

        const cleanPhones = [];
        const cleanAddresses = [];

        for (const phone of phones) {
            if (!phone || typeof phone !== "object") {
                return res.status(400).json({
                    error: "Invalid phone information."
                });
            }

            const number = String(phone.phone_number || "").trim();
            const type = String(phone.type || "Mobile").trim();

            if (
                !/^[+\d][\d\s().-]{2,29}$/.test(number) ||
                type.length > 50
            ) {
                return res.status(400).json({
                    error: "Invalid phone number."
                });
            }

            cleanPhones.push({ number, type });
        }

        for (const address of addresses) {
            if (!address || typeof address !== "object") {
                return res.status(400).json({
                    error: "Invalid address information."
                });
            }

            const street = String(address.street_address || "").trim();
            const city = String(address.city || "").trim();
            const province = String(address.province || "").trim();
            const postal = String(address.postal_code || "").trim();

            if (
                !street || !city || !province ||
                street.length > 255 ||
                city.length > 100 ||
                province.length > 100 ||
                postal.length > 20
            ) {
                return res.status(400).json({
                    error: "Please complete the address fields."
                });
            }

            cleanAddresses.push({
                street,
                city,
                province,
                postal,
                is_primary: address.is_primary === true
            });
        }

        if (cleanAddresses.length > 0) {
            let primaryFound = false;

            for (const address of cleanAddresses) {
                if (address.is_primary && !primaryFound) {
                    primaryFound = true;
                } else {
                    address.is_primary = false;
                }
            }

            if (!primaryFound) {
                cleanAddresses[0].is_primary = true;
            }
        }

        let client;

        try {
            client = await pool.connect();
            await client.query("BEGIN");

            // Lock and verify the logged-in customer
            const existing = await client.query(
                `SELECT user_id FROM users
                 WHERE user_id = $1
                 AND LOWER(role) = 'customer'
                 FOR UPDATE`,
                [req.profileUserId]
            );

            if (!existing.rows.length) {
                await client.query("ROLLBACK");
                return res.status(403).json({
                    error: "Customer account not found."
                });
            }

            const duplicate = await client.query(
                `SELECT user_id FROM users
                 WHERE LOWER(email) = $1
                 AND user_id <> $2`,
                [mail, req.profileUserId]
            );

            if (duplicate.rows.length) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    error: "Email is already registered."
                });
            }

            await client.query(
                `UPDATE users
                 SET first_name = $1,
                     middle_name = $2,
                     last_name = $3,
                     email = $4
                 WHERE user_id = $5`,
                [
                    first,
                    middle || null,
                    last,
                    mail,
                    req.profileUserId
                ]
            );

            // Save phone numbers
            await client.query(
                "DELETE FROM user_phones WHERE user_id = $1",
                [req.profileUserId]
            );

            for (const phone of cleanPhones) {
                await client.query(
                    `INSERT INTO user_phones
                     (user_id, phone_number, type)
                     VALUES ($1, $2, $3)`,
                    [
                        req.profileUserId,
                        phone.number,
                        phone.type
                    ]
                );
            }

            // Save addresses
            await client.query(
                "DELETE FROM user_addresses WHERE user_id = $1",
                [req.profileUserId]
            );

            for (const address of cleanAddresses) {
                await client.query(
                    `INSERT INTO user_addresses
                     (user_id, street_address, city,
                      province, postal_code, is_primary)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        req.profileUserId,
                        address.street,
                        address.city,
                        address.province,
                        address.postal,
                        address.is_primary
                    ]
                );
            }

            await client.query("COMMIT");

            return res.json({
                message: "Profile updated successfully."
            });

        } catch (error) {
            if (client) {
                await client.query("ROLLBACK").catch(() => {});
            }

            console.error("Update profile error:", error);

            return res.status(
                error.code === "23505" ? 409 : 500
            ).json({
                error: error.code === "23505"
                    ? "Email is already registered."
                    : "Unable to update profile."
            });

        } finally {
            if (client) client.release();
        }
    });

    return router;
};
