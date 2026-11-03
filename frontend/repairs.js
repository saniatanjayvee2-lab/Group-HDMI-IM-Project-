
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

    const title = document.createElement("h4");
    title.textContent = "Billing and Payment";
    const details = document.createElement("div");
    details.textContent = "Loading billing information...";

    const actions = document.createElement("div");
    actions.className = "customer-payment-actions";
    actions.hidden = true;

    const payFull = document.createElement("button");
    payFull.type = "button";
    payFull.className = "customer-payment-full";
    payFull.textContent = "Pay Full Balance";

    const payPartial = document.createElement("button");
    payPartial.type = "button";
    payPartial.className = "customer-payment-partial";
    payPartial.textContent = "Pay Partial Amount";

    const partialForm = document.createElement("form");
    partialForm.className = "customer-partial-form";
    partialForm.hidden = true;

    const label = document.createElement("label");
    const amountId = "partial-payment-" + String(repair.repair_id);
    label.htmlFor = amountId;
    label.textContent = "Partial payment amount (PHP)";

    const partialInput = document.createElement("input");
    partialInput.type = "number";
    partialInput.id = amountId;
    partialInput.min = "0.01";
    partialInput.step = "0.01";
    partialInput.placeholder = "Enter amount";
    partialInput.inputMode = "decimal";
    partialInput.required = true;

    const partialHint = document.createElement("p");
    partialHint.className = "customer-partial-hint";

    const submitPartial = document.createElement("button");
    submitPartial.type = "submit";
    submitPartial.textContent = "Continue Partial Payment";

    const cancelPartial = document.createElement("button");
    cancelPartial.type = "button";
    cancelPartial.className = "customer-partial-cancel";
    cancelPartial.textContent = "Cancel";
    cancelPartial.addEventListener("click", () => {
        partialForm.hidden = true;
        partialInput.value = "";
    });

    const partialButtons = document.createElement("div");
    partialButtons.className = "customer-partial-buttons";
    partialButtons.append(submitPartial, cancelPartial);
    partialForm.append(label, partialInput, partialHint, partialButtons);
    actions.append(payFull, payPartial);

    const message = document.createElement("p");
    message.className = "customer-payment-message";
    message.setAttribute("role", "status");
    panel.append(title, details, actions, partialForm, message);

    const id = Number(repair.repair_id);
    if (!Number.isSafeInteger(id) || id < 1) {
        details.textContent = "Invalid repair number.";
        return panel;
    }

    const peso = value => Number(value).toLocaleString("en-PH", {
        style: "currency", currency: "PHP"
    });
    let remainingCents = 0;

    function busy(value) {
        payFull.disabled = value;
        payPartial.disabled = value;
        submitPartial.disabled = value;
    }

    async function startCheckout(partialAmount = null) {
        busy(true);
        message.textContent = "Preparing PayMongo Test Mode checkout...";
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const options = { method: "POST", headers };
            if (partialAmount !== null) {
                headers["Content-Type"] = "application/json";
                options.body = JSON.stringify({ amount_paid: partialAmount });
            }
            const response = await fetch(`${PAYMENTS_API}/${id}/checkout`, options);
            const result = await readResponse(response);
            const url = new URL(result.checkout_url);
            if (url.protocol !== "https:") throw new Error("Invalid checkout URL.");
            window.location.assign(url.href);
        } catch (error) {
            message.textContent = error.message || "Unable to start checkout.";
            busy(false);
        }
    }

    async function showBill() {
        busy(true);
        actions.hidden = true;
        partialForm.hidden = true;
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
                createText("Status", total <= 0 && paid <= 0
                    ? "No charges yet" : bill.payment_status)
            );
            remainingCents = Math.round(remaining * 100);
            if (remainingCents <= 0) {
                message.textContent = total > 0
                    ? "No outstanding balance."
                    : "The administrator has not prepared a bill yet.";
                return;
            }
            actions.hidden = false;
            payPartial.hidden = remainingCents <= 1;
            partialInput.max = ((remainingCents - 1) / 100).toFixed(2);
            partialHint.textContent = "Enter an amount below " + peso(remaining) +
                ". You can pay the rest later.";
            message.textContent = "PayMongo Test Mode. No real money is charged.";
            busy(false);
        } catch (error) {
            details.textContent = error.message || "Unable to load billing.";
        }
    }

    payFull.addEventListener("click", () => startCheckout());

    payPartial.addEventListener("click", () => {
        partialForm.hidden = !partialForm.hidden;
        if (!partialForm.hidden) partialInput.focus();
    });

    partialForm.addEventListener("submit", event => {
        event.preventDefault();
        const amount = Number(partialInput.value);
        const cents = Math.round(amount * 100);
        if (!partialInput.value || !Number.isFinite(amount) ||
            !Number.isSafeInteger(cents) || cents <= 0 ||
            Math.abs(amount * 100 - cents) > 0.000001 ||
            cents >= remainingCents) {
            message.textContent = "Enter a valid amount greater than zero and below the remaining balance.";
            return;
        }
        startCheckout(cents / 100);
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

    // Show the person assigned to this repair using the existing customer API.
    const technician = document.createElement("div");
    technician.className = "repair-assigned-technician";

    const technicianLabel = document.createElement("span");
    technicianLabel.className = "repair-technician-label";
    technicianLabel.textContent = "Assigned Technician";

    const technicianValue = document.createElement("strong");
    technicianValue.className = "repair-technician-value";
    const technicianName = [
        repair.technician_first_name,
        repair.technician_last_name
    ].filter(value => typeof value === "string" && value.trim()).map(value => value.trim()).join(" ");

    technicianValue.textContent = technicianName ||
        (repair.technician_id ? "Technician details unavailable" : "Not assigned yet");
    if (!technicianName) technicianValue.classList.add("repair-technician-unassigned");

    technician.append(technicianLabel, technicianValue);
    card.appendChild(technician);

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

        // The device endpoint omits archived/removed devices. Use those IDs to
        // distinguish current repair requests from preserved repair history.
        // If that request fails, keep all repairs visible rather than hide data.
        let visibleDeviceIds = null;
        try {
            const devicesResponse = await fetch(DEVICES_API, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store"
            });
            const devices = await readResponse(devicesResponse);
            if (!Array.isArray(devices)) {
                throw new Error("Unexpected device list response.");
            }
            visibleDeviceIds = new Set(devices.map(device => Number(device.device_id)));
        } catch (error) {
            console.warn("Could not identify archived devices:", error);
        }

        const currentRepairs = visibleDeviceIds
            ? repairs.filter(repair => visibleDeviceIds.has(Number(repair.device_id)))
            : repairs;
        const archivedRepairs = visibleDeviceIds
            ? repairs.filter(repair => !visibleDeviceIds.has(Number(repair.device_id)))
            : [];

        repairList.replaceChildren();
        const count = document.getElementById("repair-count");
        if (count) {
            count.textContent = currentRepairs.length +
                (currentRepairs.length === 1 ? " request" : " requests");
        }

        if (currentRepairs.length === 0) {
            const empty = document.createElement("p");
            empty.className = "repair-summary-empty";
            empty.textContent = "No repair requests for your current devices.";
            repairList.appendChild(empty);
        } else {
            currentRepairs.forEach(repair => {
                repairList.appendChild(createRepairCard(repair));
            });
        }

        // Archived devices are not listed as current devices, but their service
        // records remain accessible to customers, especially for active bills.
        if (archivedRepairs.length > 0) {
            const archive = document.createElement("details");
            archive.className = "repair-archive-group";
            const archiveToggle = document.createElement("summary");
            archiveToggle.textContent = "Removed devices · " +
                archivedRepairs.length +
                (archivedRepairs.length === 1 ? " past repair" : " past repairs");
            const explanation = document.createElement("p");
            explanation.className = "repair-archive-explanation";
            explanation.textContent =
                "These devices were removed from My Devices. Their repair and billing records are preserved.";
            const archiveList = document.createElement("div");
            archiveList.className = "repair-archive-list";
            archivedRepairs.forEach(repair => {
                archiveList.appendChild(createRepairCard(repair));
            });
            archive.append(archiveToggle, explanation, archiveList);
            repairList.appendChild(archive);
        } else if (!visibleDeviceIds) {
            const notice = document.createElement("p");
            notice.className = "repair-archive-explanation";
            notice.textContent =
                "Unable to check which devices were removed, so all repair records are displayed.";
            repairList.prepend(notice);
        }

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
