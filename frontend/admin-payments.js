
/* =========================================
   FIXTRACK - ADMIN PAYMENT MANAGEMENT
   File: frontend/admin-payments.js
   ========================================= */

// =====================================
// VERCEL BACKEND API
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
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
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
// CREATE ELEMENTS
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
// CHECK PAYMENT ELIGIBILITY
// =====================================

function canModifyPayment(payment) {
    const status = String(
        payment.payment_status || ""
    ).toLowerCase();

    const method = String(
        payment.payment_method || ""
    ).toLowerCase();

    return (
        status === "completed" &&
        payment.is_paymongo !== true &&
        payment.is_paymongo !== "true" &&
        !method.includes("paymongo")
    );
}

// =====================================
// SEARCH TRANSACTIONS
// =====================================

function filterTransactions(query) {
    const search = String(query || "").trim().toLowerCase();

    if (!search) return transactions;

    return transactions.filter(payment => {
        const values = [
            payment.payment_id,
            payment.repair_id,
            payment.amount_paid,
            payment.payment_method,
            payment.payment_status,
            formatDate(payment.payment_date || payment.created_at)
        ];

        return values.some(value =>
            String(value ?? "").toLowerCase().includes(search)
        );
    });
}

// =====================================
// EDIT PAYMENT
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
        !Number.isInteger(Math.round(amount * 100)) ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
    ) {
        alert("Enter a valid positive amount with at most two decimal places.");
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
// VOID PAYMENT
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
// VIEW PAYMENT AUDIT HISTORY
// =====================================

async function viewAuditHistory(payment) {
    try {
        const result = await apiRequest(
            `${PAYMENTS_API}/transaction/${payment.payment_id}/audit`
        );

        const logs = result.audit_logs || [];

        if (!logs.length) {
            alert("No corrections or void actions recorded.");
            return;
        }

        const history = logs.map(log => {
            return (
                `Action: ${log.action}\n` +
                `Date: ${formatDate(log.created_at)}\n` +
                `Admin ID: ${log.admin_user_id}\n` +
                `Old amount: ${formatMoney(log.old_amount)}\n` +
                `New amount: ${formatMoney(log.new_amount)}\n` +
                `Old method: ${log.old_method || "N/A"}\n` +
                `New method: ${log.new_method || "N/A"}\n` +
                `Reason: ${log.reason}`
            );
        }).join("\n\n--------------------\n\n");

        alert(`Payment #${payment.payment_id} Audit History\n\n${history}`);

    } catch (error) {
        console.error("Audit history error:", error);
        alert(error.message);
    }
}

// =====================================
// RENDER TRANSACTION TABLE
// =====================================

function renderTransactions(query = "") {
    if (!historyBody) return;

    historyBody.replaceChildren();

    const filteredPayments = filterTransactions(query);

    // Add Actions column if not already present.
    const table = historyBody.closest("table");
    const headerRow = table?.querySelector("thead tr");

    if (headerRow && !headerRow.querySelector(".payment-actions-heading")) {
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

        // PAYMENT ACTIONS
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "payment-actions";

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

        actions.appendChild(
            createActionButton(
                "Audit",
                "payment-audit-btn",
                () => viewAuditHistory(payment)
            )
        );

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
        String(payment.payment_status || "").toLowerCase() ===
        "completed"
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
        collectedElement.textContent = formatMoney(totalCollected);
    }

    if (outstandingElement) {
        outstandingElement.textContent = formatMoney(totalOutstanding);
    }

    if (countElement) {
        countElement.textContent = String(completedPayments.length);
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
        const repairs = await apiRequest(`${REPAIRS_API}/admin`);

        if (!Array.isArray(repairs)) {
            throw new Error("Invalid repair list response.");
        }

        const results = await Promise.allSettled(
            repairs.map(repair =>
                apiRequest(`${PAYMENTS_API}/${repair.repair_id}`)
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
                total_amount: Number(data.total_amount) || 0,
                total_paid: Number(data.total_paid) || 0,
                remaining_balance:
                    Number(data.remaining_balance) || 0,
                payment_status: data.payment_status || "Unpaid"
            });

            if (Array.isArray(data.payments)) {
                data.payments.forEach(payment => {
                    nextTransactions.push({
                        ...payment,
                        repair_id: payment.repair_id ?? repairId
                    });
                });
            }
        });

        // Remove duplicate transactions by payment ID.
        const uniqueTransactions = new Map();

        nextTransactions.forEach(payment => {
            uniqueTransactions.set(
                String(payment.payment_id),
                payment
            );
        });

        transactions = Array.from(uniqueTransactions.values());
        repairPayments = nextRepairPayments;

        transactions.sort((a, b) => {
            const dateA = new Date(
                a.payment_date || a.created_at || 0
            );

            const dateB = new Date(
                b.payment_date || b.created_at || 0
            );

            return dateB - dateA;
        });

        updatePaymentStatistics();

        renderTransactions(searchInput?.value || "");

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
        console.error("Payment management error:", error);
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
// INITIALIZE PAGE
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

    if (refreshButton) {
        refreshButton.addEventListener("click", loadPayments);
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
