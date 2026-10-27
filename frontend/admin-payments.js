
/* =========================================
   FIXTRACK - ADMIN PAYMENT MANAGEMENT
   File: frontend/admin-payments.js
   ========================================= */

// =====================================
// API CONFIGURATION - VERCEL BACKEND
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
    currentUser = userData
        ? JSON.parse(userData)
        : null;
} catch (error) {
    console.error("Invalid user data:", error);
}

// =====================================
// DOM ELEMENTS
// =====================================

const historyBody =
    document.getElementById("paymentHistoryBody");

const message =
    document.getElementById("paymentsMessage");

const searchInput =
    document.getElementById("paymentSearch");

const refreshButton =
    document.getElementById("refreshPayments");

const collectedElement =
    document.getElementById("totalCollected");

const outstandingElement =
    document.getElementById("totalOutstanding");

const countElement =
    document.getElementById("transactionCount");

// =====================================
// GLOBAL DATA
// =====================================

let transactions = [];
let repairPayments = [];

// =====================================
// FORMAT CURRENCY
// =====================================

function formatMoney(value) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(value) || 0);
}

// =====================================
// FORMAT DATE
// =====================================

function formatDate(value) {
    if (!value) {
        return "N/A";
    }

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

// =====================================
// DISPLAY STATUS MESSAGE
// =====================================

function setMessage(text, isError = false) {
    if (!message) {
        return;
    }

    message.textContent = text;

    message.style.color = isError
        ? "#dc2626"
        : "#64748b";
}

// =====================================
// API REQUEST HELPER
// =====================================

async function apiRequest(url) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
        }
    });

    const data = await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed (HTTP ${response.status}).`
        );
    }

    return data;
}

// =====================================
// CREATE TABLE CELL
// =====================================

function createCell(value) {
    const cell = document.createElement("td");

    cell.textContent = String(value ?? "");

    return cell;
}

// =====================================
// CREATE PAYMENT STATUS BADGE
// =====================================

function createStatusBadge(status) {
    const badge = document.createElement("span");

    const normalizedStatus = String(
        status || "Unknown"
    ).toLowerCase();

    badge.className = "payments-status";

    badge.textContent = status || "Unknown";

    if (normalizedStatus === "completed") {
        badge.classList.add("completed");
    }

    return badge;
}

// =====================================
// SEARCH PAYMENT TRANSACTIONS
// =====================================

function filterTransactions(query) {
    const search = String(query || "")
        .trim()
        .toLowerCase();

    if (!search) {
        return transactions;
    }

    return transactions.filter(payment => {
        const searchableValues = [
            payment.payment_id,
            payment.repair_id,
            payment.amount_paid,
            payment.payment_method,
            payment.payment_status,
            formatDate(
                payment.payment_date ||
                payment.created_at
            )
        ];

        return searchableValues.some(value =>
            String(value ?? "")
                .toLowerCase()
                .includes(search)
        );
    });
}

// =====================================
// RENDER TRANSACTION HISTORY
// =====================================

function renderTransactions(query = "") {
    if (!historyBody) {
        return;
    }

    historyBody.replaceChildren();

    const filteredPayments =
        filterTransactions(query);

    if (filteredPayments.length === 0) {
        const row = document.createElement("tr");

        const emptyCell = createCell(
            "No matching payment transactions found."
        );

        emptyCell.colSpan = 6;
        emptyCell.className = "payments-empty";

        row.appendChild(emptyCell);

        historyBody.appendChild(row);

        return;
    }

    filteredPayments.forEach(payment => {
        const row = document.createElement("tr");

        // TRANSACTION ID
        row.appendChild(
            createCell(`#${payment.payment_id}`)
        );

        // REPAIR ID
        row.appendChild(
            createCell(`#${payment.repair_id}`)
        );

        // AMOUNT PAID
        row.appendChild(
            createCell(
                formatMoney(payment.amount_paid)
            )
        );

        // PAYMENT METHOD
        row.appendChild(
            createCell(
                payment.payment_method || "Unknown"
            )
        );

        // PAYMENT STATUS
        const statusCell =
            document.createElement("td");

        statusCell.appendChild(
            createStatusBadge(
                payment.payment_status
            )
        );

        row.appendChild(statusCell);

        // PAYMENT DATE
        row.appendChild(
            createCell(
                formatDate(
                    payment.payment_date ||
                    payment.created_at
                )
            )
        );

        historyBody.appendChild(row);
    });
}

// =====================================
// CALCULATE PAYMENT STATISTICS
// =====================================

function updatePaymentStatistics() {
    const completedPayments =
        transactions.filter(payment =>
            String(
                payment.payment_status || ""
            ).toLowerCase() === "completed"
        );

    const totalCollected =
        completedPayments.reduce(
            (total, payment) => {
                return total +
                    (Number(payment.amount_paid) || 0);
            },
            0
        );

    const totalOutstanding =
        repairPayments.reduce(
            (total, repair) => {
                return total + Math.max(
                    0,
                    Number(repair.remaining_balance) || 0
                );
            },
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
    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
    }

    setMessage("Loading payment records...");

    try {
        // LOAD ADMIN REPAIR REQUESTS
        const repairs = await apiRequest(
            `${REPAIRS_API}/admin`
        );

        if (!Array.isArray(repairs)) {
            throw new Error(
                "Invalid repair list response."
            );
        }

        // FETCH PAYMENT DATA FOR EACH REPAIR
        const results = await Promise.allSettled(
            repairs.map(repair => {
                return apiRequest(
                    `${PAYMENTS_API}/${repair.repair_id}`
                );
            })
        );

        transactions = [];
        repairPayments = [];

        const failedRequests = [];

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                failedRequests.push(
                    result.reason
                );

                return;
            }

            const data = result.value;

            const repairId =
                repairs[index].repair_id;

            // STORE REPAIR PAYMENT SUMMARY
            repairPayments.push({
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

            // STORE PAYMENT HISTORY
            if (Array.isArray(data.payments)) {
                data.payments.forEach(payment => {
                    transactions.push({
                        ...payment,
                        repair_id:
                            payment.repair_id ?? repairId
                    });
                });
            }
        });

        // SORT NEWEST PAYMENTS FIRST
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

        // UPDATE DASHBOARD
        updatePaymentStatistics();

        renderTransactions(
            searchInput ? searchInput.value : ""
        );

        // DISPLAY RESULTS
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
                `${transactions.length} transaction(s) loaded. ${failedRequests.length} repair(s) could not be checked.`,
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

        setMessage(
            error.message,
            true
        );

    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "Refresh";
        }
    }
}

// =====================================
// INITIALIZE ADMIN PAYMENT PAGE
// =====================================

function initializeAdminPayments() {
    // CHECK ADMIN ACCESS
    if (
        !token ||
        !currentUser ||
        currentUser.role !== "admin"
    ) {
        window.location.replace("index.html");
        return;
    }

    // REFRESH BUTTON
    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadPayments
        );
    }

    // SEARCH INPUT
    if (searchInput) {
        searchInput.addEventListener(
            "input",
            () => {
                renderTransactions(
                    searchInput.value
                );
            }
        );
    }

    // LOAD TRANSACTIONS
    loadPayments();
}

// =====================================
// START
// =====================================

initializeAdminPayments();
