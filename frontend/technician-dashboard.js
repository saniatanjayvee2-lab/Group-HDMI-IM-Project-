
const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

const API_URL = "https://fixtrack-backend.vercel.app/api/repairs";
const TECHNICIAN_API = "https://fixtrack-backend.vercel.app/api/technicians";

let currentUser = null;
let assignedRepairs = [];
let currentView = "repairs";

try {
    currentUser = userData ? JSON.parse(userData) : null;
} catch (error) {
    console.error("Invalid user data:", error);
}

// =====================================
// LOGIN CHECK
// =====================================

if (!token || !currentUser) {
    window.location.replace("index.html");
} else if (currentUser.role !== "technician") {
    window.location.replace(
        currentUser.role === "admin"
            ? "admin-dashboard.html"
            : "dashboard.html"
    );
} else {
    document.getElementById("welcomeUser").textContent =
        `Welcome, ${currentUser.first_name}!`;

    initializeDashboard();
}

// =====================================
// HELPERS
// =====================================

function authHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
}

function getElement(id) {
    return document.getElementById(id);
}

function setMessage(id, text, error = false) {
    const element = getElement(id);
    if (!element) return;

    element.textContent = text;
    element.style.color = error ? "#dc2626" : "#15803d";
}

function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "Not available"
        : date.toLocaleDateString();
}

function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
}

