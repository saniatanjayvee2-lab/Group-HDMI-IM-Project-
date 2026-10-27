
(() => {
    "use strict";

    const API = "https://fixtrack-backend.vercel.app/api/customers";
    const token = localStorage.getItem("fixtrack_token");

    let user;

    try {
        user = JSON.parse(localStorage.getItem("fixtrack_user"));
    } catch {
        user = null;
    }

    if (!token || !user) {
        window.location.replace("index.html");
        return;
    }

    if (user.role !== "admin") {
        window.location.replace(
            user.role === "technician"
                ? "technician-dashboard.html"
                : "dashboard.html"
        );
        return;
    }

    const el = id => document.getElementById(id);
    const dialog = el("customer-dialog");
    const form = el("customer-edit-form");

    let selected = null;
    let saving = false;
    let listRequest = 0;
    let detailRequest = 0;
    let returnFocus = null;
    let searchTimer;

    const fullName = customer =>
        [
            customer.first_name,
            customer.middle_name,
            customer.last_name
        ].filter(Boolean).join(" ");

    const date = value =>
        value
            ? new Date(value).toLocaleDateString()
            : "Not provided";

    function node(tag, text, className) {
        const item = document.createElement(tag);

        if (text !== undefined) {
            item.textContent = text;
        }

        if (className) {
            item.className = className;
        }

        return item;
    }

    function message(target, text, error = false) {
        target.textContent = text;
        target.classList.toggle("customer-error", error);
    }

    async function request(path = "", options = {}) {
        const response = await fetch(API + path, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "Unexpected server response. Please try again."
            );
        }

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to complete the request."
            );
        }

        return data;
    }

    // =====================================
    // CUSTOMER LIST
    // =====================================

    async function load(success = "") {
        const version = ++listRequest;
        const rows = el("customer-rows");

        rows.replaceChildren();
        rows.setAttribute("aria-busy", "true");

        message(el("customer-message"), "Loading customers...");

        try {
            const search = el("customer-search").value.trim();

            const customers = await request(
                `?search=${encodeURIComponent(search)}`
            );

            if (version !== listRequest) return;

            for (const customer of customers) {
                const row = node("tr");

                const values = [
                    customer.user_id,
                    fullName(customer),
                    customer.email,
                    (customer.phones || [])
                        .map(phone => phone.phone_number)
                        .join(", ") || "Not provided",
                    date(customer.created_at)
                ];

                values.forEach(value => {
                    row.append(node("td", String(value ?? "")));
                });

                const actions = node("td");

                for (const [label, mode] of [
                    ["View Details", "view"],
                    ["Edit", "edit"]
                ]) {
                    const button = node("button", label);

                    button.type = "button";

                    button.setAttribute(
                        "aria-label",
                        `${label}: ${fullName(customer)}`
                    );

                    button.addEventListener("click", () => {
                        openCustomer(customer.user_id, mode, button);
                    });

                    actions.append(button);
                }

                row.append(actions);
                rows.append(row);
            }

            message(
                el("customer-message"),
                `${success ? success + " " : ""}${
                    customers.length
                        ? `${customers.length} customer(s).`
                        : "No customers found."
                }`
            );

        } catch (error) {
            if (version === listRequest) {
                message(
                    el("customer-message"),
                    error.message,
                    true
                );
            }
        } finally {
            if (version === listRequest) {
                rows.removeAttribute("aria-busy");
            }
        }
    }

    // =====================================
    // DYNAMIC PHONE AND ADDRESS FIELDS
    // =====================================

    const phoneDefinitions = [
        ["phone_number", "Contact Number", 30, true],
        ["type", "Type (optional)", 50, false]
    ];

    const addressDefinitions = [
        ["street_address", "Street Address", 255, false],
        ["city", "City", 100, false],
        ["province", "Province", 100, false],
        ["postal_code", "Postal Code", 20, false]
    ];

    function fieldset(container, row, definitions, idKey) {
        const group = node(
            "fieldset",
            undefined,
            "customer-contact-group"
        );

        group.append(
            node(
                "legend",
                idKey === "phone_id"
                    ? "Contact Number"
                    : "Address"
            )
        );

        if (row[idKey] != null) {
            group.dataset.recordId = String(row[idKey]);
        }

        for (const [name, label, max, required] of definitions) {
            const wrapper = node("label", label);
            const input = node("input");

            input.name = name;
            input.maxLength = max;
            input.required = Boolean(required);
            input.value = row[name] || "";

            if (name === "phone_number") {
                input.type = "tel";
            }

            wrapper.append(input);
            group.append(wrapper);
        }

        const removeButton = node(
            "button",
            idKey === "phone_id"
                ? "Remove Contact Number"
                : "Remove Address",
            "customer-remove-button"
        );

        removeButton.type = "button";

        removeButton.addEventListener("click", () => {
            if (saving) return;

            const label =
                idKey === "phone_id"
                    ? "contact number"
                    : "address";

            const confirmed = window.confirm(
                `Remove this ${label}? The change will be saved when you click Save Changes.`
            );

            if (!confirmed) return;

            group.remove();

            message(
                el("customer-dialog-message"),
                `The ${label} was removed from the form. Click Save Changes to apply.`
            );
        });

        group.append(removeButton);
        container.append(group);
    }

    function addPhone(row = {}) {
        fieldset(
            el("customer-phone-fields"),
            row,
            phoneDefinitions,
            "phone_id"
        );
    }

    function addAddress(row = {}) {
        fieldset(
            el("customer-address-fields"),
            row,
            addressDefinitions,
            "address_id"
        );
    }

    // =====================================
    // CUSTOMER DETAILS
    // =====================================

    function details(customer) {
        const target = el("customer-details");
        target.replaceChildren();

        const display = value =>
            value === undefined ||
            value === null ||
            value === ""
                ? "Not provided"
                : String(value);

        function detailRow(parent, label, value) {
            const row = node(
                "div",
                undefined,
                "customer-detail-row"
            );

            row.append(
                node(
                    "span",
                    label,
                    "customer-detail-label"
                ),
                node(
                    "span",
                    display(value),
                    "customer-detail-value"
                )
            );

            parent.append(row);
        }

        // CUSTOMER PROFILE

        const profile = node(
            "section",
            undefined,
            "customer-profile-card"
        );

        detailRow(
            profile,
            "Customer ID",
            customer.user_id
        );

        detailRow(
            profile,
            "Full Name",
            fullName(customer)
        );

        detailRow(
            profile,
            "Email",
            customer.email
        );

        detailRow(
            profile,
            "Contact Numbers",
            (customer.phones || [])
                .map(phone =>
                    phone.phone_number +
                    (phone.type ? ` (${phone.type})` : "")
                )
                .join(", ") || "Not provided"
        );

        detailRow(
            profile,
            "Registered Date",
            date(customer.created_at)
        );

        detailRow(
            profile,
            "Addresses",
            (customer.addresses || [])
                .map(address =>
                    [
                        address.street_address,
                        address.city,
                        address.province,
                        address.postal_code
                    ].filter(Boolean).join(", ")
                )
                .join("; ") || "Not provided"
        );

        target.append(profile);

        // REGISTERED DEVICES

        const devices = customer.devices || [];

        target.append(
            node(
                "h3",
                `Registered Devices (${devices.length})`,
                "customer-section-title"
            )
        );

        if (!devices.length) {
            target.append(
                node("p", "No registered devices found.")
            );
        }

        devices.forEach(device => {
            const card = node(
                "article",
                undefined,
                "customer-record-card"
            );

            card.append(
                node(
                    "h4",
                    [device.brand, device.model]
                        .filter(Boolean)
                        .join(" ") || "Device",
                    "customer-record-title"
                )
            );

            detailRow(
                card,
                "Device ID",
                `#${device.device_id}`
            );

            detailRow(
                card,
                "Device Type",
                device.device_type
            );

            detailRow(
                card,
                "Serial Number",
                device.serial_number
            );

            detailRow(
                card,
                "Accessories",
                device.accessories_included
            );

            target.append(card);
        });

        // REPAIR REQUESTS

        const repairs = customer.repairs || [];

        target.append(
            node(
                "h3",
                `Repair Requests (${repairs.length})`,
                "customer-section-title"
            )
        );

        if (!repairs.length) {
            target.append(
                node("p", "No repair requests found.")
            );
        }

        repairs.forEach(repair => {
            const card = node(
                "article",
                undefined,
                "customer-record-card"
            );

            const header = node(
                "div",
                undefined,
                "customer-record-header"
            );

            header.append(
                node(
                    "h4",
                    `Repair #${repair.repair_id}`,
                    "customer-record-title"
                )
            );

            const status = node(
                "span",
                display(repair.status),
                "customer-status-badge"
            );

            const normalized = String(
                repair.status || ""
            ).toLowerCase();

            status.classList.add(
                normalized === "completed"
                    ? "customer-status-completed"
                    : normalized === "cancelled"
                        ? "customer-status-cancelled"
                        : "customer-status-pending"
            );

            header.append(status);
            card.append(header);

            detailRow(
                card,
                "Device ID",
                `#${repair.device_id}`
            );

            detailRow(
                card,
                "Device",
                [repair.brand, repair.model]
                    .filter(Boolean)
                    .join(" ")
            );

            detailRow(
                card,
                "Problem",
                repair.problem_description
            );

            detailRow(
                card,
                "Submitted",
                date(repair.date_submitted)
            );

            detailRow(
                card,
                "Completed",
                date(repair.date_completed)
            );

            target.append(card);
        });
    }

    // =====================================
    // OPEN CUSTOMER
    // =====================================

    async function openCustomer(id, mode, trigger) {
        const version = ++detailRequest;

        selected = null;
        returnFocus = trigger;

        form.hidden = true;
        el("customer-details").replaceChildren();

        el("customer-dialog-title").textContent =
            mode === "edit"
                ? "Edit Customer"
                : "Customer Details";

        message(
            el("customer-dialog-message"),
            "Loading customer..."
        );

        if (!dialog.open) {
            dialog.showModal();
        }

        try {
            const customer = await request(`/${id}`);

            if (
                version !== detailRequest ||
                !dialog.open
            ) {
                return;
            }

            selected = customer;

            message(
                el("customer-dialog-message"),
                ""
            );

            if (mode === "view") {
                details(customer);
                return;
            }

            form.reset();

            for (const key of [
                "first_name",
                "middle_name",
                "last_name",
                "email"
            ]) {
                form.elements.namedItem(key).value =
                    customer[key] || "";
            }

            el("customer-phone-fields").replaceChildren();
            el("customer-address-fields").replaceChildren();

            (customer.phones || []).forEach(addPhone);
            (customer.addresses || []).forEach(addAddress);

            form.hidden = false;

            form.elements.namedItem("first_name").focus();

        } catch (error) {
            if (version === detailRequest) {
                message(
                    el("customer-dialog-message"),
                    error.message,
                    true
                );
            }
        }
    }

    // =====================================
    // CLOSE DIALOG
    // =====================================

    function close() {
        if (!saving) {
            dialog.close();
        }
    }

    el("customer-close").addEventListener(
        "click",
        close
    );

    el("customer-cancel").addEventListener(
        "click",
        close
    );

    dialog.addEventListener("cancel", event => {
        if (saving) {
            event.preventDefault();
        }
    });

    dialog.addEventListener("close", () => {
        ++detailRequest;
        selected = null;

        if (returnFocus?.isConnected) {
            returnFocus.focus();
        } else {
            el("customer-search").focus();
        }
    });

    // =====================================
    // ADD CONTACT NUMBER
    // =====================================

    el("customer-add-phone").addEventListener(
        "click",
        () => {
            if (saving || !selected || form.hidden) {
                return;
            }

            addPhone();

            const newest =
                el("customer-phone-fields").lastElementChild;

            if (newest) {
                newest.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });

                newest.querySelector("input")?.focus({
                    preventScroll: true
                });
            }
        }
    );

    // =====================================
    // ADD ADDRESS
    // =====================================

    el("customer-add-address").addEventListener(
        "click",
        () => {
            if (saving || !selected || form.hidden) {
                return;
            }

            addAddress();

            const newest =
                el("customer-address-fields").lastElementChild;

            if (newest) {
                newest.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });

                newest.querySelector("input")?.focus({
                    preventScroll: true
                });
            }
        }
    );

    // =====================================
    // SEARCH AND REFRESH
    // =====================================

    el("customer-search-form").addEventListener(
        "submit",
        event => {
            event.preventDefault();
            load();
        }
    );

    el("customer-refresh").addEventListener(
        "click",
        () => load()
    );

    el("customer-search").addEventListener(
        "input",
        () => {
            clearTimeout(searchTimer);

            searchTimer = setTimeout(() => {
                load();
            }, 300);
        }
    );

    // =====================================
    // COLLECT CONTACT INFORMATION
    // =====================================

    function collect(container, key) {
        return Array.from(
            container.querySelectorAll("fieldset")
        ).map(group => {
            const row = {};

            if (group.dataset.recordId) {
                row[key] = Number(
                    group.dataset.recordId
                );
            }

            group.querySelectorAll("input").forEach(
                input => {
                    row[input.name] = input.value.trim();
                }
            );

            return row;
        });
    }

    // =====================================
    // SAVE CUSTOMER CHANGES
    // =====================================

    form.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            if (
                saving ||
                !selected ||
                !form.reportValidity()
            ) {
                return;
            }

            const body = {};

            for (const key of [
                "first_name",
                "middle_name",
                "last_name",
                "email"
            ]) {
                body[key] =
                    form.elements.namedItem(key).value.trim();
            }

            body.phones = collect(
                el("customer-phone-fields"),
                "phone_id"
            );

            body.addresses = collect(
                el("customer-address-fields"),
                "address_id"
            );

            saving = true;

            const controls = [
                ...form.querySelectorAll("input, button"),
                el("customer-close")
            ];

            controls.forEach(control => {
                control.disabled = true;
            });

            message(
                el("customer-dialog-message"),
                "Saving changes..."
            );

            try {
                const result = await request(
                    `/${selected.user_id}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(body)
                    }
                );

                saving = false;
                dialog.close();

                await load(result.message);

            } catch (error) {
                message(
                    el("customer-dialog-message"),
                    error.message,
                    true
                );

            } finally {
                saving = false;

                controls.forEach(control => {
                    control.disabled = false;
                });
            }
        }
    );

    // =====================================
    // INITIAL LOAD
    // =====================================

    load();
})();
