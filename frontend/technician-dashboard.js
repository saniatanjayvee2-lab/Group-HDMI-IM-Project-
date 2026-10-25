
const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

const API_URL = "http://localhost:3000/api/repairs";
const TECHNICIAN_API = "http://localhost:3000/api/technicians";

let currentUser = null;
let assignedRepairs = [];

try {
    currentUser = userData ? JSON.parse(userData) : null;
} catch (error) {
    console.error("Invalid user data:", error);
}

// ==================================
// CHECK TECHNICIAN LOGIN
// ==================================

if (!token || !currentUser) {
    window.location.replace("index.html");

} else if (currentUser.role !== "technician") {
    window.location.replace(
        currentUser.role === "admin"
            ? "admin-dashboard.html"
            : "dashboard.html"
    );

} else {
    const welcomeUser =
        document.getElementById("welcomeUser");

    if (welcomeUser) {
        welcomeUser.textContent =
            `Welcome, ${currentUser.first_name}!`;
    }

    initializeTechnicianDashboard();
}

// ==================================
// INITIALIZE DASHBOARD
// ==================================

function initializeTechnicianDashboard() {
    const viewRepairsBtn =
        document.getElementById("viewRepairsBtn");

    const manageDiagnosisBtn =
        document.getElementById("manageDiagnosisBtn");

    const updateStatusBtn =
        document.getElementById("updateStatusBtn");

    const viewHistoryBtn =
        document.getElementById("viewHistoryBtn");

    const diagnosisForm =
        document.getElementById("diagnosisForm");

    const logoutBtn =
        document.getElementById("logoutBtn");

    if (viewRepairsBtn) {
        viewRepairsBtn.addEventListener("click", () => {
            loadAssignedRepairs(false);
        });
    }

    if (manageDiagnosisBtn) {
        manageDiagnosisBtn.addEventListener(
            "click",
            openDiagnosisSection
        );
    }

    if (updateStatusBtn) {
        updateStatusBtn.addEventListener("click", () => {
            loadAssignedRepairs(true);
        });
    }

    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener("click", () => {
            loadRepairHistory();
        });
    }

    if (diagnosisForm) {
        diagnosisForm.addEventListener(
            "submit",
            saveDiagnosis
        );
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
}

// ==================================
// HELPER: HIDE SECTIONS
// ==================================

function hideSections() {
    const repairsSection =
        document.getElementById("assignedRepairsSection");

    const diagnosisSection =
        document.getElementById("diagnosisSection");

    if (repairsSection) {
        repairsSection.style.display = "none";
    }

    if (diagnosisSection) {
        diagnosisSection.style.display = "none";
    }
}

// ==================================
// HELPER: FETCH ASSIGNED REPAIRS
// ==================================

