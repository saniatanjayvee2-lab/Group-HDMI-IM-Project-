
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
        `Welcome, ${currentUser.first_name || "Technician"}!`;

    initializeDashboard();
}

function el(id) {
    return document.getElementById(id);
}

function headers() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
}

function message(id, text, error = false) {
    const target = el(id);
    if (!target) return;

    target.textContent = text;
    target.style.color = error ? "#dc2626" : "#15803d";
}

function statusOf(repair) {
    return String(repair.status || "").trim().toLowerCase();
}

function isCompleted(repair) {
    return ["completed", "released"].includes(statusOf(repair));
}

function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "Not available"
        : date.toLocaleDateString();
}

function make(tag, className = "", text = "") {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
}

function detail(parent, label, value) {
    parent.appendChild(make("p", "", `${label}: ${value}`));
}

function showDiagnosis(show) {
    el("diagnosisSection").style.display = show ? "grid" : "none";
    el("assignedRepairsSection").style.display = show ? "none" : "block";
}

function updateCounts() {
    el("totalAssigned").textContent = assignedRepairs.length;

    el("totalInProgress").textContent =
        assignedRepairs.filter(
            repair => statusOf(repair) === "in progress"
        ).length;

    el("totalCompleted").textContent =
        assignedRepairs.filter(isCompleted).length;
}

async function initializeDashboard() {
    el("logoutBtn").addEventListener("click", logout);

    el("viewRepairsBtn").addEventListener("click", () => {
        displayRepairs("repairs");
    });

    el("viewHistoryBtn").addEventListener("click", () => {
        displayRepairs("history");
    });

    el("backToRepairsBtn").addEventListener("click", () => {
        displayRepairs("repairs");
    });

    el("diagnosisForm").addEventListener("submit", saveDiagnosis);
    el("editDiagnosisForm").addEventListener("submit", saveEditedDiagnosis);
    el("closeEditDiag").addEventListener("click", closeEditPanel);
    el("cancelEditDiag").addEventListener("click", closeEditPanel);
    el("editDiagnosisOverlay").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeEditPanel();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeEditPanel();
    });

    await displayRepairs("repairs");
}

