
const REPAIRS_API = "https://fixtrack-backend.vercel.app/api/repairs";
const DEVICES_API = "https://fixtrack-backend.vercel.app/api/devices";
const PAYMENTS_API = "https://fixtrack-backend.vercel.app/api/payments";

const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

let currentUser = null;

try {
    currentUser = userData ? JSON.parse(userData) : null;
} catch (error) {
    console.error("Invalid user data:", error);
}

if (!token || !currentUser) {
    window.location.replace("index.html");
} else if (currentUser.role !== "customer") {
    window.location.replace(
        currentUser.role === "admin"
            ? "admin-dashboard.html"
            : "technician-dashboard.html"
    );
}

const repairForm = document.getElementById("repair-form");
const deviceSelect = document.getElementById("repair-device");
const problemInput = document.getElementById("problem-description");
const repairMessage = document.getElementById("repair-message");
const repairList = document.getElementById("repair-list");

// ==================================
// API RESPONSE HANDLER
// ==================================

async function readResponse(response) {
    const contentType =
        response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error(
            `Server returned HTTP ${response.status}. Check the API route.`
        );
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}

// ==================================
// LOAD REGISTERED DEVICES
// ==================================

async function loadDevices() {
    if (!deviceSelect) return;

    deviceSelect.innerHTML =
        '<option value="">Loading your devices...</option>';

    try {
        const response = await fetch(DEVICES_API, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const devices = await readResponse(response);

        deviceSelect.innerHTML =
            '<option value="">Select your device</option>';

        if (!Array.isArray(devices) || devices.length === 0) {
            deviceSelect.innerHTML =
                '<option value="">No registered devices found</option>';

            repairMessage.textContent =
                "Please add a device in My Devices first.";
            return;
        }

        devices.forEach((device) => {
            const option = document.createElement("option");

            option.value = device.device_id;
            option.textContent =
                `${device.brand} ${device.model} (${device.device_type})`;

            deviceSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Load devices error:", error);

        deviceSelect.innerHTML =
            '<option value="">Unable to load devices</option>';

        repairMessage.textContent = error.message;
    }
}

// ==================================
// CREATE TEXT ELEMENT
// ==================================

function createText(label, value) {
    const paragraph = document.createElement("p");

    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;

    paragraph.appendChild(strong);
    paragraph.appendChild(
        document.createTextNode(value || "Not available")
    );

    return paragraph;
}

// ==================================
// CUSTOMER PAYMENT PANEL (PAYMONGO TEST MODE)
function createPaymentPanel(repair) {
    const panel = document.createElement("section");
    panel.className = "customer-payment-panel";
    panel.style.cssText = "margin-top:16px;padding:16px;border:1px solid #cbd5e1;border-radius:10px";
    const title = document.createElement("h4");
    title.textContent = "Billing & Payment";
    const details = document.createElement("div");
    details.textContent = "Loading billing information...";
    const pay = document.createElement("button");
    pay.type = "button";
    pay.textContent = "Pay Now (Test Mode)";
    pay.disabled = true;
    pay.style.marginTop = "10px";
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    panel.append(title, details, pay, message);

    const id = Number(repair.repair_id);
    if (!Number.isSafeInteger(id) || id < 1) {
        details.textContent = "Invalid repair number.";
        return panel;
    }

    const peso = value => Number(value).toLocaleString("en-PH", {
        style: "currency", currency: "PHP"
    });

    async function showBill() {
        pay.disabled = true;
        try {
            const response = await fetch(`${PAYMENTS_API}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store"
            });
            const bill = await readResponse(response);
            const total = Number(bill.total_amount);
            const paid = Number(bill.total_paid);
            const remaining = Number(bill.remaining_balance);
            if (![total, paid, remaining].every(Number.isFinite)) {
                throw new Error("Invalid billing details.");
            }
            details.replaceChildren(
                createText("Total", peso(total)),
                createText("Paid", peso(paid)),
                createText("Balance", peso(remaining)),
                createText("Status", bill.payment_status)
            );
            if (remaining <= 0) {
                message.textContent = total > 0
                    ? "No outstanding balance."
                    : "The administrator has not prepared a bill yet.";
                return;
            }
            message.textContent = "PayMongo Test Mode only. No real money is charged.";
            pay.disabled = false;
        } catch (error) {
            details.textContent = error.message || "Unable to load billing.";
        }
    }

    pay.addEventListener("click", async () => {
        pay.disabled = true;
        message.textContent = "Preparing checkout...";
        try {
            const response = await fetch(`${PAYMENTS_API}/${id}/checkout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await readResponse(response);
            const url = new URL(data.checkout_url);
            if (url.protocol !== "https:") throw new Error("Invalid checkout URL.");
            window.location.assign(url.href);
        } catch (error) {
            message.textContent = error.message || "Unable to start checkout.";
            pay.disabled = false;
        }
    });
    showBill();
    return panel;
}

// DISPLAY CUSTOMER REPAIR CARD
// ==================================

function createRepairCard(repair) {
    const card = document.createElement("article");
    card.className = "repair-summary-card";

    const top = document.createElement("div");
    top.className = "repair-summary-top";

    const deviceIcon = document.createElement("div");
    deviceIcon.className = "repair-summary-device-icon";
    deviceIcon.textContent = (repair.brand || "D").slice(0, 1).toUpperCase();

    const main = document.createElement("div");
    main.className = "repair-summary-main";

    const title = document.createElement("h4");
    title.textContent = [repair.brand, repair.model].filter(Boolean).join(" ") || "Registered device";

    const metadata = document.createElement("p");
    metadata.className = "repair-summary-meta";
    const date = repair.date_submitted
        ? new Date(repair.date_submitted).toLocaleDateString("en-PH", {month: "short", day: "numeric", year: "numeric"})
        : "Date unavailable";
    metadata.textContent = "Request #" + (repair.repair_id || "—") + " · " + date;
    main.append(title, metadata);

    const status = document.createElement("span");
    const statusName = String(repair.status || "Pending");
    const statusKey = statusName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    status.className = "repair-summary-status status-" + statusKey;
    status.textContent = statusName;

    top.append(deviceIcon, main, status);
    card.appendChild(top);

    const problem = document.createElement("p");
    problem.className = "repair-summary-problem";
    const problemLabel = document.createElement("strong");
    problemLabel.textContent = "Reported issue: ";
    problem.append(problemLabel, document.createTextNode(repair.problem_description || "No description provided"));
    card.appendChild(problem);

    const details = document.createElement("details");
    details.className = "repair-summary-details";
    const summary = document.createElement("summary");
    summary.textContent = "View diagnosis & billing";
    details.appendChild(summary);

    const content = document.createElement("div");
    content.className = "repair-summary-detail-body";

    const diagnosisBox = document.createElement("section");
    diagnosisBox.className = "customer-diagnosis-box repair-detail-panel";
    const diagnosisHeading = document.createElement("h5");
    diagnosisHeading.textContent = "Technician's Diagnosis";
    diagnosisBox.appendChild(diagnosisHeading);

    if (repair.diagnosis_details) {
        diagnosisBox.append(
            createText("Problem Found", repair.diagnosis_details),
            createText("Recommended Action", repair.recommended_action || "No recommendation provided.")
        );
        if (repair.date_diagnosed) {
            diagnosisBox.append(createText("Diagnosed", new Date(repair.date_diagnosed).toLocaleDateString("en-PH")));
        }
    } else {
        const empty = document.createElement("p");
        empty.className = "repair-detail-empty";
        empty.textContent = "The technician has not recorded a diagnosis yet.";
        diagnosisBox.appendChild(empty);
    }

    // Keep the existing payment and PayMongo checkout behavior unchanged.
    // Render the payment section only when its details are opened.
    let billingLoaded = false;
    details.addEventListener("toggle", () => {
        if (!details.open || billingLoaded) return;
        billingLoaded = true;
        content.appendChild(createPaymentPanel(repair));
    });

    content.appendChild(diagnosisBox);
    details.appendChild(content);
    card.appendChild(details);

    return card;
}

// ==================================
// LOAD CUSTOMER REPAIR REQUESTS
// ==================================

async function loadRepairs() {
    if (!repairList) return;

    repairList.textContent = "Loading repair requests...";

    try {
        const response = await fetch(REPAIRS_API, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const repairs = await readResponse(response);

        if (!Array.isArray(repairs)) {
            throw new Error("Unexpected repair list response.");
        }

        repairList.innerHTML = "";
        const count = document.getElementById("repair-count");
        if (count) count.textContent = repairs.length + (repairs.length === 1 ? " request" : " requests");

        if (repairs.length === 0) {
            repairList.textContent = "No repair requests yet.";
            return;
        }

        repairs.forEach((repair) => {
            repairList.appendChild(
                createRepairCard(repair)
            );
        });

    } catch (error) {
        console.error("Load repairs error:", error);
        repairList.textContent = error.message;
        const count = document.getElementById("repair-count");
        if (count) count.textContent = "Unavailable";
    }
}

// ==================================
// SUBMIT REPAIR REQUEST
// ==================================

if (repairForm) {
    repairForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const device_id = deviceSelect.value;
        const problem_description = problemInput.value.trim();

        if (!device_id || !problem_description) {
            repairMessage.textContent =
                "Please select a device and describe the problem.";
            return;
        }

        const submitButton = repairForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;

        repairMessage.textContent =
            "Submitting repair request...";

        try {
            const response = await fetch(REPAIRS_API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    device_id: Number(device_id),
                    problem_description
                })
            });

            await readResponse(response);

            repairMessage.textContent =
                "Repair request submitted successfully!";

            repairForm.reset();

            await loadRepairs();

        } catch (error) {
            console.error("Submit repair error:", error);

            repairMessage.textContent = error.message;

        } finally {
            submitButton.disabled = false;
        }
    });
}

// ==================================
// INITIAL PAGE LOAD
// ==================================

if (token && currentUser?.role === "customer") {
    loadDevices();
    loadRepairs();
}
