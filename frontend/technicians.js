
const TECHNICIANS_API = "https://fixtrack-backend.vercel.app/api/technicians";

const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

const technicianList = document.getElementById("technician-list");
const technicianMessage = document.getElementById("technician-message");
const technicianForm = document.getElementById("technician-form");

let isAdmin = false;

// =========================
// CHECK ADMIN LOGIN
// =========================

try {
    const user = userData ? JSON.parse(userData) : null;

    isAdmin = Boolean(
        token &&
        user &&
        user.role === "admin"
    );

} catch (error) {
    console.error("Invalid user data:", error);
}

if (!isAdmin) {
    window.location.replace("index.html");
} else {
    initializeTechnicians();
}

// =========================
// DISPLAY MESSAGES
// =========================

function showMessage(message, isError = false) {
    if (!technicianMessage) return;

    technicianMessage.textContent = message;
    technicianMessage.style.color = isError
        ? "#dc2626"
        : "#15803d";

    technicianMessage.setAttribute("role", "status");
}

// =========================
// INITIALIZE PAGE
// =========================

async function initializeTechnicians() {
    if (!technicianForm || !technicianList) {
        console.error("Technician form or list not found.");
        return;
    }

    technicianForm.addEventListener(
        "submit",
        createTechnician
    );

    await loadTechnicians();
}

// =========================
// LOAD ALL TECHNICIANS
// =========================

async function loadTechnicians() {
    technicianList.textContent = "Loading technicians...";

    try {
        const response = await fetch(TECHNICIANS_API, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            technicianList.textContent =
                data.message ||
                `Unable to load technicians (HTTP ${response.status}).`;
            return;
        }

        const technicians = Array.isArray(data)
            ? data
            : Array.isArray(data.technicians)
                ? data.technicians
                : null;

        if (!technicians) {
            technicianList.textContent =
                "Invalid technician data received.";
            return;
        }

        if (technicians.length === 0) {
            technicianList.textContent =
                "No technicians registered yet.";
            return;
        }

        technicianList.replaceChildren();

        technicians.forEach((technician) => {
            const card = document.createElement("div");
            card.className = "registered-device";
            card.style.marginBottom = "15px";

            const name = document.createElement("h4");

            name.textContent = [
                technician.first_name,
                technician.middle_name,
                technician.last_name
            ].filter(Boolean).join(" ");

            const email = document.createElement("p");
            email.textContent = `Email: ${technician.email}`;

            const role = document.createElement("p");
            role.textContent = `Role: ${technician.role}`;

            const date = document.createElement("p");

            if (technician.created_at) {
                date.textContent =
                    `Created: ${new Date(
                        technician.created_at
                    ).toLocaleDateString()}`;
            }

            card.append(name, email, role, date);
            technicianList.appendChild(card);
        });

    } catch (error) {
        console.error("Load technicians error:", error);

        technicianList.textContent =
            "Unable to connect to the FixTrack backend.";
    }
}

// =========================
// CREATE TECHNICIAN
// =========================

async function createTechnician(event) {
    event.preventDefault();

    // Match existing technicians.html IDs
    const firstName = document.getElementById("tech-first-name");
    const middleName = document.getElementById("tech-middle-name");
    const lastName = document.getElementById("tech-last-name");
    const email = document.getElementById("tech-email");
    const password = document.getElementById("tech-password");

    if (!firstName || !lastName || !email || !password) {
        showMessage(
            "Technician form fields were not found.",
            true
        );
        return;
    }

    const technicianData = {
        first_name: firstName.value.trim(),
        middle_name: middleName
            ? middleName.value.trim()
            : "",
        last_name: lastName.value.trim(),
        email: email.value.trim().toLowerCase(),
        password: password.value
    };

    if (
        !technicianData.first_name ||
        !technicianData.last_name ||
        !technicianData.email ||
        !technicianData.password
    ) {
        showMessage(
            "Please complete all required fields.",
            true
        );
        return;
    }

    if (technicianData.password.length < 8) {
        showMessage(
            "Password must be at least 8 characters.",
            true
        );
        return;
    }

    const submitButton = technicianForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating...";
    }

    showMessage("Creating technician account...");

    try {
        const response = await fetch(TECHNICIANS_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(technicianData)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showMessage(
                data.message ||
                `Unable to create technician (HTTP ${response.status}).`,
                true
            );
            return;
        }

        // Clear form only after successful creation
        technicianForm.reset();

        showMessage(
            data.message ||
            "Technician account created successfully!"
        );

        // Refresh technician list
        await loadTechnicians();

    } catch (error) {
        console.error("Create technician error:", error);

        showMessage(
            "Unable to connect to the FixTrack backend.",
            true
        );

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Add Technician";
        }
    }
}
