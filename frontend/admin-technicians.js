
const TECHNICIANS_API =
    "https://fixtrack-backend.vercel.app/api/technicians";

const technicianToken = localStorage.getItem("fixtrack_token");

const technicianList = document.getElementById("technician-list");

function technicianHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${technicianToken}`
    };
}

function technicianFullName(technician) {
    return [
        technician.first_name,
        technician.middle_name,
        technician.last_name
    ].filter(Boolean).join(" ");
}

function showTechnicianMessage(message, isError = false) {
    let messageBox = document.getElementById("technician-action-message");

    if (!messageBox) {
        messageBox = document.createElement("p");
        messageBox.id = "technician-action-message";

        technicianList?.parentElement?.insertBefore(
            messageBox,
            technicianList
        );
    }

    messageBox.textContent = message;
    messageBox.style.color = isError ? "#dc2626" : "#15803d";
}

async function loadTechnicians() {
    if (!technicianList) return;

    technicianList.textContent = "Loading technicians...";

    try {
        const response = await fetch(TECHNICIANS_API, {
            headers: technicianHeaders()
        });

        const technicians = await response.json();

        if (!response.ok) {
            throw new Error(
                technicians.message || "Unable to load technicians."
            );
        }

        technicianList.replaceChildren();

        if (!technicians.length) {
            technicianList.textContent = "No technicians found.";
            return;
        }

        technicians.forEach(technician => {
            const card = document.createElement("div");
            card.className = "technician-card";

            const name = document.createElement("h3");
            name.textContent = technicianFullName(technician);

            const email = document.createElement("p");
            email.textContent = `Email: ${technician.email}`;

            const status = document.createElement("p");
            status.textContent =
                `Status: ${technician.status || "Active"}`;

            const actions = document.createElement("div");
            actions.className = "technician-actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.className = "technician-edit-btn";
            editButton.addEventListener("click", () => {
                editTechnician(technician);
            });

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Remove";
            removeButton.className = "technician-remove-btn";
            removeButton.addEventListener("click", () => {
                removeTechnician(technician);
            });

            actions.append(editButton, removeButton);
            card.append(name, email, status, actions);
            technicianList.append(card);
        });

    } catch (error) {
        technicianList.textContent = "";
        showTechnicianMessage(error.message, true);
    }
}

async function editTechnician(technician) {
    const firstName = prompt(
        "First Name:",
        technician.first_name || ""
    );
    if (firstName === null) return;

    const middleName = prompt(
        "Middle Name:",
        technician.middle_name || ""
    );
    if (middleName === null) return;

    const lastName = prompt(
        "Last Name:",
        technician.last_name || ""
    );
    if (lastName === null) return;

    const email = prompt(
        "Email:",
        technician.email || ""
    );
    if (email === null) return;

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        showTechnicianMessage(
            "First name, last name, and email are required.",
            true
        );
        return;
    }

    try {
        const response = await fetch(
            `${TECHNICIANS_API}/${technician.technician_id}`,
            {
                method: "PUT",
                headers: technicianHeaders(),
                body: JSON.stringify({
                    first_name: firstName.trim(),
                    middle_name: middleName.trim(),
                    last_name: lastName.trim(),
                    email: email.trim()
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Unable to update technician."
            );
        }

        showTechnicianMessage("Technician updated successfully.");
        await loadTechnicians();

    } catch (error) {
        showTechnicianMessage(error.message, true);
    }
}

async function removeTechnician(technician) {
    const confirmed = confirm(
        `Remove ${technicianFullName(technician)}?\n\n` +
        "This action requires confirmation."
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${TECHNICIANS_API}/${technician.technician_id}`,
            {
                method: "DELETE",
                headers: technicianHeaders()
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Unable to remove technician."
            );
        }

        showTechnicianMessage(
            result.message || "Technician removed successfully."
        );

        await loadTechnicians();

    } catch (error) {
        showTechnicianMessage(error.message, true);
    }
}

document.addEventListener("DOMContentLoaded", loadTechnicians);