async function fetchAssignedRepairs() {
    const response = await fetch(
        `${API_URL}/technician`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
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

    return data;
}

// ==================================
// LOAD ASSIGNED REPAIRS
// ==================================

async function loadAssignedRepairs(showStatusControls = false) {
    const section =
        document.getElementById("assignedRepairsSection");

    const list =
        document.getElementById("assignedRepairsList");

    if (!section || !list) {
        console.error("Assigned repairs section not found.");
        return;
    }

    hideSections();

    section.style.display = "block";
    list.textContent = "Loading assigned repairs...";

    const heading = section.querySelector("h3");

    if (heading) {
        heading.textContent = showStatusControls
            ? "Update Repair Status"
            : "My Assigned Repairs";
    }

    try {
        const repairs = await fetchAssignedRepairs();

        list.innerHTML = "";

        if (repairs.length === 0) {
            list.textContent =
                "No repairs assigned to you yet.";
            return;
        }

        repairs.forEach((repair) => {
            createRepairCard(
                repair,
                list,
                showStatusControls
            );
        });

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error(
            "Load assigned repairs error:",
            error
        );

        list.textContent = error.message;
    }
}

// ==================================
// CREATE REPAIR CARD
// ==================================

function createRepairCard(repair, list, showStatusControls) {
    const card = document.createElement("div");

    card.className = "registered-device";
    card.style.padding = "20px";
    card.style.marginTop = "15px";
    card.style.marginBottom = "15px";

    const title = document.createElement("h4");
    title.textContent =
        `${repair.brand || "Unknown"} ${repair.model || "Device"}`;

    const customer = document.createElement("p");
    customer.textContent =
        `Customer: ${repair.first_name || ""} ${repair.last_name || ""}`;

    const deviceType = document.createElement("p");
    deviceType.textContent =
        `Device Type: ${repair.device_type || "Not specified"}`;

    const problem = document.createElement("p");
    problem.textContent =
        `Problem: ${repair.problem_description || "Not specified"}`;

    const status = document.createElement("p");
    status.textContent = `Status: ${repair.status}`;
    status.style.fontWeight = "600";

    const submitted = document.createElement("p");
    submitted.textContent =
        `Submitted: ${
            repair.date_submitted
                ? new Date(
                    repair.date_submitted
                ).toLocaleDateString()
                : "Not available"
        }`;

    card.append(
        title,
        customer,
        deviceType,
        problem,
        status,
        submitted
    );

    if (showStatusControls) {
        addStatusControls(card, repair);
    }

    list.appendChild(card);
}

// ==================================
// STATUS UPDATE CONTROLS
// ==================================

function addStatusControls(card, repair) {
    const label = document.createElement("label");

    label.textContent = "Update Repair Status";
    label.style.display = "block";
    label.style.marginTop = "15px";
    label.style.marginBottom = "8px";

    const select = document.createElement("select");

    select.style.width = "100%";
    select.style.padding = "12px";
    select.style.marginBottom = "12px";

    const statuses = [
        "Pending",
        "In Progress",
        "Completed"
    ];

    if (repair.status === "Released") {
        statuses.push("Released");
    }

    statuses.forEach((value) => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        select.appendChild(option);
    });

    select.value = repair.status;

    const saveButton = document.createElement("button");

    saveButton.type = "button";
    saveButton.textContent = "Save Status";
    saveButton.className = "save-edit-btn";

    const message = document.createElement("p");

    message.setAttribute("role", "status");
    message.style.marginTop = "10px";

    if (repair.status === "Released") {
        select.disabled = true;
        saveButton.disabled = true;

        message.textContent =
            "This repair has already been released.";
    }

    saveButton.addEventListener("click", async () => {
        const newStatus = select.value;

        if (newStatus === repair.status) {
            message.textContent =
                "No status changes to save.";
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
        message.textContent =
            "Updating repair status...";

        try {
            const response = await fetch(
                `${API_URL}/technician/${repair.repair_id}/status`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        status: newStatus
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Unable to update status (HTTP ${response.status}).`
                );
            }

            await loadAssignedRepairs(true);

            const section =
                document.getElementById("assignedRepairsSection");

            const successMessage =
                document.createElement("p");

            successMessage.textContent =
                "Repair status updated successfully!";

            successMessage.style.color = "#15803d";
            successMessage.style.fontWeight = "600";
            successMessage.style.marginTop = "12px";

            section.insertBefore(
                successMessage,
                section.querySelector("#assignedRepairsList")
            );

        } catch (error) {
            console.error(
                "Update status error:",
                error
            );

            message.textContent = error.message;
            message.style.color = "#dc2626";

        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save Status";
        }
    });

    card.append(
        label,
        select,
        saveButton,
        message
    );
}

// ==================================
// OPEN MANAGE DIAGNOSIS
// ==================================

async function openDiagnosisSection() {
    const section =
        document.getElementById("diagnosisSection");

    const repairSelect =
        document.getElementById("diagnosisRepair");

    const message =
        document.getElementById("diagnosisMessage");

    if (!section || !repairSelect) {
        console.error("Diagnosis elements not found.");
        return;
    }

    hideSections();

    section.style.display = "block";

    repairSelect.innerHTML = "";

    const placeholder =
        document.createElement("option");

    placeholder.value = "";
    placeholder.textContent =
        "Select an assigned repair";

    repairSelect.appendChild(placeholder);

    if (message) {
        message.textContent = "";
    }

    try {
        const repairs = await fetchAssignedRepairs();

        repairs.forEach((repair) => {
            const option =
                document.createElement("option");

            option.value = repair.repair_id;

            option.textContent =
                `#${repair.repair_id} - ${
                    repair.brand || "Unknown"
                } ${
                    repair.model || "Device"
                } (${repair.status})`;

            repairSelect.appendChild(option);
        });

        if (repairs.length === 0 && message) {
            message.textContent =
                "No assigned repairs available for diagnosis.";
        }

    } catch (error) {
        console.error(
            "Load diagnosis repairs error:",
            error
        );

        if (message) {
            message.textContent = error.message;
            message.style.color = "#dc2626";
        }
    }

    await loadSavedDiagnoses();

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ==================================
// SAVE DIAGNOSIS
// ==================================

async function saveDiagnosis(event) {
    event.preventDefault();

    const repairSelect =
        document.getElementById("diagnosisRepair");

    const detailsInput =
        document.getElementById("diagnosisDetails");

    const actionInput =
        document.getElementById("recommendedAction");

    const saveButton =
        document.getElementById("saveDiagnosisBtn");

    const message =
        document.getElementById("diagnosisMessage");

    const repairId = Number(repairSelect.value);
    const diagnosisDetails = detailsInput.value.trim();
    const recommendedAction = actionInput.value.trim();

    if (
        !Number.isSafeInteger(repairId) ||
        repairId <= 0 ||
        !diagnosisDetails
    ) {
        message.textContent =
            "Select a repair and enter diagnosis details.";

        message.style.color = "#dc2626";
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    message.textContent = "Saving diagnosis...";
    message.style.color = "#475569";

    try {
        const response = await fetch(
            `${TECHNICIAN_API}/diagnoses`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    repair_id: repairId,
                    diagnosis_details: diagnosisDetails,
                    recommended_action: recommendedAction
                })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message ||
                `Unable to save diagnosis (HTTP ${response.status}).`
            );
        }

        message.textContent =
            "Diagnosis saved successfully!";

        message.style.color = "#15803d";

        detailsInput.value = "";
        actionInput.value = "";

        await loadSavedDiagnoses();

    } catch (error) {
        console.error("Save diagnosis error:", error);

        message.textContent = error.message;
        message.style.color = "#dc2626";

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Diagnosis";
    }
}

// ==================================
// LOAD SAVED DIAGNOSES
// ==================================

async function loadSavedDiagnoses() {
    const list =
        document.getElementById("diagnosisList");

    if (!list) {
        return;
    }

    list.textContent = "Loading diagnoses...";

    try {
        const response = await fetch(
            `${TECHNICIAN_API}/diagnoses/mine`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message ||
                `Unable to load diagnoses (HTTP ${response.status}).`
            );
        }

        if (!Array.isArray(data)) {
            throw new Error("Invalid diagnosis data.");
        }

        list.innerHTML = "";

        if (data.length === 0) {
            list.textContent =
                "No diagnoses recorded yet.";
            return;
        }

        data.forEach((diagnosis) => {
            const card = document.createElement("div");

            card.className = "registered-device";
            card.style.padding = "20px";
            card.style.marginTop = "15px";

            const title = document.createElement("h4");

            title.textContent =
                `${diagnosis.brand || "Unknown"} ${
                    diagnosis.model || "Device"
                }`;

            const details = document.createElement("p");

            details.textContent =
                `Diagnosis: ${diagnosis.diagnosis_details}`;

            const action = document.createElement("p");

            action.textContent =
                `Recommended Action: ${
                    diagnosis.recommended_action || "None"
                }`;

            const date = document.createElement("p");

            date.textContent =
                `Diagnosed: ${
                    diagnosis.date_diagnosed
                        ? new Date(
                            diagnosis.date_diagnosed
                        ).toLocaleDateString()
                        : "Not available"
                }`;

            card.append(
                title,
                details,
                action,
                date
            );

            list.appendChild(card);
        });

    } catch (error) {
        console.error(
            "Load diagnoses error:",
            error
        );

        list.textContent = error.message;
    }
}

// ==================================
// REPAIR HISTORY
// ==================================

async function loadRepairHistory() {
    const section =
        document.getElementById("assignedRepairsSection");

    const list =
        document.getElementById("assignedRepairsList");

    if (!section || !list) {
        return;
    }

    hideSections();

    section.style.display = "block";

    const heading = section.querySelector("h3");

    if (heading) {
        heading.textContent = "My Repair History";
    }

    list.textContent = "Loading repair history...";

    try {
        const repairs = await fetchAssignedRepairs();

        const history = repairs.filter(
            (repair) =>
                repair.status === "Completed" ||
                repair.status === "Released"
        );

        list.innerHTML = "";

        if (history.length === 0) {
            list.textContent =
                "No completed or released repairs yet.";
            return;
        }

        history.forEach((repair) => {
            createRepairCard(repair, list, false);
        });

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error("Repair history error:", error);

        list.textContent = error.message;
    }
}

// ==================================
// LOGOUT
// ==================================

function logout() {
    localStorage.removeItem("fixtrack_token");
    localStorage.removeItem("fixtrack_user");

    window.location.href = "index.html";
}
