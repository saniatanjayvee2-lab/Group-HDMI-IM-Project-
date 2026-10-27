
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
    // COMPACT CONTACT AND ADDRESS CARDS
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
        const isPhone = idKey === "phone_id";
        const existing = row[idKey] != null;

        const group = node(
            "fieldset",
            undefined,
            "customer-contact-group customer-compact-group"
        );

        if (existing) {
            group.dataset.recordId = String(row[idKey]);
        }

        const header = node(
            "div",
            undefined,
            "customer-compact-header"
        );

        const summary = node(
            "div",
            "",
            "customer-compact-summary"
        );

        const actions = node(
            "div",
            undefined,
            "customer-compact-actions"
        );

        const editButton = node(
            "button",
            existing ? "Edit" : "Collapse",
            "customer-compact-edit"
        );

        editButton.type = "button";

        const removeButton = node(
            "button",
            "Remove",
            "customer-compact-remove"
        );

        removeButton.type = "button";

        const fields = node(
            "div",
            undefined,
            "customer-compact-fields"
        );

        const inputs = {};

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

            inputs[name] = input;

            wrapper.append(input);
            fields.append(wrapper);
        }

        function updateSummary() {
            if (isPhone) {
                const number =
                    inputs.phone_number.value.trim() ||
                    "New Contact Number";

                const type = inputs.type.value.trim();

                summary.textContent = type
                    ? `${number} (${type})`
                    : number;
            } else {
                const address = [
                    inputs.street_address.value.trim(),
                    inputs.city.value.trim(),
                    inputs.province.value.trim(),
                    inputs.postal_code.value.trim()
                ].filter(Boolean).join(", ");

                summary.textContent =
                    address || "New Address";
            }
        }

        function setExpanded(expanded) {
            fields.hidden = !expanded;
            group.classList.toggle(
                "customer-expanded",
                expanded
            );

            editButton.textContent =
                expanded ? "Done" : "Edit";

            if (expanded) {
                fields.querySelector("input")?.focus();
            }
        }

        editButton.addEventListener("click", () => {
            if (saving) return;

            setExpanded(fields.hidden);
        });

        removeButton.addEventListener("click", () => {
            if (saving) return;

            const label = isPhone
                ? "contact number"
                : "address";

            if (
                !window.confirm(
                    `Remove this ${label}? Click Save Changes to confirm the change.`
                )
            ) {
                return;
            }

            group.remove();

            message(
                el("customer-dialog-message"),
                `${label} removed from the form. Click Save Changes to apply.`
            );
        });

        for (const input of Object.values(inputs)) {
            input.addEventListener("input", updateSummary);
        }

        actions.append(editButton, removeButton);
        header.append(summary, actions);
        group.append(header, fields);
        container.append(group);

        updateSummary();
        setExpanded(!existing);

        if (!existing) {
            group.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        }
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

        const profile = node(
            "section",
            undefined,
            "customer-profile-card"
        );

        detailRow(profile, "Customer ID", customer.user_id);
        detailRow(profile, "Full Name", fullName(customer));
        detailRow(profile, "Email", customer.email);

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

            detailRow(card, "Device Type", device.device_type);
            detailRow(card, "Serial Number", device.serial_number);
            detailRow(card, "Accessories", device.accessories_included);

            target.append(card);
        });

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

            message(el("customer-dialog-message"), "");

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

    el("customer-close").addEventListener("click", close);
    el("customer-cancel").addEventListener("click", close);

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
    // ADD BUTTONS
    // =====================================

    el("customer-add-phone").addEventListener("click", () => {
        if (saving || !selected || form.hidden) return;
        addPhone();
    });

    el("customer-add-address").addEventListener("click", () => {
        if (saving || !selected || form.hidden) return;
        addAddress();
    });

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

    el("customer-search").addEventListener("input", () => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            load();
        }, 300);
    });

    // =====================================
    // COLLECT CONTACT INFORMATION
    // =====================================

    function collect(container, key) {
        return Array.from(
            container.querySelectorAll("fieldset")
        ).map(group => {
            const row = {};

            if (group.dataset.recordId) {
                row[key] = Number(group.dataset.recordId);
            }

            group.querySelectorAll("input").forEach(input => {
                row[input.name] = input.value.trim();
            });

            return row;
        });
    }

    // =====================================
    // SAVE CUSTOMER CHANGES
    // =====================================

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (saving || !selected) {
            return;
        }

        // Expand any collapsed group containing invalid fields
        for (const input of form.querySelectorAll("input")) {
            if (!input.checkValidity()) {
                const group = input.closest(
                    ".customer-compact-group"
                );

                if (group) {
                    group.querySelector(
                        ".customer-compact-fields"
                    ).hidden = false;

                    group.classList.add("customer-expanded");
                }

                input.focus();
                input.reportValidity();
                return;
            }
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
    });

    load();
})();
