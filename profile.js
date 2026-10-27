// FIXTRACK CUSTOMER PROFILE API

const PROFILE_API =
    "https://fixtrack-backend.vercel.app/api/profile";

const token = localStorage.getItem("fixtrack_token");

const message = document.getElementById("message");
const phonesList = document.getElementById("phones-list");
const addressesList = document.getElementById("addresses-list");

let phones = [];
let addresses = [];
let editingProfile = false;

// DISPLAY MESSAGES

function notify(text, type = "") {
    message.textContent = text;
    message.className = type;
}

// CREATE SAFE HTML ELEMENTS

function createElement(tag, options = {}, children = []) {
    const element = document.createElement(tag);

    Object.entries(options).forEach(([key, value]) => {
        if (key === "className") {
            element.className = value;
        } else if (key === "textContent") {
            element.textContent = value;
        } else if (key === "value") {
            element.value = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    children.forEach(child => element.append(child));

    return element;
}

// CREATE INPUT FIELD

function createInput(labelText, value, onChange, maxLength = 255) {
    const field = createElement("input", {
        type: "text",
        value: value || "",
        maxlength: String(maxLength)
    });

    field.disabled = !editingProfile;

    field.addEventListener("input", () => {
        onChange(field.value);
    });

    return createElement("label", {}, [
        document.createTextNode(labelText),
        field
    ]);
}

// PHONE NUMBERS

function drawPhones() {
    phonesList.replaceChildren();

    if (phones.length === 0) {
        phonesList.append(
            createElement("p", {
                className: "empty",
                textContent: "No phone numbers registered."
            })
        );
    }

    phones.forEach((phone, index) => {
        const fields = createElement("div", {
            className: "grid two"
        }, [
            createInput(
                "Phone Number",
                phone.phone_number,
                value => phone.phone_number = value,
                30
            ),
            createInput(
                "Type (Mobile, Home, etc.)",
                phone.type,
                value => phone.type = value,
                50
            )
        ]);

        const removeButton = createElement("button", {
            type: "button",
            className: "remove",
            textContent: "Remove Phone"
        });

        removeButton.hidden = !editingProfile;

        removeButton.addEventListener("click", () => {
            phones.splice(index, 1);
            drawPhones();
        });

        phonesList.append(
            createElement("div", {
                className: "entry"
            }, [
                createElement("div", {
                    className: "entry-title",
                    textContent: `Phone ${index + 1}`
                }),
                fields,
                removeButton
            ])
        );
    });
}

// ADDRESSES

function drawAddresses() {
    addressesList.replaceChildren();

    if (addresses.length === 0) {
        addressesList.append(
            createElement("p", {
                className: "empty",
                textContent: "No addresses registered."
            })
        );
    }

    addresses.forEach((address, index) => {
        const fields = createElement("div", {}, [
            createElement("div", {
                className: "grid two"
            }, [
                createInput(
                    "Street Address",
                    address.street_address,
                    value => address.street_address = value,
                    255
                ),
                createInput(
                    "City",
                    address.city,
                    value => address.city = value,
                    100
                )
            ]),
            createElement("div", {
                className: "grid two"
            }, [
                createInput(
                    "Province",
                    address.province,
                    value => address.province = value,
                    100
                ),
                createInput(
                    "Postal Code",
                    address.postal_code,
                    value => address.postal_code = value,
                    20
                )
            ])
        ]);

        const primaryInput = createElement("input", {
            type: "radio",
            name: "primary-address"
        });

        primaryInput.checked = Boolean(address.is_primary);
        primaryInput.disabled = !editingProfile;

        primaryInput.addEventListener("change", () => {
            addresses.forEach((item, i) => {
                item.is_primary = i === index;
            });

            drawAddresses();
        });

        const primaryLabel = createElement("label", {
            className: "primary-choice"
        }, [
            primaryInput,
            document.createTextNode("Primary Address")
        ]);

        const removeButton = createElement("button", {
            type: "button",
            className: "remove",
            textContent: "Remove Address"
        });

        removeButton.hidden = !editingProfile;

        removeButton.addEventListener("click", () => {
            const wasPrimary = address.is_primary;

            addresses.splice(index, 1);

            if (wasPrimary && addresses.length > 0) {
                addresses[0].is_primary = true;
            }

            drawAddresses();
        });

        addressesList.append(
            createElement("div", {
                className: "entry"
            }, [
                createElement("div", {
                    className: "entry-title",
                    textContent: `Address ${index + 1}`
                }),
                fields,
                primaryLabel,
                removeButton
            ])
        );
    });
}

// API REQUEST

async function request(method, body = null) {
    const response = await fetch(PROFILE_API, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? {
                "Content-Type": "application/json"
            } : {})
        },
        ...(body ? {
            body: JSON.stringify(body)
        } : {})
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.error || `Request failed (${response.status})`
        );
    }

    return result;
}

