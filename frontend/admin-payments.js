
/* =========================================
   FIXTRACK - ADMIN PAYMENT MANAGEMENT
   File: frontend/admin-payments.js
   ========================================= */

// =====================================
// API CONFIGURATION
// =====================================

const BASE_API = "https://fixtrack-backend.vercel.app/api";

const REPAIRS_API = `${BASE_API}/repairs`;
const PAYMENTS_API = `${BASE_API}/payments`;

// =====================================
// AUTHENTICATION
// =====================================

const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

let currentUser = null;

try {
    currentUser = userData ? JSON.parse(userData) : null;
} catch (error) {
    console.error("Invalid user data:", error);
}

// =====================================
// DOM ELEMENTS
// =====================================

const historyBody = document.getElementById("paymentHistoryBody");
const message = document.getElementById("paymentsMessage");
const searchInput = document.getElementById("paymentSearch");
const refreshButton = document.getElementById("refreshPayments");

const collectedElement = document.getElementById("totalCollected");
const outstandingElement = document.getElementById("totalOutstanding");
const countElement = document.getElementById("transactionCount");

// =====================================
// DATA
// =====================================

let transactions = [];
let repairPayments = [];
let isLoading = false;

// =====================================
// FORMATTING
// =====================================

function formatMoney(value) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function setMessage(text, isError = false) {
    if (!message) return;

    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#64748b";
}

