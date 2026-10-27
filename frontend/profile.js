
const PROFILE_API = "https://fixtrack-backend.vercel.app/api/profile";

const token = localStorage.getItem("fixtrack_token");
const savedUser = localStorage.getItem("fixtrack_user");

const form = document.getElementById("profile-form");
const messageBox = document.getElementById("message");
const phonesList = document.getElementById("phones-list");
const addressesList = document.getElementById("addresses-list");

const editButton = document.getElementById("edit-profile-btn");
const cancelButton = document.getElementById("cancel-edit-btn");
const saveButton = document.getElementById("save-button");
const actions = document.getElementById("profile-actions");
const addPhoneButton = document.getElementById("add-phone");
const addAddressButton = document.getElementById("add-address");

let phones = [];
let addresses = [];
let editing = false;
let profileLoaded = false;

function field(id) {
    return document.getElementById(id);
}

function notify(text, isError = false) {
    messageBox.textContent = text;
    messageBox.style.color = isError ? "#dc2626" : "#15803d";
}

function element(tag, className = "", text = "") {
    const item = document.createElement(tag);
    item.className = className;
    item.textContent = text;
    return item;
}

async function api(method, data) {
    const response = await fetch(PROFILE_API, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(data ? { "Content-Type": "application/json" } : {})
        },
        ...(data ? { body: JSON.stringify(data) } : {})
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.error ||
            result.message ||
            `Request failed (${response.status})`
        );
    }

    return result;
}

function setEditMode(enabled) {
    editing = enabled;

    ["first_name", "middle_name", "last_name", "email"].forEach(id => {
        field(id).readOnly = !enabled;
    });

    field("role").readOnly = true;

    actions.hidden = !enabled;
    addPhoneButton.hidden = !enabled;
    addAddressButton.hidden = !enabled;

    editButton.textContent = enabled ? "Cancel Editing" : "Edit Profile";

    drawPhones();
    drawAddresses();
}

function createInput(labelText, value, onChange, maxLength) {
    const label = element("label");
    label.append(document.createTextNode(labelText));

    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.maxLength = maxLength;
    input.disabled = !editing;

    input.addEventListener("input", () => {
        onChange(input.value);
    });

    label.appendChild(input);
    return label;
}

function drawPhones() {
    phonesList.replaceChildren();

    if (!phones.length) {
        phonesList.appendChild(
            element("p", "empty", "No contact number yet. Select Edit Profile to add one.")
        );
        return;
    }

    phones.forEach((phone, index) => {
        const card = element("div", "entry");

        card.appendChild(
            element("div", "entry-title", `Contact Number ${index + 1}`)
        );

        const grid = element("div", "profile-phone-fields");

        grid.appendChild(createInput(
            "Phone Number",
            phone.phone_number,
            value => phone.phone_number = value,
            30
        ));

        // Preserve the saved phone type in data, without displaying an unnecessary field.

        card.appendChild(grid);

        if (editing) {
            const remove = element("button", "remove", "Remove Phone");
            remove.type = "button";

            remove.addEventListener("click", () => {
                phones.splice(index, 1);
                drawPhones();
            });

            card.appendChild(remove);
        }

        phonesList.appendChild(card);
    });
}

function drawAddresses() {
    addressesList.replaceChildren();

    if (!addresses.length) {
        addressesList.appendChild(
            element("p", "empty", "No saved address yet. Select Edit Profile to add one.")
        );
        return;
    }

    addresses.forEach((address, index) => {
        const card = element("div", "entry");

        card.appendChild(
            element("div", "entry-title", `Address ${index + 1}`)
        );

        const firstGrid = element("div", "grid two");

        firstGrid.appendChild(createInput(
            "Street Address",
            address.street_address,
            value => address.street_address = value,
            255
        ));

        firstGrid.appendChild(createInput(
            "City",
            address.city,
            value => address.city = value,
            100
        ));

        const secondGrid = element("div", "grid two");

        secondGrid.appendChild(createInput(
            "Province",
            address.province,
            value => address.province = value,
            100
        ));

        secondGrid.appendChild(createInput(
            "Postal Code",
            address.postal_code,
            value => address.postal_code = value,
            20
        ));

        card.append(firstGrid, secondGrid);

        const primaryLabel = element("label", "primary-choice");
        const primaryRadio = document.createElement("input");

        primaryRadio.type = "radio";
        primaryRadio.name = "primary-address";
        primaryRadio.checked = Boolean(address.is_primary);
        primaryRadio.disabled = !editing;

        primaryRadio.addEventListener("change", () => {
            addresses.forEach((item, i) => {
                item.is_primary = i === index;
            });

            drawAddresses();
        });

        primaryLabel.append(
            primaryRadio,
            document.createTextNode("Primary Address")
        );

        card.appendChild(primaryLabel);

        if (editing) {
            const remove = element("button", "remove", "Remove Address");
            remove.type = "button";

            remove.addEventListener("click", () => {
                const wasPrimary = address.is_primary;

                addresses.splice(index, 1);

                if (wasPrimary && addresses.length) {
                    addresses.forEach((item, i) => {
                        item.is_primary = i === 0;
                    });
                }

                drawAddresses();
            });

            card.appendChild(remove);
        }

        addressesList.appendChild(card);
    });
}