function isHistory(repair) {
    return ["completed", "released"].includes(
        normalizeStatus(repair.status)
    );
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

function addDetail(parent, label, value) {
    const p = makeElement("p", "", `${label}: ${value}`);
    parent.appendChild(p);
}

function showSection(id) {
    getElement("assignedRepairsSection").style.display =
        id === "assignedRepairsSection" ? "block" : "none";

    getElement("diagnosisSection").style.display =
        id === "diagnosisSection" ? "block" : "none";
}

// =====================================
// INITIALIZE
// =====================================

async function initializeDashboard() {
    getElement("viewRepairsBtn").addEventListener(
        "click",
        () => displayRepairs("repairs")
    );

    getElement("viewHistoryBtn").addEventListener(
        "click",
        () => displayRepairs("history")
    );

    getElement("backToRepairsBtn").addEventListener(
        "click",
        () => displayRepairs("repairs")
    );

    getElement("diagnosisForm").addEventListener(
        "submit",
        saveDiagnosis
    );

    getElement("logoutBtn").addEventListener(
        "click",
        logout
    );

    await displayRepairs("repairs");
}

// =====================================
// FETCH REPAIRS
// =====================================

async function fetchAssignedRepairs() {
    const response = await fetch(
        `${API_URL}/technician`,
        { headers: authHeaders() }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Unable to load repairs (HTTP ${response.status}).`
        );
    }

    if (!Array.isArray(data)) {
        throw new Error("Invalid repair data received.");
    }

    assignedRepairs = data;
    updateSummary();

    return data;
}

// =====================================
// SUMMARY CARDS
// =====================================

function updateSummary() {
    getElement("totalAssigned").textContent =
        assignedRepairs.length;

    getElement("totalInProgress").textContent =
        assignedRepairs.filter(
            repair => normalizeStatus(repair.status) === "in progress"
        ).length;

    getElement("totalCompleted").textContent =
        assignedRepairs.filter(
            repair => isHistory(repair)
        ).length;
}

// =====================================
// DISPLAY REPAIRS / HISTORY
// =====================================

async function displayRepairs(view = "repairs") {
    currentView = view;
    showSection("assignedRepairsSection");

    const list = getElement("assignedRepairsList");
    const repairsBtn = getElement("viewRepairsBtn");
    const historyBtn = getElement("viewHistoryBtn");

    repairsBtn.classList.toggle("active", view === "repairs");
    historyBtn.classList.toggle("active", view === "history");

    getElement("repairSectionTitle").textContent =
        view === "history" ? "Repair History" : "My Repairs";

    list.textContent = "Loading repairs...";
    setMessage("repairMessage", "");

    try {
        const repairs = await fetchAssignedRepairs();

        const filtered = repairs.filter(repair =>
            view === "history"
                ? isHistory(repair)
                : !isHistory(repair)
        );

        list.replaceChildren();

        if (filtered.length === 0) {
            list.textContent = view === "history"
                ? "No completed or released repairs yet."
                : "No active repairs assigned to you.";
            return;
        }

        filtered.forEach(repair => {
            list.appendChild(createRepairCard(repair, view));
        });

    } catch (error) {
        console.error("Load repairs error:", error);
        list.textContent = error.message;
    }
}

// =====================================
// CREATE COMPACT REPAIR CARD
// =====================================

function createRepairCard(repair, view) {
    const card = makeElement("div", "tech-repair-card");
    const top = makeElement("div", "tech-repair-top");
    const info = makeElement("div");

    const title = makeElement(
        "h4",
        "",
        `${repair.brand || "Unknown"} ${repair.model || "Device"}`
    );

    const customerName = [
        repair.first_name,
        repair.last_name
    ].filter(Boolean).join(" ");

    info.appendChild(title);

    addDetail(
        info,
        "Customer",
        customerName || "Not available"
    );

    addDetail(
        info,
        "Submitted",
        formatDate(repair.date_submitted)
    );

    const badge = makeElement(
        "span",
        `tech-status ${normalizeStatus(repair.status).replace(/\s+/g, "-")}`,
        repair.status || "Unknown"
    );

    top.append(info, badge);
    card.appendChild(top);

    const actions = makeElement("div", "tech-actions");

    const detailsBtn = makeElement(
        "button",
        "tech-btn secondary",
        "View Details"
    );
    detailsBtn.type = "button";

    const details = makeElement("div", "tech-details");

    addDetail(
        details,
        "Repair ID",
        repair.repair_id
    );

    addDetail(
        details,
        "Device Type",
        repair.device_type || "Not specified"
    );

    addDetail(
        details,
        "Problem",
        repair.problem_description || "Not specified"
    );

    addDetail(
        details,
        "Status",
        repair.status || "Unknown"
    );

    detailsBtn.addEventListener("click", () => {
        const isOpen = details.classList.toggle("open");

        detailsBtn.textContent = isOpen
            ? "Hide Details"
            : "View Details";
    });

    actions.appendChild(detailsBtn);

    if (view === "repairs") {
        const statusBtn = makeElement(
            "button",
            "tech-btn secondary",
            "Update Status"
        );
        statusBtn.type = "button";

        const diagnosisBtn = makeElement(
            "button",
            "tech-btn",
            "Diagnosis"
        );
        diagnosisBtn.type = "button";

        const statusEditor = makeElement(
            "div",
            "tech-status-editor"
        );

        statusEditor.style.display = "none";

        statusBtn.addEventListener("click", () => {
            const isHidden =
                statusEditor.style.display === "none";

            statusEditor.style.display =
                isHidden ? "block" : "none";
        });

        diagnosisBtn.addEventListener("click", () => {
            openDiagnosisSection(repair.repair_id);
        });

        actions.append(statusBtn, diagnosisBtn);

        addStatusControls(statusEditor, repair);

        card.append(actions, details, statusEditor);
    } else {
        card.append(actions, details);
    }

    return card;
}

// =====================================
// STATUS UPDATE
// =====================================

function addStatusControls(container, repair) {
    const label = makeElement(
        "label",
        "",
        "Change Repair Status"
    );

    const select = document.createElement("select");

    const statuses = [
        "Pending",
        "In Progress",
        "Completed"
    ];

    if (
        repair.status &&
        !statuses.includes(repair.status)
    ) {
        statuses.push(repair.status);
    }

    statuses.forEach(status => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        select.appendChild(option);
    });

    select.value = repair.status;

    const saveBtn = makeElement(
        "button",
        "tech-btn",
        "Save Status"
    );
    saveBtn.type = "button";

    const message = makeElement("p");
    message.setAttribute("role", "status");

    if (normalizeStatus(repair.status) === "released") {
        select.disabled = true;
        saveBtn.disabled = true;
        message.textContent = "This repair has been released.";
    }

    saveBtn.addEventListener("click", async () => {
        const newStatus = select.value;

        if (newStatus === repair.status) {
            message.textContent = "No changes to save.";
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        message.textContent = "";

        try {
            const response = await fetch(
                `${API_URL}/technician/${repair.repair_id}/status`,
                {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        status: newStatus
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to update status."
                );
            }

            await displayRepairs(currentView);

            setMessage(
                "repairMessage",
                "Repair status updated successfully."
            );

        } catch (error) {
            message.textContent = error.message;
            message.style.color = "#dc2626";

        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Status";
        }
    });

    container.append(label, select, saveBtn, message);
}

// =====================================
// OPEN DIAGNOSIS
// =====================================

async function openDiagnosisSection(selectedRepairId = null) {
    showSection("diagnosisSection");

    const select = getElement("diagnosisRepair");

    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an assigned repair";
    select.appendChild(placeholder);

    setMessage("diagnosisMessage", "");

    try {
        const repairs = await fetchAssignedRepairs();

        repairs.forEach(repair => {
            const option = document.createElement("option");

            option.value = repair.repair_id;
            option.textContent =
                `#${repair.repair_id} - ` +
                `${repair.brand || "Unknown"} ` +
                `${repair.model || "Device"} ` +
                `(${repair.status})`;

            select.appendChild(option);
        });

        if (selectedRepairId !== null) {
            select.value = String(selectedRepairId);
        }

        if (repairs.length === 0) {
            setMessage(
                "diagnosisMessage",
                "No assigned repairs available."
            );
        }

    } catch (error) {
        setMessage("diagnosisMessage", error.message, true);
    }

    await loadSavedDiagnoses();

    getElement("diagnosisSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// =====================================
// SAVE DIAGNOSIS
// =====================================

async function saveDiagnosis(event) {
    event.preventDefault();

    const repairId = Number(getElement("diagnosisRepair").value);
    const details = getElement("diagnosisDetails").value.trim();
    const action = getElement("recommendedAction").value.trim();
    const saveBtn = getElement("saveDiagnosisBtn");

    if (
        !Number.isSafeInteger(repairId) ||
        repairId <= 0 ||
        !details
    ) {
        setMessage(
            "diagnosisMessage",
            "Select a repair and enter diagnosis details.",
            true
        );
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const response = await fetch(
            `${TECHNICIAN_API}/diagnoses`,
            {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    repair_id: repairId,
                    diagnosis_details: details,
                    recommended_action: action
                })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to save diagnosis."
            );
        }

        getElement("diagnosisDetails").value = "";
        getElement("recommendedAction").value = "";

        setMessage(
            "diagnosisMessage",
            "Diagnosis saved successfully."
        );

        await loadSavedDiagnoses();

    } catch (error) {
        setMessage("diagnosisMessage", error.message, true);

    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Diagnosis";
    }
}