// =====================================
// API REQUEST
// =====================================

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed (HTTP ${response.status}).`
        );
    }

    return data;
}

// =====================================
// ELEMENT HELPERS
// =====================================

function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = String(value ?? "");
    return cell;
}

function createStatusBadge(status) {
    const badge = document.createElement("span");
    const normalized = String(status || "").toLowerCase();

    badge.className = "payments-status";
    badge.textContent = status || "Unknown";

    if (normalized === "completed") {
        badge.classList.add("completed");
    }

    if (normalized === "voided") {
        badge.classList.add("voided");
    }

    return badge;
}

function createActionButton(label, className, handler) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.className = className;

    button.addEventListener("click", handler);

    return button;
}

// =====================================
// PAYMENT TYPE
// =====================================

function isPayMongoPayment(payment) {
    const method = String(
        payment.payment_method || ""
    ).toLowerCase();

    return (
        payment.is_paymongo === true ||
        payment.is_paymongo === "true" ||
        method.includes("paymongo")
    );
}

function canModifyPayment(payment) {
    const status = String(
        payment.payment_status || ""
    ).toLowerCase();

    return (
        status === "completed" &&
        !isPayMongoPayment(payment)
    );
}

// =====================================
// SEARCH
// =====================================

function filterTransactions(query) {
    const search = String(query || "")
        .trim()
        .toLowerCase();

    if (!search) return transactions;

    return transactions.filter(payment => {
        const values = [
            payment.payment_id,
            payment.repair_id,
            payment.amount_paid,
            payment.payment_method,
            payment.payment_status,
            payment.checkout_session_id,
            formatDate(
                payment.payment_date ||
                payment.created_at
            )
        ];

        return values.some(value =>
            String(value ?? "")
                .toLowerCase()
                .includes(search)
        );
    });
}

// =====================================
// TRANSACTION DETAILS MODAL
// =====================================

function createDetailsModal() {
    let overlay = document.getElementById(
        "fixtrackPaymentDetailsOverlay"
    );

    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "fixtrackPaymentDetailsOverlay";

    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(15, 23, 42, 0.65)",
        display: "none",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "9999",
        padding: "20px",
        boxSizing: "border-box"
    });

    const modal = document.createElement("div");
    modal.id = "fixtrackPaymentDetailsModal";

    Object.assign(modal.style, {
        background: "#ffffff",
        color: "#0f172a",
        width: "100%",
        maxWidth: "520px",
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: "14px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
        padding: "26px",
        boxSizing: "border-box"
    });

    const header = document.createElement("div");

    Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "18px"
    });

    const title = document.createElement("h2");
    title.id = "fixtrackPaymentDetailsTitle";
    title.textContent = "Transaction Details";

    Object.assign(title.style, {
        margin: "0",
        fontSize: "21px",
        fontWeight: "700"
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute(
        "aria-label",
        "Close transaction details"
    );

    Object.assign(closeButton.style, {
        background: "#f1f5f9",
        border: "none",
        borderRadius: "8px",
        width: "36px",
        height: "36px",
        fontSize: "25px",
        cursor: "pointer",
        color: "#334155"
    });

    closeButton.addEventListener("click", closeDetailsModal);

    header.appendChild(title);
    header.appendChild(closeButton);

    const content = document.createElement("div");
    content.id = "fixtrackPaymentDetailsContent";

    modal.appendChild(header);
    modal.appendChild(content);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            closeDetailsModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            overlay.style.display !== "none"
        ) {
            closeDetailsModal();
        }
    });

    return overlay;
}

function closeDetailsModal() {
    const overlay = document.getElementById(
        "fixtrackPaymentDetailsOverlay"
    );

    if (overlay) {
        overlay.style.display = "none";
    }

    document.body.style.overflow = "";
}

function createDetailRow(label, value) {
    const row = document.createElement("div");

    Object.assign(row.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "18px",
        padding: "12px 0",
        borderBottom: "1px solid #e2e8f0"
    });

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    Object.assign(labelElement.style, {
        color: "#64748b",
        fontSize: "13px",
        flexShrink: "0"
    });

    const valueElement = document.createElement("span");
    valueElement.textContent = String(value ?? "N/A");

    Object.assign(valueElement.style, {
        color: "#0f172a",
        fontSize: "13px",
        fontWeight: "600",
        textAlign: "right",
        overflowWrap: "anywhere"
    });

    row.appendChild(labelElement);
    row.appendChild(valueElement);

    return row;
}

function createDetailsSection(titleText) {
    const heading = document.createElement("h3");
    heading.textContent = titleText;

    Object.assign(heading.style, {
        margin: "22px 0 8px",
        fontSize: "14px",
        color: "#2563eb",
        fontWeight: "700"
    });

    return heading;
}

function viewPaymentDetails(payment) {
    const overlay = createDetailsModal();

    const title = document.getElementById(
        "fixtrackPaymentDetailsTitle"
    );

    const content = document.getElementById(
        "fixtrackPaymentDetailsContent"
    );

    title.textContent =
        `Transaction #${payment.payment_id}`;

    content.replaceChildren();

    const isGateway = isPayMongoPayment(payment);

    const typeLabel = isGateway
        ? "PayMongo Online Payment"
        : "Manual Payment";

    content.appendChild(
        createDetailsSection("Payment Information")
    );

    content.appendChild(
        createDetailRow(
            "Transaction ID",
            `#${payment.payment_id}`
        )
    );

    content.appendChild(
        createDetailRow(
            "Repair ID",
            `#${payment.repair_id}`
        )
    );

    content.appendChild(
        createDetailRow(
            "Payment Type",
            typeLabel
        )
    );

    content.appendChild(
        createDetailRow(
            "Payment Method",
            payment.payment_method || "Unknown"
        )
    );

    content.appendChild(
        createDetailRow(
            "Amount",
            formatMoney(payment.amount_paid)
        )
    );

    content.appendChild(
        createDetailRow(
            "Status",
            payment.payment_status || "Unknown"
        )
    );

    content.appendChild(
        createDetailRow(
            "Payment Date",
            formatDate(
                payment.payment_date ||
                payment.created_at
            )
        )
    );

    if (payment.created_at) {
        content.appendChild(
            createDetailRow(
                "Record Created",
                formatDate(payment.created_at)
            )
        );
    }

    if (isGateway) {
        content.appendChild(
            createDetailsSection("PayMongo Information")
        );

        content.appendChild(
            createDetailRow(
                "Gateway",
                "PayMongo"
            )
        );

        content.appendChild(
            createDetailRow(
                "Mode",
                "Test Mode"
            )
        );

        if (payment.checkout_session_id) {
            content.appendChild(
                createDetailRow(
                    "Checkout Session ID",
                    payment.checkout_session_id
                )
            );
        }

        if (payment.paymongo_source_id) {
            content.appendChild(
                createDetailRow(
                    "Gateway Payment ID",
                    payment.paymongo_source_id
                )
            );
        }

        const note = document.createElement("p");

        note.textContent =
            "This payment was recorded through PayMongo. " +
            "Gateway-linked payments cannot be manually edited " +
            "or voided in FixTrack.";

        Object.assign(note.style, {
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "8px",
            padding: "13px",
            color: "#1d4ed8",
            fontSize: "12px",
            lineHeight: "1.6",
            marginTop: "18px"
        });

        content.appendChild(note);
    }

    if (
        String(payment.payment_status).toLowerCase() ===
        "voided"
    ) {
        const note = document.createElement("p");

        note.textContent =
            "This transaction was voided and is excluded " +
            "from the total collected amount.";

        Object.assign(note.style, {
            background: "#f1f5f9",
            borderRadius: "8px",
            padding: "13px",
            color: "#475569",
            fontSize: "12px",
            marginTop: "18px"
        });

        content.appendChild(note);
    }

    const footer = document.createElement("div");

    Object.assign(footer.style, {
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "22px"
    });

    const closeButton = createActionButton(
        "Close",
        "payment-details-close-btn",
        closeDetailsModal
    );

    Object.assign(closeButton.style, {
        background: "#2563eb",
        color: "#ffffff",
        border: "none",
        borderRadius: "8px",
        padding: "11px 24px",
        fontWeight: "600",
        cursor: "pointer"
    });

    footer.appendChild(closeButton);
    content.appendChild(footer);

    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