function populateUser(user) {
    field("first_name").value = user.first_name || "";
    field("middle_name").value = user.middle_name || "";
    field("last_name").value = user.last_name || "";
    field("email").value = user.email || "";
    field("role").value = user.role || "customer";
}

async function loadProfile() {
    notify("Loading profile...");

    try {
        const data = await api("GET");

        if (!data.user) {
            throw new Error("Customer information not found.");
        }

        populateUser(data.user);

        phones = Array.isArray(data.phones) ? data.phones : [];
        addresses = Array.isArray(data.addresses) ? data.addresses : [];

        profileLoaded = true;
        editButton.disabled = false;

        setEditMode(false);
        notify("");

    } catch (error) {
        console.error("Profile loading failed:", error);
        notify("Failed to load profile: " + error.message, true);
    }
}

function cancelEditing() {
    setEditMode(false);
    loadProfile();
}

editButton.addEventListener("click", () => {
    if (!profileLoaded) return;

    if (editing) {
        cancelEditing();
    } else {
        setEditMode(true);
    }
});

cancelButton.addEventListener("click", cancelEditing);

addPhoneButton.addEventListener("click", () => {
    if (!editing) return;

    if (phones.length >= 10) {
        notify("Maximum of 10 phone numbers.", true);
        return;
    }

    phones.push({
        phone_number: "",
        type: "Mobile"
    });

    drawPhones();
});

addAddressButton.addEventListener("click", () => {
    if (!editing) return;

    if (addresses.length >= 10) {
        notify("Maximum of 10 addresses.", true);
        return;
    }

    addresses.push({
        street_address: "",
        city: "",
        province: "",
        postal_code: "",
        is_primary: addresses.length === 0
    });

    drawAddresses();
});

form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!editing || !profileLoaded) return;

    const firstName = field("first_name").value.trim();
    const middleName = field("middle_name").value.trim();
    const lastName = field("last_name").value.trim();
    const email = field("email").value.trim();

    if (!firstName || !lastName || !email) {
        notify("Please complete your name and email.", true);
        return;
    }

    const cleanPhones = phones.filter(phone =>
        String(phone.phone_number || "").trim() !== ""
    );

    const cleanAddresses = addresses.filter(address =>
        [
            address.street_address,
            address.city,
            address.province,
            address.postal_code
        ].some(value => String(value || "").trim() !== "")
    );

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        await api("PUT", {
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            email,
            phones: cleanPhones,
            addresses: cleanAddresses
        });

        let user = {};

        try {
            user = JSON.parse(
                localStorage.getItem("fixtrack_user") || "{}"
            );
        } catch (_) {
            user = {};
        }

        user.first_name = firstName;
        user.middle_name = middleName;
        user.last_name = lastName;
        user.email = email;

        localStorage.setItem(
            "fixtrack_user",
            JSON.stringify(user)
        );

        await loadProfile();

        if (!editing) {
            notify("Profile updated successfully!");
        }

    } catch (error) {
        console.error("Profile save failed:", error);
        notify(error.message, true);

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
});

function startProfile() {
    actions.hidden = true;
    addPhoneButton.hidden = true;
    addAddressButton.hidden = true;
    editButton.disabled = true;

    if (!token) {
        notify("Please log in to view your profile.", true);
        form.hidden = true;
        editButton.hidden = true;
        return;
    }

    // Show saved login details while the database loads.
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            populateUser(user);
        } catch (error) {
            console.warn("Unable to read saved login information.");
        }
    }

    loadProfile();
}

startProfile();
