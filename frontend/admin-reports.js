
"use strict";

(() => {
    const API = "https://fixtrack-backend.vercel.app/api/reports";
    const token = localStorage.getItem("fixtrack_token");

    let user = null;

    try {
        user = JSON.parse(localStorage.getItem("fixtrack_user"));
    } catch (_) {}

    if (!token || !user) {
        location.replace("index.html");
        return;
    }

    if (user.role !== "admin") {
        location.replace(
            user.role === "technician"
                ? "technician-dashboard.html"
                : "dashboard.html"
        );
        return;
    }

    const el = id => document.getElementById(id);

    const formatNumber = value =>
        Number(value || 0).toLocaleString("en-PH");

    const formatMoney = value =>
        new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP"
        }).format(Number(value || 0));

    let report = null;
    let loading = false;

    function setMessage(text, isError = false) {
        const target = el("reports-message");
        target.textContent = text;
        target.classList.toggle("error", isError);
    }

    function renderEmptyTable(id, colspan, text) {
        const tbody = el(id);
        tbody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = colspan;
        cell.textContent = text;

        row.append(cell);
        tbody.append(row);
    }

    function clearDisplay() {
        const statIds = [
            "stat-total-repairs",
            "stat-completed-repairs",
            "stat-total-revenue",
            "stat-total-customers",
            "stat-open-repairs",
            "stat-active-technicians",
            "stat-registered-devices",
            "stat-low-stock",
            "stat-labor-entries",
            "stat-labor-charges"
        ];

        statIds.forEach(id => {
            el(id).textContent = "—";
        });

        [
            "chart-repair-status",
            "chart-monthly-revenue",
            "chart-monthly-repairs",
            "chart-payment-status"
        ].forEach(id => {
            el(id).replaceChildren();
        });

        renderEmptyTable(
            "reports-technicians", 6, "Report unavailable."
        );

        renderEmptyTable(
            "reports-inventory", 6, "Report unavailable."
        );

        renderEmptyTable(
            "reports-customers", 4, "Report unavailable."
        );

        el("reports-generated-at").textContent = "";
    }

    // =====================================
    // RENDER REPORT TABLES
    // =====================================

    function renderTable(id, rows, columns) {
        const tbody = el(id);
        tbody.replaceChildren();

        if (!Array.isArray(rows) || !rows.length) {
            renderEmptyTable(
                id,
                columns.length,
                "No records found."
            );
            return;
        }

        for (const record of rows) {
            const row = document.createElement("tr");

            for (const column of columns) {
                const cell = document.createElement("td");

                if (column.badge) {
                    const badge = document.createElement("span");
                    const value = String(
                        record[column.key] ?? "Unknown"
                    );

                    badge.className = "reports-badge";

                    if (value === "Low Stock") {
                        badge.classList.add("low");
                    } else if (value === "Out of Stock") {
                        badge.classList.add("out");
                    } else if (value === "In Stock") {
                        badge.classList.add("good");
                    }

                    badge.textContent = value;
                    cell.append(badge);
                } else {
                    const value = record[column.key];

                    cell.textContent = column.money
                        ? formatMoney(value)
                        : column.number
                            ? formatNumber(value)
                            : String(value ?? "—");
                }

                row.append(cell);
            }

            tbody.append(row);
        }
    }

    // =====================================
    // RENDER CHARTS
    // =====================================

    function renderBars(
        id,
        rows,
        labelKey,
        valueKey,
        money = false
    ) {
        const target = el(id);
        target.replaceChildren();

        if (!Array.isArray(rows) || !rows.length) {
            const empty = document.createElement("p");
            empty.className = "reports-empty";
            empty.textContent = "No data available yet.";
            target.append(empty);
            return;
        }

        const max = Math.max(
            0,
            ...rows.map(row => Number(row[valueKey]) || 0)
        );

        for (const item of rows) {
            const value = Math.max(
                0,
                Number(item[valueKey]) || 0
            );

            const label = String(
                item[labelKey] ?? "Unknown"
            );

            const row = document.createElement("div");
            row.className = "reports-bar-row";

            const title = document.createElement("span");
            title.className = "reports-bar-label";
            title.title = label;
            title.textContent = label;

            const track = document.createElement("div");
            track.className = "reports-bar-track";
            track.setAttribute("role", "img");
            track.setAttribute(
                "aria-label",
                `${label}: ${
                    money
                        ? formatMoney(value)
                        : formatNumber(value)
                }`
            );

            const fill = document.createElement("div");
            fill.className = "reports-bar-fill";

            fill.style.width =
                `${max > 0 ? (value / max) * 100 : 0}%`;

            track.append(fill);

            const amount = document.createElement("span");
            amount.className = "reports-bar-value";

            amount.textContent = money
                ? formatMoney(value)
                : formatNumber(value);

            row.append(title, track, amount);
            target.append(row);
        }
    }

    // =====================================
    // DISPLAY DATABASE RESULTS
    // =====================================

    function render(data) {
        const summary = data.summary || {};

        const stats = {
            "stat-total-repairs":
                formatNumber(summary.total_repairs),

            "stat-completed-repairs":
                formatNumber(summary.completed_repairs),

            "stat-total-revenue":
                formatMoney(summary.total_revenue),

            "stat-total-customers":
                formatNumber(summary.total_customers),

            "stat-open-repairs":
                formatNumber(summary.open_repairs),

            "stat-active-technicians":
                formatNumber(summary.active_technicians),

            "stat-registered-devices":
                formatNumber(summary.registered_devices),

            "stat-low-stock":
                formatNumber(summary.low_stock_parts),

            "stat-labor-entries":
                formatNumber(data.labor?.total_labor_entries),

            "stat-labor-charges":
                formatMoney(data.labor?.total_labor_charges)
        };

        for (const [id, value] of Object.entries(stats)) {
            el(id).textContent = value;
        }

        renderBars(
            "chart-repair-status",
            data.repair_statuses,
            "status",
            "total"
        );

        renderBars(
            "chart-monthly-revenue",
            data.monthly_revenue,
            "month",
            "revenue",
            true
        );

        renderBars(
            "chart-monthly-repairs",
            data.monthly_repairs,
            "month",
            "total"
        );

        renderBars(
            "chart-payment-status",
            data.payment_statuses,
            "status",
            "total"
        );

        renderTable(
            "reports-technicians",
            data.technicians,
            [
                { key: "technician_name" },
                { key: "specialization" },
                { key: "status" },
                { key: "assigned_repairs", number: true },
                { key: "completed_repairs", number: true },
                { key: "open_repairs", number: true }
            ]
        );

        renderTable(
            "reports-inventory",
            data.inventory,
            [
                { key: "part_name" },
                { key: "stock_quantity", number: true },
                { key: "unit_price", money: true },
                { key: "stock_value", money: true },
                { key: "units_used", number: true },
                { key: "stock_status", badge: true }
            ]
        );

        renderTable(
            "reports-customers",
            data.customers,
            [
                { key: "customer_name" },
                { key: "email" },
                { key: "total_devices", number: true },
                { key: "total_repairs", number: true }
            ]
        );

        const generated = new Date(data.generated_at);

        el("reports-generated-at").textContent =
            Number.isNaN(generated.getTime())
                ? ""
                : ` • Updated ${generated.toLocaleString("en-PH")}`;
    }

    // =====================================
    // FETCH LIVE REPORTS
    // =====================================

    async function loadReports() {
        if (loading) return;

        loading = true;
        report = null;

        const refresh = el("reports-refresh");
        refresh.disabled = true;

        setMessage("Loading reports...");

        try {
            const response = await fetch(API, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            let data;

            try {
                data = await response.json();
            } catch (_) {
                throw new Error(
                    `Server returned HTTP ${response.status} instead of report data.`
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Unable to load reports (HTTP ${response.status}).`
                );
            }

            if (!data || !data.summary) {
                throw new Error(
                    "Reports API returned an unexpected response."
                );
            }

            report = data;
            render(data);

            setMessage("Reports loaded successfully.");

        } catch (error) {
            clearDisplay();

            setMessage(
                error.message || "Unable to load reports.",
                true
            );

        } finally {
            loading = false;
            refresh.disabled = false;
        }
    }

    // =====================================
    // CSV EXPORT
    // =====================================

    function escapeCSV(value) {
        const text = String(value ?? "");

        // Prevent spreadsheet formula execution.
        const safe = /^[=+@\-\t\r]/.test(text)
            ? "'" + text
            : text;

        return `"${safe.replace(/"/g, '""')}"`;
    }

    const exports = {
        technicians: {
            headers: [
                "Technician",
                "Specialization",
                "Status",
                "Assigned",
                "Completed",
                "Open"
            ],
            fields: [
                "technician_name",
                "specialization",
                "status",
                "assigned_repairs",
                "completed_repairs",
                "open_repairs"
            ]
        },

        inventory: {
            headers: [
                "Part",
                "Stock",
                "Unit Price",
                "Stock Value",
                "Units Used",
                "Status"
            ],
            fields: [
                "part_name",
                "stock_quantity",
                "unit_price",
                "stock_value",
                "units_used",
                "stock_status"
            ]
        },

        customers: {
            headers: [
                "Customer",
                "Email",
                "Devices",
                "Repair Requests"
            ],
            fields: [
                "customer_name",
                "email",
                "total_devices",
                "total_repairs"
            ]
        }
    };

    function exportCSV(type) {
        if (!report) {
            setMessage(
                "Load reports successfully before exporting.",
                true
            );
            return;
        }

        const config = exports[type];
        if (!config) return;

        const rows = Array.isArray(report[type])
            ? report[type]
            : [];

        const lines = [
            config.headers.map(escapeCSV).join(","),
            ...rows.map(record =>
                config.fields
                    .map(field => escapeCSV(record[field]))
                    .join(",")
            )
        ];

        const blob = new Blob(
            ["\uFEFF", lines.join("\r\n")],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download =
            `fixtrack-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

        document.body.append(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    // =====================================
    // BUTTON EVENTS
    // =====================================

    el("reports-refresh").addEventListener(
        "click",
        loadReports
    );

    document.querySelectorAll("[data-export]").forEach(button => {
        button.addEventListener("click", () => {
            exportCSV(button.dataset.export);
        });
    });

    // INITIAL LOAD
    loadReports();
})();
