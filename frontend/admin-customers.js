
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

    // Custom validation handles collapsed fields.
    form.noValidate = true;

    const fullName = customer =>
        [
            customer.first_name,
            customer.middle_name,
            customer.last_name
        ].filter(Boolean).join(" ");

    const date = value => {
        if (!value) return "Not provided";

        const parsed = new Date(value);

        return Number.isNaN(parsed.getTime())
            ? "Not provided"
            : parsed.toLocaleDateString();
    };

    function node(tag, content, className) {
        const element = document.createElement(tag);

        if (content !== undefined) {
            element.textContent = content;
        }

        if (className) {
            element.className = className;
        }

        return element;
    }

    function message(target, content, error = false) {
        target.textContent = content;
        target.classList.toggle("customer-error", error);
    }

    async function request(path = "", options = {}) {
        const response = await fetch(API + path, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error("Unexpected server response.");
        }

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to complete request."
            );
        }

        return data;
    }

    // ==========================================
    // CUSTOMER TABLE
    // ==========================================

    async function load(success = "") {
        const version = ++listRequest;
        const tbody = el("customer-rows");

        tbody.replaceChildren();
        tbody.setAttribute("aria-busy", "true");

        message(el("customer-message"), "Loading customers...");

        try {
            const search = el("customer-search").value.trim();

            const customers = await request(
                `?search=${encodeURIComponent(search)}`
            );

            if (version !== listRequest) return;

            for (const customer of customers) {
                const tr = node("tr");

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
                    tr.append(node("td", String(value ?? "")));
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

                tr.append(actions);
                tbody.append(tr);
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
                tbody.removeAttribute("aria-busy");
            }
        }
    }

    // ==========================================
    // MODERN EDITABLE CONTACT CARDS
    // ==========================================

    const phoneFields = [
        ["phone_number", "Contact Number", 30, true],
        ["type", "Type (optional)", 50, false]
    ];

    const addressFields = [
        ["street_address", "Street Address", 255, false],
        ["city", "City", 100, false],
        ["province", "Province", 100, false],
        ["postal_code", "Postal Code", 20, false]
    ];

    function makeIcon(name) {
        const icons = {
            edit: "✎",
            remove: "×",
            phone: "☎",
            address: "⌖"
        };

        const span = node(
            "span",
            icons[name] || "",
            "customer-ui-icon"
        );

        span.setAttribute("aria-hidden", "true");

        return span;
    }

    function makeAction(label, iconName, className) {
        const button = node(
            "button",
            undefined,
            className
        );

        button.type = "button";
        button.title = label;
        button.setAttribute("aria-label", label);

        button.append(makeIcon(iconName));

        return button;
    }

    function makeContactCard(
        container,
        data,
        definitions,
        idKey
    ) {
        const isPhone = idKey === "phone_id";
        const existing = data[idKey] != null;

        const card = node(
            "fieldset",
            undefined,
            "customer-modern-card"
        );

        if (existing) {
            card.dataset.recordId = String(data[idKey]);
        }

        const header = node(
            "div",
            undefined,
            "customer-modern-card-header"
        );

        const identity = node(
            "div",
            undefined,
            "customer-modern-card-identity"
        );

        const symbol = node(
            "span",
            undefined,
            "customer-modern-card-symbol"
        );

        symbol.append(
            makeIcon(isPhone ? "phone" : "address")
        );

        const summary = node(
            "div",
            undefined,
            "customer-modern-card-summary"
        );

        const primary = node(
            "div",
            "",
            "customer-modern-card-primary"
        );

        const secondary = node(
            "div",
            "",
            "customer-modern-card-secondary"
        );

        summary.append(primary, secondary);
        identity.append(symbol, summary);

        const actions = node(
            "div",
            undefined,
            "customer-modern-card-actions"
        );

        const editButton = makeAction(
            "Edit",
            "edit",
            "customer-modern-icon-button"
        );

        const removeButton = makeAction(
            "Remove",
            "remove",
            "customer-modern-icon-button customer-modern-delete"
        );

        actions.append(editButton, removeButton);
        header.append(identity, actions);

        const fields = node(
            "div",
            undefined,
            "customer-modern-card-fields"
        );

        const inputs = {};

        for (const [name, label, max, required] of definitions) {
            const wrapper = node("label", label);
            const input = node("input");

            input.name = name;
            input.maxLength = max;
            input.required = Boolean(required);
            input.value = data[name] || "";
            input.autocomplete = "off";

            if (name === "phone_number") {
                input.type = "tel";
            }

            inputs[name] = input;

            wrapper.append(input);
            fields.append(wrapper);
        }

        const fieldActions = node(
            "div",
            undefined,
            "customer-modern-field-actions"
        );

        const doneButton = node(
            "button",
            "Done",
            "customer-modern-done"
        );

        doneButton.type = "button";
        fieldActions.append(doneButton);
        fields.append(fieldActions);

        function updateSummary() {
            if (isPhone) {
                primary.textContent =
                    inputs.phone_number.value.trim() ||
                    "New Contact Number";

                secondary.textContent =
                    inputs.type.value.trim() || "";
            } else {
                const street =
                    inputs.street_address.value.trim();

                const rest = [
                    inputs.city.value.trim(),
                    inputs.province.value.trim(),
                    inputs.postal_code.value.trim()
                ].filter(Boolean).join(", ");

                primary.textContent =
                    street || rest || "New Address";

                secondary.textContent =
                    street ? rest : "";
            }
        }

        function expand(open, focus = true) {
            fields.hidden = !open;
            card.classList.toggle(
                "customer-modern-expanded",
                open
            );

            editButton.setAttribute(
                "aria-expanded",
                String(open)
            );

            editButton.title = open
                ? "Close editor"
                : "Edit";

            if (open && focus) {
                fields.querySelector("input")?.focus();
            }
        }

        editButton.addEventListener("click", () => {
            if (saving) return;

            expand(fields.hidden);
        });

        doneButton.addEventListener("click", () => {
            if (saving) return;

            for (const input of Object.values(inputs)) {
                if (!input.checkValidity()) {
                    input.reportValidity();
                    input.focus();
                    return;
                }
            }

            updateSummary();
            expand(false, false);
        });

        removeButton.addEventListener("click", () => {
            if (saving) return;

            // Only removes it from the form.
            // Database changes happen on Save Changes.
            card.remove();

            message(
                el("customer-dialog-message"),
                "Unsaved changes. Click Save Changes to apply."
            );
        });

        for (const input of Object.values(inputs)) {
            input.addEventListener("input", updateSummary);
        }

        card.append(header, fields);
        container.append(card);

        updateSummary();
        expand(!existing, false);

        if (!existing) {
            requestAnimationFrame(() => {
                card.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });

                fields.querySelector("input")?.focus({
                    preventScroll: true
                });
            });
        }

        return card;
    }

    function addPhone(data = {}) {
        return makeContactCard(
            el("customer-phone-fields"),
            data,
            phoneFields,
            "phone_id"
        );
    }

    function addAddress(data = {}) {
        return makeContactCard(
            el("customer-address-fields"),
            data,
            addressFields,
            "address_id"
        );
    }

    // ==========================================
    // CUSTOMER DETAILS
    // ==========================================

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

            detailRow(card, "Problem", repair.problem_description);
            detailRow(card, "Submitted", date(repair.date_submitted));
            detailRow(card, "Completed", date(repair.date_completed));

            target.append(card);
        });
    }

    // ==========================================
    // OPEN CUSTOMER
    // ==========================================

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

    // ==========================================
    // CLOSE / CANCEL
    // ==========================================

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

        // Discard all unsaved form changes.
        form.reset();
        el("customer-phone-fields").replaceChildren();
        el("customer-address-fields").replaceChildren();

        if (returnFocus?.isConnected) {
            returnFocus.focus();
        } else {
            el("customer-search").focus();
        }
    });

    // ==========================================
    // ADD BUTTONS
    // ==========================================

    el("customer-add-phone").addEventListener("click", () => {
        if (saving || !selected || form.hidden) return;

        addPhone();
    });

    el("customer-add-address").addEventListener("click", () => {
        if (saving || !selected || form.hidden) return;

        addAddress();
    });

    // ==========================================
    // SEARCH / REFRESH
    // ==========================================

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

    // ==========================================
    // COLLECT PHONE / ADDRESS DATA
    // ==========================================

    function collect(container, key) {
        return Array.from(
            container.querySelectorAll(".customer-modern-card")
        ).map(card => {
            const row = {};

            if (card.dataset.recordId) {
                row[key] = Number(card.dataset.recordId);
            }

            card.querySelectorAll("input").forEach(input => {
                row[input.name] = input.value.trim();
            });

            return row;
        });
    }

    // ==========================================
    // FORM VALIDATION
    // ==========================================

    function validateForm() {
        const inputs = form.querySelectorAll("input");

        for (const input of inputs) {
            if (!input.checkValidity()) {
                const card = input.closest(
                    ".customer-modern-card"
                );

                if (card) {
                    const fields = card.querySelector(
                        ".customer-modern-card-fields"
                    );

                    fields.hidden = false;
                    card.classList.add(
                        "customer-modern-expanded"
                    );
                }

                input.focus();
                input.reportValidity();

                return false;
            }
        }

        return true;
    }

    // ==========================================
    // SAVE CUSTOMER
    // ==========================================

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (saving || !selected) return;

        if (!validateForm()) return;

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