async function fetchRepairs() {
    const response = await fetch(`${API_URL}/technician`, {
        headers: headers()
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Unable to load repairs (HTTP ${response.status}).`
        );
    }

    if (!Array.isArray(data)) {
        throw new Error("Invalid repair data.");
    }

    assignedRepairs = data;
    updateCounts();

    return data;
}

async function displayRepairs(view = "repairs") {
    currentView = view;
    showDiagnosis(false);

    el("viewRepairsBtn").classList.toggle(
        "active", view === "repairs"
    );

    el("viewHistoryBtn").classList.toggle(
        "active", view === "history"
    );

    el("repairSectionTitle").textContent =
        view === "history" ? "Repair History" : "My Repairs";

    const list = el("assignedRepairsList");
    list.textContent = "Loading repairs...";
    message("repairMessage", "");

    try {
        const repairs = await fetchRepairs();

        const filtered = repairs.filter(repair =>
            view === "history"
                ? isCompleted(repair)
                : !isCompleted(repair)
        );

        list.replaceChildren();

        if (!filtered.length) {
            list.textContent = view === "history"
                ? "No completed repairs yet."
                : "No active repairs assigned to you.";
            return;
        }

        filtered.forEach(repair => {
            list.appendChild(createRepairCard(repair, view));
        });

    } catch (error) {
        list.textContent = error.message;
        console.error(error);
    }
}

function createRepairCard(repair, view) {
    const card = make("div", "tw-card");
    const top = make("div", "tw-card-top");
    const info = make("div");

    const title = make(
        "h4",
        "",
        `${repair.brand || "Unknown"} ${repair.model || "Device"}`
    );

    const customer = [
        repair.first_name,
        repair.last_name
    ].filter(Boolean).join(" ") || "Not available";

    info.appendChild(title);
    detail(info, "Customer", customer);
    detail(info, "Submitted", formatDate(repair.date_submitted));

    const badge = make(
        "span",
        `tw-badge ${statusOf(repair).replace(/\s+/g, "-")}`,
        repair.status || "Unknown"
    );

    top.append(info, badge);
    card.appendChild(top);

    const actions = make("div", "tw-actions");

    const detailsBtn = make("button", "tw-btn light", "Details");
    detailsBtn.type = "button";

    const detailsBox = make("div", "tw-expand");
    detailsBox.hidden = true;

    detail(detailsBox, "Repair ID", repair.repair_id);
    detail(
        detailsBox,
        "Device Type",
        repair.device_type || "Not specified"
    );
    detail(
        detailsBox,
        "Problem",
        repair.problem_description || "Not specified"
    );
    detail(detailsBox, "Status", repair.status || "Unknown");

    detailsBtn.addEventListener("click", () => {
        detailsBox.hidden = !detailsBox.hidden;
        detailsBtn.textContent = detailsBox.hidden
            ? "Details"
            : "Hide Details";
    });

    actions.appendChild(detailsBtn);

    if (view === "repairs") {
        const statusBtn = make(
            "button",
            "tw-btn light",
            "Update Status"
        );
        statusBtn.type = "button";

        const diagnosisBtn = make(
            "button",
            "tw-btn",
            "Diagnosis"
        );
        diagnosisBtn.type = "button";

        const statusBox = make("div", "tw-expand");
        statusBox.hidden = true;

        addStatusEditor(statusBox, repair);

        statusBtn.addEventListener("click", () => {
            statusBox.hidden = !statusBox.hidden;
        });

        diagnosisBtn.addEventListener("click", () => {
            openDiagnosis(repair.repair_id);
        });

        actions.append(statusBtn, diagnosisBtn);
        card.append(actions, detailsBox, statusBox);

    } else {
        card.append(actions, detailsBox);
    }

    return card;
}

function addStatusEditor(container, repair) {
    const label = make("label", "", "Change Repair Status");
    const select = document.createElement("select");

    const statuses = ["Pending", "In Progress", "Completed"];

    if (
        repair.status &&
        !statuses.includes(repair.status)
    ) {
        statuses.push(repair.status);
    }

    statuses.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    select.value = repair.status;

    const saveBtn = make("button", "tw-btn", "Save Status");
    saveBtn.type = "button";

    const feedback = make("p");
    feedback.setAttribute("role", "status");

    saveBtn.addEventListener("click", async () => {
        if (select.value === repair.status) {
            feedback.textContent = "No changes to save.";
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
            const response = await fetch(
                `${API_URL}/technician/${repair.repair_id}/status`,
                {
                    method: "PUT",
                    headers: headers(),
                    body: JSON.stringify({
                        status: select.value
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to update repair status."
                );
            }

            await displayRepairs(currentView);
            message("repairMessage", "Repair status updated successfully.");

        } catch (error) {
            feedback.textContent = error.message;
            feedback.style.color = "#dc2626";

        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Status";
        }
    });

    container.append(label, select, saveBtn, feedback);
}

async function openDiagnosis(repairId) {
    showDiagnosis(true);

    const select = el("diagnosisRepair");
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a repair";
    select.appendChild(placeholder);

    message("diagnosisMessage", "");

    try {
        const repairs = await fetchRepairs();

        repairs.forEach(repair => {
            const option = document.createElement("option");
            option.value = repair.repair_id;
            option.textContent =
                `#${repair.repair_id} - ` +
                `${repair.brand || "Unknown"} ` +
                `${repair.model || "Device"}`;

            select.appendChild(option);
        });

        select.value = String(repairId);

    } catch (error) {
        message("diagnosisMessage", error.message, true);
    }

    await loadDiagnoses();

    el("diagnosisSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function saveDiagnosis(event) {
    event.preventDefault();

    const repairId = Number(el("diagnosisRepair").value);
    const details = el("diagnosisDetails").value.trim();
    const action = el("recommendedAction").value.trim();
    const button = el("saveDiagnosisBtn");

    if (!repairId || !details) {
        message(
            "diagnosisMessage",
            "Select a repair and enter diagnosis details.",
            true
        );
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await fetch(
            `${TECHNICIAN_API}/diagnoses`,
            {
                method: "POST",
                headers: headers(),
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

        el("diagnosisDetails").value = "";
        el("recommendedAction").value = "";

        message("diagnosisMessage", "Diagnosis saved successfully.");

        await loadDiagnoses();

    } catch (error) {
        message("diagnosisMessage", error.message, true);

    } finally {
        button.disabled = false;
        button.textContent = "Save Diagnosis";
    }
}

let editingDiagnosisId = null;

function openEditPanel(diagnosis) {
    editingDiagnosisId = diagnosis.diagnosis_id;

    el("editDiagRepair").textContent =
        `Repair #${diagnosis.repair_id} - ` +
        `${diagnosis.brand || "Unknown"} ${diagnosis.model || "Device"}`;
    el("editDiagDetails").value = diagnosis.diagnosis_details || "";
    el("editDiagAction").value = diagnosis.recommended_action || "";
    message("editDiagMessage", "");

    el("editDiagnosisOverlay").classList.add("open");
    el("editDiagDetails").focus();
}

function closeEditPanel() {
    editingDiagnosisId = null;
    el("editDiagnosisOverlay").classList.remove("open");
}

async function saveEditedDiagnosis(event) {
    event.preventDefault();

    const details = el("editDiagDetails").value.trim();
    const action = el("editDiagAction").value.trim();
    const button = el("saveEditDiag");

    if (!editingDiagnosisId || !details) {
        message("editDiagMessage", "Diagnosis details are required.", true);
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await fetch(
            `${TECHNICIAN_API}/diagnoses/${editingDiagnosisId}`,
            {
                method: "PUT",
                headers: headers(),
                body: JSON.stringify({
                    diagnosis_details: details,
                    recommended_action: action
                })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || "Unable to update diagnosis.");
        }

        closeEditPanel();
        message("diagnosisMessage", "Diagnosis updated successfully.");
        await loadDiagnoses();

    } catch (error) {
        message("editDiagMessage", error.message, true);

    } finally {
        button.disabled = false;
        button.textContent = "Save Changes";
    }
}

async function loadDiagnoses() {
    const list = el("diagnosisList");
    list.textContent = "Loading diagnoses...";

    try {
        const response = await fetch(
            `${TECHNICIAN_API}/diagnoses/mine`,
            { headers: headers() }
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

        if (!data.length) {
            list.textContent = "No diagnoses recorded yet.";
            return;
        }

        data.forEach(diagnosis => {
            const card = make("div", "tw-card");

            card.appendChild(
                make(
                    "h4",
                    "",
                    `${diagnosis.brand || "Unknown"} ` +
                    `${diagnosis.model || "Device"}`
                )
            );

            detail(card, "Diagnosis", diagnosis.diagnosis_details);
            detail(
                card,
                "Recommended Action",
                diagnosis.recommended_action || "None"
            );
            detail(
                card,
                "Diagnosed",
                formatDate(diagnosis.date_diagnosed)
            );

            if (diagnosis.status !== "Released") {
                const editBtn = make("button", "tw-btn", "Edit Diagnosis");
                editBtn.type = "button";
                editBtn.addEventListener("click", () => openEditPanel(diagnosis));
                card.appendChild(editBtn);
            }

            list.appendChild(card);
        });

    } catch (error) {
        list.textContent = error.message;
    }
}

function logout() {
    localStorage.removeItem("fixtrack_token");
    localStorage.removeItem("fixtrack_user");
    window.location.href = "index.html";
}