// =====================================
// SAVED DIAGNOSES
// =====================================

async function loadSavedDiagnoses() {
    const list = getElement("diagnosisList");

    list.textContent = "Loading diagnoses...";

    try {
        const response = await fetch(
            `${TECHNICIAN_API}/diagnoses/mine`,
            { headers: authHeaders() }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to load diagnoses."
            );
        }

        if (!Array.isArray(data)) {
            throw new Error("Invalid diagnosis data.");
        }

        list.replaceChildren();

        if (data.length === 0) {
            list.textContent = "No diagnoses recorded yet.";
            return;
        }

        data.forEach(diagnosis => {
            const card = makeElement(
                "div",
                "tech-repair-card"
            );

            const title = makeElement(
                "h4",
                "",
                `${diagnosis.brand || "Unknown"} ` +
                `${diagnosis.model || "Device"}`
            );

            card.appendChild(title);

            addDetail(
                card,
                "Diagnosis",
                diagnosis.diagnosis_details
            );

            addDetail(
                card,
                "Recommended Action",
                diagnosis.recommended_action || "None"
            );

            addDetail(
                card,
                "Diagnosed",
                formatDate(diagnosis.date_diagnosed)
            );

            list.appendChild(card);
        });

    } catch (error) {
        console.error("Load diagnoses error:", error);
        list.textContent = error.message;
    }
}

// =====================================
// LOGOUT
// =====================================

function logout() {
    localStorage.removeItem("fixtrack_token");
    localStorage.removeItem("fixtrack_user");

    window.location.href = "index.html";
}
