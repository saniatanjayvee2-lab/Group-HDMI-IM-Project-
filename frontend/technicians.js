
const TECHNICIANS_API = "https://fixtrack-backend.vercel.app/api/technicians";

const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

const technicianList = document.getElementById("technician-list");
const technicianMessage = document.getElementById("technician-message");
const technicianForm = document.getElementById("technician-form");

let isAdmin = false;

try {
    const user = userData ? JSON.parse(userData) : null;
    isAdmin = Boolean(token && user && user.role === "admin");
} catch (error) {
    console.error("Invalid user data:", error);
}

if (!isAdmin) {
    window.location.replace("index.html");
} else {
    initializeTechnicians();
}

function showMessage(message, isError = false) {
    if (!technicianMessage) return;

    technicianMessage.textContent = message;
    technicianMessage.style.color = isError ? "#dc2626" : "#15803d";
    technicianMessage.setAttribute("role", "status");
}

function showListMessage(message, isError = false) {
    const element = document.getElementById("technician-action-message");

    if (!element) {
        showMessage(message, isError);
        return;
    }

    element.textContent = message;
    element.style.color = isError ? "#dc2626" : "#15803d";
    element.setAttribute("role", "status");
}

function apiHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
}

function fullName(technician) {
    return [
        technician.first_name,
        technician.middle_name,
        technician.last_name
    ].filter(Boolean).join(" ");
}

function isActiveTechnician(technician) {
    const status = String(technician.status || "Active")
        .trim()
        .toLowerCase();

    return status !== "inactive";
}

async function initializeTechnicians() {
    if (!technicianForm || !technicianList) {
        console.error("Technician form or list not found.");
        return;
    }

    technicianForm.addEventListener("submit", createTechnician);
    createEditModal();

    await loadTechnicians();
}

// ==========================================
// LOAD ACTIVE TECHNICIANS ONLY
// ==========================================

async function loadTechnicians() {
    technicianList.textContent = "Loading technicians...";

    try {
        const response = await fetch(TECHNICIANS_API, {
            headers: apiHeaders(),
            cache: "no-store"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to load technicians."
            );
        }

        const allTechnicians = Array.isArray(data)
            ? data
            : Array.isArray(data.technicians)
                ? data.technicians
                : null;

        if (!allTechnicians) {
            throw new Error("Invalid technician data received.");
        }

        // IMPORTANT FIX:
        // Hide technicians whose status is Inactive.
        // Their database records are preserved.
        const technicians = allTechnicians.filter(isActiveTechnician);

        technicianList.replaceChildren();

        if (technicians.length === 0) {
            technicianList.textContent = "No active technicians found.";
            return;
        }

        technicians.forEach(technician => {
            const card = document.createElement("div");

            card.className = "registered-device";
            card.style.marginBottom = "16px";
            card.style.padding = "18px";
            card.style.border = "1px solid #e2e8f0";
            card.style.borderRadius = "12px";

            const name = document.createElement("h4");
            name.textContent = fullName(technician);
            name.style.marginBottom = "10px";

            const email = document.createElement("p");
            email.textContent = `Email: ${technician.email}`;

            const role = document.createElement("p");
            role.textContent = `Role: ${technician.role}`;

            const status = document.createElement("p");
            status.textContent = `Status: ${technician.status || "Active"}`;

            const date = document.createElement("p");

            if (technician.created_at) {
                date.textContent = `Created: ${new Date(
                    technician.created_at
                ).toLocaleDateString()}`;
            }

            const actions = document.createElement("div");

            actions.style.display = "flex";
            actions.style.gap = "10px";
            actions.style.marginTop = "15px";
            actions.style.flexWrap = "wrap";

            // EDIT BUTTON
            const editButton = document.createElement("button");

            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.style.background = "#2563eb";
            editButton.style.color = "white";
            editButton.style.border = "none";
            editButton.style.padding = "10px 20px";
            editButton.style.borderRadius = "8px";
            editButton.style.cursor = "pointer";

            editButton.addEventListener("click", () => {
                openEditModal(technician);
            });

            actions.appendChild(editButton);

            // REMOVE BUTTON
            const removeButton = document.createElement("button");

            removeButton.type = "button";
            removeButton.textContent = "Remove";
            removeButton.style.background = "#dc2626";
            removeButton.style.color = "white";
            removeButton.style.border = "none";
            removeButton.style.padding = "10px 20px";
            removeButton.style.borderRadius = "8px";
            removeButton.style.cursor = "pointer";

            removeButton.addEventListener("click", () => {
                removeTechnician(technician, removeButton, card);
            });

            actions.appendChild(removeButton);

            card.append(name, email, role, status, date, actions);
            technicianList.appendChild(card);
        });

    } catch (error) {
        console.error("Load technicians error:", error);
        technicianList.textContent = error.message;
    }
}

// ==========================================
// ADD TECHNICIAN
// ==========================================

async function createTechnician(event) {
    event.preventDefault();

    const technicianData = {
        first_name: document.getElementById("tech-first-name").value.trim(),
        middle_name: document.getElementById("tech-middle-name").value.trim(),
        last_name: document.getElementById("tech-last-name").value.trim(),
        email: document.getElementById("tech-email").value.trim().toLowerCase(),
        password: document.getElementById("tech-password").value
    };

    if (
        !technicianData.first_name ||
        !technicianData.last_name ||
        !technicianData.email ||
        technicianData.password.length < 8
    ) {
        showMessage(
            "Please complete all required fields. Password must have at least 8 characters.",
            true
        );
        return;
    }

    const submitButton = technicianForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Creating...";

    try {
        const response = await fetch(TECHNICIANS_API, {
            method: "POST",
            headers: apiHeaders(),
            body: JSON.stringify(technicianData)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to create technician."
            );
        }

        technicianForm.reset();

        showMessage(
            data.message || "Technician created successfully."
        );

        await loadTechnicians();

    } catch (error) {
        showMessage(error.message, true);

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Add Technician";
    }
}

