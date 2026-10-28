
const API_URL = "https://fixtrack-backend.vercel.app/api/devices";

const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

// =========================
// CHECK CUSTOMER LOGIN
// =========================

let deviceUser = null;
try { deviceUser = JSON.parse(userData); } catch (e) {}

if (!token || !deviceUser || deviceUser.role !== "customer") {
    window.location.replace("index.html");
}

// =========================
// PAGE ELEMENTS
// =========================

const deviceForm = document.getElementById("device-form");
const deviceMessage = document.getElementById("device-message");
const deviceList = document.getElementById("device-list");

// =========================
// EDIT MODAL ELEMENTS
// =========================

const editModal = document.getElementById("edit-device-modal");
const editForm = document.getElementById("edit-device-form");

const editDeviceId = document.getElementById("edit-device-id");
const editDeviceType = document.getElementById("edit-device-type");
const editBrand = document.getElementById("edit-brand");
const editModel = document.getElementById("edit-model");
const editSerialNumber = document.getElementById("edit-serial-number");
const editAccessories = document.getElementById("edit-accessories");

const editMessage = document.getElementById("edit-device-message");

const closeEditModalButton =
    document.getElementById("close-edit-modal");

const cancelEditButton =
    document.getElementById("cancel-edit-btn");

// =========================
// ADD DEVICE
// =========================

deviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    deviceMessage.textContent = "Adding device...";

    const deviceData = {
        device_type:
            document.getElementById("device-type").value,

        brand:
            document.getElementById("brand").value.trim(),

        model:
            document.getElementById("model").value.trim(),

        serial_number:
            document.getElementById("serial-number").value.trim(),

        accessories_included:
            document.getElementById("accessories").value.trim()
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify(deviceData)
        });

        const data = await response.json();

        if (!response.ok) {
            deviceMessage.textContent = data.message;
            return;
        }

        deviceMessage.textContent =
            "Device added successfully!";

        deviceForm.reset();

        loadDevices();

    } catch (error) {
        console.error("Add device error:", error);

        deviceMessage.textContent =
            "Unable to connect to the FixTrack server.";
    }
});

// =========================
// LOAD DEVICES
// =========================

async function loadDevices() {
    deviceList.innerHTML =
        "<p>Loading devices...</p>";

    try {
        const response = await fetch(API_URL, {
            method: "GET",

            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const devices = await response.json();

        if (!response.ok) {
            deviceList.innerHTML =
                `<p>${devices.message || "Unable to load devices."}</p>`;
            return;
        }

        if (devices.length === 0) {
            deviceList.innerHTML =
                "<p>No registered devices yet.</p>";
            return;
        }

        deviceList.innerHTML = "";

        devices.forEach((device) => {
            const deviceCard =
                document.createElement("div");

            deviceCard.classList.add(
                "registered-device"
            );

            deviceCard.innerHTML = `
                <div class="registered-device-header">
                    <h4>
                        ${device.brand} ${device.model}
                    </h4>

                    <span>
                        ${device.device_type}
                    </span>
                </div>

                <div class="device-details">
                    <p>
                        <strong>Serial Number:</strong>
                        ${device.serial_number || "Not provided"}
                    </p>

                    <p>
                        <strong>Accessories:</strong>
                        ${device.accessories_included || "None"}
                    </p>
                </div>

                <div class="device-actions">
                    <button
                        type="button"
                        class="edit-device-btn">
                        Edit
                    </button>

                    <button
                        type="button"
                        class="remove-device-btn">
                        Remove
                    </button>
                </div>
            `;

            deviceList.appendChild(deviceCard);

            // EDIT BUTTON
            const editButton =
                deviceCard.querySelector(
                    ".edit-device-btn"
                );

            editButton.addEventListener(
                "click",
                () => {
                    openEditModal(device);
                }
            );

            // REMOVE BUTTON
            const removeButton =
                deviceCard.querySelector(
                    ".remove-device-btn"
                );

            removeButton.addEventListener(
                "click",
                () => {
                    removeDevice(device.device_id);
                }
            );
        });

    } catch (error) {
        console.error("Load devices error:", error);

        deviceList.innerHTML =
            "<p>Unable to connect to the FixTrack server.</p>";
    }
}

// =========================
// OPEN EDIT MODAL
// =========================

function openEditModal(device) {
    editDeviceId.value = device.device_id;

    editDeviceType.value = device.device_type;

    editBrand.value = device.brand || "";

    editModel.value = device.model || "";

    editSerialNumber.value =
        device.serial_number || "";

    editAccessories.value =
        device.accessories_included || "";

    editMessage.textContent = "";

    editModal.classList.remove("hidden");
}

// =========================
// CLOSE EDIT MODAL
// =========================

function closeEditModal() {
    editModal.classList.add("hidden");

    editForm.reset();

    editDeviceId.value = "";

    editMessage.textContent = "";
}

// X BUTTON
closeEditModalButton.addEventListener(
    "click",
    closeEditModal
);

// CANCEL BUTTON
cancelEditButton.addEventListener(
    "click",
    closeEditModal
);

// CLICK DARK BACKGROUND TO CLOSE
editModal.addEventListener("click", (event) => {
    if (event.target === editModal) {
        closeEditModal();
    }
});

// ESC KEY TO CLOSE
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        !editModal.classList.contains("hidden")
    ) {
        closeEditModal();
    }
});

// =========================
// SAVE EDITED DEVICE
// =========================

editForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const deviceId = editDeviceId.value;

        const updatedDevice = {
            device_type:
                editDeviceType.value,

            brand:
                editBrand.value.trim(),

            model:
                editModel.value.trim(),

            serial_number:
                editSerialNumber.value.trim(),

            accessories_included:
                editAccessories.value.trim()
        };

        // CHECK REQUIRED FIELDS
        if (
            !updatedDevice.device_type ||
            !updatedDevice.brand ||
            !updatedDevice.model
        ) {
            editMessage.textContent =
                "Device type, brand, and model are required.";
            return;
        }

        editMessage.textContent =
            "Saving changes...";

        try {
            const response = await fetch(
                `${API_URL}/${deviceId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },

                    body: JSON.stringify(updatedDevice)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                editMessage.textContent = data.message;
                return;
            }

            deviceMessage.textContent =
                "Device updated successfully!";

            closeEditModal();

            loadDevices();

        } catch (error) {
            console.error("Update device error:", error);

            editMessage.textContent =
                "Unable to connect to the FixTrack server.";
        }
    }
);

// =========================
// REMOVE DEVICE
// =========================

async function removeDevice(deviceId) {
    const confirmed = confirm(
        "Are you sure you want to remove this device?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/${deviceId}`,
            {
                method: "DELETE",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message);
            return;
        }

        deviceMessage.textContent =
            "Device removed successfully!";

        loadDevices();

    } catch (error) {
        console.error("Remove device error:", error);

        alert(
            "Unable to connect to the FixTrack server."
        );
    }
}

// =========================
// LOAD PAGE
// =========================

loadDevices();