// =====================================
// EDIT MANUAL PAYMENT
// =====================================

async function editPayment(payment) {
    if (!canModifyPayment(payment)) {
        alert("Only completed manual payments can be edited.");
        return;
    }

    const amountInput = prompt(
        `Correct amount for Payment #${payment.payment_id}:`,
        payment.amount_paid
    );

    if (amountInput === null) return;

    const amount = Number(amountInput);

    if (
        !amountInput.trim() ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Math.abs(
            amount * 100 - Math.round(amount * 100)
        ) > 0.000001
    ) {
        alert(
            "Enter a valid positive amount with at most two decimal places."
        );
        return;
    }

    const methodInput = prompt(
        "Correct payment method:",
        payment.payment_method || "Cash"
    );

    if (methodInput === null) return;

    const method = methodInput.trim();

    if (
        !method ||
        method.length > 100 ||
        /paymongo/i.test(method)
    ) {
        alert("Enter a valid manual payment method.");
        return;
    }

    const reasonInput = prompt(
        "Reason for correcting this payment (minimum 5 characters):"
    );

    if (reasonInput === null) return;

    const reason = reasonInput.trim();

    if (reason.length < 5 || reason.length > 1000) {
        alert("The reason must contain 5 to 1000 characters.");
        return;
    }

    const confirmed = confirm(
        `Correct Payment #${payment.payment_id}?\n\n` +
        `Old amount: ${formatMoney(payment.amount_paid)}\n` +
        `New amount: ${formatMoney(amount)}\n` +
        `New method: ${method}\n\n` +
        `Reason: ${reason}`
    );

    if (!confirmed) return;

    try {
        setMessage("Updating payment...");

        await apiRequest(
            `${PAYMENTS_API}/transaction/${payment.payment_id}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    amount_paid: amount,
                    payment_method: method,
                    reason
                })
            }
        );

        alert("Payment corrected successfully.");
        await loadPayments();

    } catch (error) {
        console.error("Edit payment error:", error);
        setMessage(error.message, true);
        alert(error.message);
    }
}

// =====================================
// VOID MANUAL PAYMENT
// =====================================

async function voidPayment(payment) {
    if (!canModifyPayment(payment)) {
        alert("Only completed manual payments can be voided.");
        return;
    }

    const reasonInput = prompt(
        `Why are you voiding Payment #${payment.payment_id}?`
    );

    if (reasonInput === null) return;

    const reason = reasonInput.trim();

    if (reason.length < 5 || reason.length > 1000) {
        alert("The reason must contain 5 to 1000 characters.");
        return;
    }

    const confirmed = confirm(
        `Void Payment #${payment.payment_id}?\n\n` +
        `Amount: ${formatMoney(payment.amount_paid)}\n` +
        `Method: ${payment.payment_method || "Unknown"}\n\n` +
        `This will exclude the payment from collected totals.\n` +
        `The transaction will remain in history.\n\n` +
        `Reason: ${reason}`
    );

    if (!confirmed) return;

    try {
        setMessage("Voiding payment...");

        await apiRequest(
            `${PAYMENTS_API}/transaction/${payment.payment_id}/void`,
            {
                method: "POST",
                body: JSON.stringify({ reason })
            }
        );

        alert("Payment voided successfully.");
        await loadPayments();

    } catch (error) {
        console.error("Void payment error:", error);
        setMessage(error.message, true);
        alert(error.message);
    }
}

// =====================================
// AUDIT HISTORY
// MANUAL PAYMENTS ONLY
// =====================================

async function viewAuditHistory(payment) {
    if (isPayMongoPayment(payment)) {
        viewPaymentDetails(payment);
        return;
    }

    try {
        const result = await apiRequest(
            `${PAYMENTS_API}/transaction/${payment.payment_id}/audit`
        );

        const logs = result.audit_logs || [];

        if (!logs.length) {
            alert(
                "No corrections or void actions recorded for this payment."
            );
            return;
        }

        const history = logs.map(log => (
            `Action: ${log.action}\n` +
            `Date: ${formatDate(log.created_at)}\n` +
            `Admin ID: ${log.admin_user_id}\n` +
            `Old amount: ${formatMoney(log.old_amount)}\n` +
            `New amount: ${formatMoney(log.new_amount)}\n` +
            `Old method: ${log.old_method || "N/A"}\n` +
            `New method: ${log.new_method || "N/A"}\n` +
            `Old status: ${log.old_status || "N/A"}\n` +
            `New status: ${log.new_status || "N/A"}\n` +
            `Reason: ${log.reason}`
        )).join("\n\n--------------------\n\n");

        alert(
            `Payment #${payment.payment_id} Audit History\n\n${history}`
        );

    } catch (error) {
        console.error("Audit history error:", error);
        alert(error.message);
    }
}

// =====================================
// RENDER TRANSACTIONS
// =====================================

function renderTransactions(query = "") {
    if (!historyBody) return;

    historyBody.replaceChildren();

    const filteredPayments = filterTransactions(query);

    const table = historyBody.closest("table");
    const headerRow = table?.querySelector("thead tr");

    if (
        headerRow &&
        !headerRow.querySelector(".payment-actions-heading") &&
        !Array.from(headerRow.children).some(
            cell =>
                cell.textContent.trim().toLowerCase() ===
                "actions"
        )
    ) {
        const heading = document.createElement("th");
        heading.textContent = "Actions";
        heading.className = "payment-actions-heading";
        headerRow.appendChild(heading);
    }

    if (filteredPayments.length === 0) {
        const row = document.createElement("tr");

        const emptyCell = createCell(
            "No matching payment transactions found."
        );

        emptyCell.colSpan = 7;
        emptyCell.className = "payments-empty";

        row.appendChild(emptyCell);
        historyBody.appendChild(row);

        return;
    }

    filteredPayments.forEach(payment => {
        const row = document.createElement("tr");

        row.appendChild(
            createCell(`#${payment.payment_id}`)
        );

        row.appendChild(
            createCell(`#${payment.repair_id}`)
        );

        row.appendChild(
            createCell(formatMoney(payment.amount_paid))
        );

        row.appendChild(
            createCell(payment.payment_method || "Unknown")
        );

        const statusCell = document.createElement("td");

        statusCell.appendChild(
            createStatusBadge(payment.payment_status)
        );

        row.appendChild(statusCell);

        row.appendChild(
            createCell(
                formatDate(
                    payment.payment_date ||
                    payment.created_at
                )
            )
        );

        // =====================================
        // ACTIONS
        // =====================================

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "payment-actions";

        actions.style.display = "flex";
        actions.style.flexWrap = "wrap";
        actions.style.gap = "6px";

        // Every transaction can be inspected.
        const detailsButton = createActionButton(
            "View Details",
            "payment-details-btn",
            () => viewPaymentDetails(payment)
        );

        Object.assign(detailsButton.style, {
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer"
        });

        actions.appendChild(detailsButton);

        // Only completed manual payments
        // can be edited or voided.
        if (canModifyPayment(payment)) {
            actions.appendChild(
                createActionButton(
                    "Edit",
                    "payment-edit-btn",
                    () => editPayment(payment)
                )
            );

            actions.appendChild(
                createActionButton(
                    "Void",
                    "payment-void-btn",
                    () => voidPayment(payment)
                )
            );
        }

        // Audit remains available for
        // manual payments only.
        if (!isPayMongoPayment(payment)) {
            actions.appendChild(
                createActionButton(
                    "Audit",
                    "payment-audit-btn",
                    () => viewAuditHistory(payment)
                )
            );
        }

        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);

        historyBody.appendChild(row);
    });
}