// PROFILE EDIT MODE

function setEditMode(editing) {
    editingProfile = editing;

    [
        "first_name",
        "middle_name",
        "last_name",
        "email"
    ].forEach(id => {
        document.getElementById(id).readOnly = !editing;
    });

    document.getElementById("role").readOnly = true;

    document.getElementById("save-button").hidden = !editing;
    document.getElementById("add-phone").hidden = !editing;
    document.getElementById("add-address").hidden = !editing;

    document.getElementById("edit-profile-btn").textContent =
        editing ? "Cancel Editing" : "Edit Profile";

    document.querySelectorAll(
        "#phones-list input, #addresses-list input"
    ).forEach(input => {
        input.disabled = !editing;
    });

    document.querySelectorAll(
        "#phones-list .remove, #addresses-list .remove"
    ).forEach(button => {
        button.hidden = !editing;
    });
}

// LOAD PROFILE

async function loadProfile() {
    try {
        notify("Loading your profile...");

        const data = await request("GET");

        if (!data.user) {
            throw new Error("Customer information not found.");
        }

        const user = data.user;

        document.getElementById("first_name").value =
            user.first_name || "";

        document.getElementById("middle_name").value =
            user.middle_name || "";

        document.getElementById("last_name").value =
            user.last_name || "";

        document.getElementById("email").value =
            user.email || "";

        document.getElementById("role").value =
            user.role || "customer";

        phones = data.phones || [];
        addresses = data.addresses || [];

        drawPhones();
        drawAddresses();

        setEditMode(false);
        notify("");

    } catch (error) {
        console.error("Profile loading error:", error);

        notify(
            "Failed to load profile: " + error.message,
            "error"
        );
    }
}

// EDIT PROFILE BUTTON

document.getElementById("edit-profile-btn")
    .addEventListener("click", async () => {
        if (editingProfile) {
            await loadProfile();
        } else {
            setEditMode(true);
        }
    });

// ADD PHONE

document.getElementById("add-phone")
    .addEventListener("click", () => {
        if (phones.length >= 10) {
            return notify(
                "Maximum 10 phone numbers.",
                "error"
            );
        }

        phones.push({
            phone_number: "",
            type: "Mobile"
        });

        drawPhones();
        setEditMode(true);
    });

// ADD ADDRESS

document.getElementById("add-address")
    .addEventListener("click", () => {
        if (addresses.length >= 10) {
            return notify(
                "Maximum 10 addresses.",
                "error"
            );
        }

        addresses.push({
            street_address: "",
            city: "",
            province: "",
            postal_code: "",
            is_primary: addresses.length === 0
        });

        drawAddresses();
        setEditMode(true);
    });

// SAVE PROFILE

document.getElementById("profile-form")
    .addEventListener("submit", async event => {
        event.preventDefault();

        if (!editingProfile) return;

        const saveButton = document.getElementById("save-button");

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            await request("PUT", {
                first_name: document.getElementById("first_name").value,
                middle_name: document.getElementById("middle_name").value,
                last_name: document.getElementById("last_name").value,
                email: document.getElementById("email").value,
                phones,
                addresses
            });

            // UPDATE SAVED CUSTOMER NAME

            const savedUser = JSON.parse(
                localStorage.getItem("fixtrack_user") || "{}"
            );

            savedUser.first_name =
                document.getElementById("first_name").value;

            savedUser.middle_name =
                document.getElementById("middle_name").value;

            savedUser.last_name =
                document.getElementById("last_name").value;

            savedUser.email =
                document.getElementById("email").value;

            localStorage.setItem(
                "fixtrack_user",
                JSON.stringify(savedUser)
            );

            await loadProfile();

            notify(
                "Profile updated successfully!",
                "success"
            );

        } catch (error) {
            notify(error.message, "error");

        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save Changes";
        }
    });

// START PAGE

setEditMode(false);

if (!token) {
    notify("Please log in to view your profile.", "error");

    document.getElementById("profile-form").hidden = true;
    document.getElementById("edit-profile-btn").hidden = true;
} else {
    loadProfile();
}