// ==========================================
// EDIT TECHNICIAN MODAL
// ==========================================

function createEditModal() {
    const overlay = document.createElement("div");

    overlay.id = "edit-technician-overlay";

    Object.assign(overlay.style, {
        display: "none",
        position: "fixed",
        inset: "0",
        background: "rgba(15,23,42,0.65)",
        zIndex: "9999",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
    });

    overlay.innerHTML = `
        <div style="
            background:white;
            border-radius:16px;
            padding:28px;
            width:100%;
            max-width:460px;
            max-height:90vh;
            overflow-y:auto;
            box-sizing:border-box;
        ">
            <h2 style="margin:0 0 8px;">
                Edit Technician
            </h2>

            <p style="margin-bottom:20px;color:#64748b;">
                Update technician account information.
            </p>

            <form id="edit-technician-form">

                <input type="hidden" id="edit-tech-id">

                <label for="edit-tech-first">
                    First Name
                </label>
                <input
                    id="edit-tech-first"
                    type="text"
                    maxlength="100"
                    required
                >

                <label for="edit-tech-middle">
                    Middle Name
                </label>
                <input
                    id="edit-tech-middle"
                    type="text"
                    maxlength="100"
                >

                <label for="edit-tech-last">
                    Last Name
                </label>
                <input
                    id="edit-tech-last"
                    type="text"
                    maxlength="100"
                    required
                >

                <label for="edit-tech-email">
                    Email
                </label>
                <input
                    id="edit-tech-email"
                    type="email"
                    maxlength="255"
                    required
                >

                <p id="edit-tech-message" role="status"></p>

                <div style="
                    display:flex;
                    gap:10px;
                    margin-top:20px;
                ">
                    <button
                        type="button"
                        id="cancel-tech-edit"
                        style="
                            flex:1;
                            background:#e2e8f0;
                            color:#0f172a;
                            padding:12px;
                            border:0;
                            border-radius:8px;
                            cursor:pointer;
                        "
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        id="save-tech-edit"
                        style="
                            flex:1;
                            background:#2563eb;
                            color:white;
                            padding:12px;
                            border:0;
                            border-radius:8px;
                            cursor:pointer;
                        "
                    >
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("cancel-tech-edit")
        .addEventListener("click", closeEditModal);

    document.getElementById("edit-technician-form")
        .addEventListener("submit", saveTechnicianEdit);
}

function openEditModal(technician) {
    document.getElementById("edit-tech-id").value =
        technician.technician_id;

    document.getElementById("edit-tech-first").value =
        technician.first_name || "";

    document.getElementById("edit-tech-middle").value =
        technician.middle_name || "";

    document.getElementById("edit-tech-last").value =
        technician.last_name || "";

    document.getElementById("edit-tech-email").value =
        technician.email || "";

    document.getElementById("edit-tech-message").textContent = "";

    document.getElementById("edit-technician-overlay").style.display =
        "flex";
}

function closeEditModal() {
    document.getElementById("edit-technician-overlay").style.display =
        "none";
}

async function saveTechnicianEdit(event) {
    event.preventDefault();

    const id = document.getElementById("edit-tech-id").value;

    const technicianData = {
        first_name: document.getElementById("edit-tech-first").value.trim(),
        middle_name: document.getElementById("edit-tech-middle").value.trim(),
        last_name: document.getElementById("edit-tech-last").value.trim(),
        email: document.getElementById("edit-tech-email").value.trim().toLowerCase()
    };

    const message = document.getElementById("edit-tech-message");
    const saveButton = document.getElementById("save-tech-edit");

    if (
        !technicianData.first_name ||
        !technicianData.last_name ||
        !technicianData.email
    ) {
        message.textContent = "Please complete all required fields.";
        message.style.color = "#dc2626";
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const response = await fetch(
            `${TECHNICIANS_API}/${id}`,
            {
                method: "PUT",
                headers: apiHeaders(),
                body: JSON.stringify(technicianData)
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to update technician."
            );
        }

        closeEditModal();

        showListMessage("Technician updated successfully.");

        await loadTechnicians();

    } catch (error) {
        message.textContent = error.message;
        message.style.color = "#dc2626";

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}

// ==========================================
// REMOVE TECHNICIAN
// ==========================================

async function removeTechnician(technician, button, card) {
    const confirmed = confirm(
        `Remove ${fullName(technician)} from the active technician team?\n\n` +
        "Existing repair history will be preserved."
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Removing...";

    try {
        const response = await fetch(
            `${TECHNICIANS_API}/${technician.technician_id}`,
            {
                method: "DELETE",
                headers: apiHeaders()
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to remove technician."
            );
        }

        // Immediately remove the technician card
        // after the backend confirms success.
        card.remove();

        showListMessage(
            data.message || "Technician removed from active list."
        );

        // Reload from the database to keep the list accurate.
        await loadTechnicians();

    } catch (error) {
        showListMessage(error.message, true);

        button.disabled = false;
        button.textContent = "Remove";
    }
}