// =====================================
// UPDATE PAYMENT STATISTICS
// =====================================

function updatePaymentStatistics() {
    const completedPayments = transactions.filter(payment =>
        String(
            payment.payment_status || ""
        ).toLowerCase() === "completed"
    );

    const totalCollected = completedPayments.reduce(
        (total, payment) =>
            total + (Number(payment.amount_paid) || 0),
        0
    );

    const totalOutstanding = repairPayments.reduce(
        (total, repair) =>
            total + Math.max(
                0,
                Number(repair.remaining_balance) || 0
            ),
        0
    );

    if (collectedElement) {
        collectedElement.textContent =
            formatMoney(totalCollected);
    }

    if (outstandingElement) {
        outstandingElement.textContent =
            formatMoney(totalOutstanding);
    }

    if (countElement) {
        countElement.textContent =
            String(completedPayments.length);
    }
}

// =====================================
// LOAD ALL REPAIR PAYMENTS
// =====================================

async function loadPayments() {
    if (isLoading) return;

    isLoading = true;

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
    }

    setMessage("Loading payment records...");

    try {
        const repairs = await apiRequest(
            `${REPAIRS_API}/admin`
        );

        if (!Array.isArray(repairs)) {
            throw new Error(
                "Invalid repair list response."
            );
        }

        const results = await Promise.allSettled(
            repairs.map(repair =>
                apiRequest(
                    `${PAYMENTS_API}/${repair.repair_id}`
                )
            )
        );

        const nextTransactions = [];
        const nextRepairPayments = [];
        const failedRequests = [];

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                failedRequests.push(result.reason);
                return;
            }

            const data = result.value;
            const repairId = repairs[index].repair_id;

            nextRepairPayments.push({
                repair_id: repairId,
                total_amount:
                    Number(data.total_amount) || 0,
                total_paid:
                    Number(data.total_paid) || 0,
                remaining_balance:
                    Number(data.remaining_balance) || 0,
                payment_status:
                    data.payment_status || "Unpaid"
            });

            if (Array.isArray(data.payments)) {
                data.payments.forEach(payment => {
                    nextTransactions.push({
                        ...payment,
                        repair_id:
                            payment.repair_id ?? repairId
                    });
                });
            }
        });

        // Remove duplicate transactions.
        const uniqueTransactions = new Map();

        nextTransactions.forEach(payment => {
            uniqueTransactions.set(
                String(payment.payment_id),
                payment
            );
        });

        transactions = Array.from(
            uniqueTransactions.values()
        );

        repairPayments = nextRepairPayments;

        transactions.sort((a, b) => {
            const dateA = new Date(
                a.payment_date ||
                a.created_at ||
                0
            );

            const dateB = new Date(
                b.payment_date ||
                b.created_at ||
                0
            );

            return dateB - dateA;
        });

        updatePaymentStatistics();

        renderTransactions(
            searchInput?.value || ""
        );

        if (
            failedRequests.length === repairs.length &&
            repairs.length > 0
        ) {
            setMessage(
                failedRequests[0]?.message ||
                "Unable to load payment records.",
                true
            );

        } else if (failedRequests.length > 0) {
            setMessage(
                `${transactions.length} transaction(s) loaded. ` +
                `${failedRequests.length} repair(s) could not be checked.`,
                true
            );

        } else {
            setMessage(
                `${transactions.length} payment transaction(s) found.`
            );
        }

    } catch (error) {
        console.error(
            "Payment management error:",
            error
        );

        setMessage(error.message, true);

    } finally {
        isLoading = false;

        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "Refresh";
        }
    }
}

// =====================================
// INITIALIZE
// =====================================

function initializeAdminPayments() {
    if (
        !token ||
        !currentUser ||
        currentUser.role !== "admin"
    ) {
        window.location.replace("index.html");
        return;
    }

    createDetailsModal();

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadPayments
        );
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderTransactions(searchInput.value);
        });
    }

    loadPayments();
}

// =====================================
// START
// =====================================

initializeAdminPayments();
