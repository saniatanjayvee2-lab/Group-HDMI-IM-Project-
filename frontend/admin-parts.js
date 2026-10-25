
const PARTS_API = "https://fixtrack-backend.vercel.app/api/parts";

const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

// =====================================
// HTML ELEMENTS
// =====================================

const partForm = document.getElementById("part-form");
const partIdInput = document.getElementById("part-id");
const partNameInput = document.getElementById("part-name");
const partDescriptionInput = document.getElementById("part-description");
const partPriceInput = document.getElementById("part-price");
const partStockInput = document.getElementById("part-stock");

const partFormTitle = document.getElementById("part-form-title");
const savePartBtn = document.getElementById("save-part-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const partMessage = document.getElementById("part-message");

const partsList = document.getElementById("parts-list");
const inventorySummary = document.getElementById("inventory-summary");

// =====================================
// CHECK ADMIN LOGIN
// =====================================

let currentUser = null;

try {
    currentUser = userData ? JSON.parse(userData) : null;
} catch (error) {
    console.error("Invalid user information:", error);
}

if (!token || !currentUser) {
    window.location.replace("index.html");

} else if (currentUser.role !== "admin") {
    window.location.replace(
        currentUser.role === "technician"
            ? "technician-dashboard.html"
            : "dashboard.html"
    );

} else {
    initializeInventory();
}

// =====================================
// INITIALIZE INVENTORY
// =====================================

function initializeInventory() {
    partForm.addEventListener("submit", savePart);

    cancelEditBtn.addEventListener("click", () => {
        resetPartForm();
        showMessage("Edit cancelled.", false);
    });

    loadParts();
}

// =====================================
// SHOW MESSAGE
// =====================================

function showMessage(message, isError = false) {
    partMessage.textContent = message;
    partMessage.style.color = isError
        ? "#dc2626"
        : "#15803d";
    partMessage.style.fontWeight = "600";
    partMessage.style.marginTop = "12px";
}

// =====================================
// HANDLE API RESPONSE
// =====================================

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error(
                data.message || "Your login has expired. Please log in again."
            );
        }

        throw new Error(
            data.message || `Request failed (HTTP ${response.status}).`
        );
    }

    return data;
}

// =====================================
// LOAD ALL PARTS
// =====================================

async function loadParts() {
    partsList.textContent = "Loading inventory...";

    try {
        const response = await fetch(PARTS_API, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const parts = await readResponse(response);

        if (!Array.isArray(parts)) {
            throw new Error("Invalid inventory data received.");
        }

        displayInventorySummary(parts);
        displayParts(parts);

    } catch (error) {
        console.error("Load inventory error:", error);
        partsList.textContent = error.message;
    }
}

// =====================================
// INVENTORY SUMMARY
// =====================================

function displayInventorySummary(parts) {
    const totalParts = parts.length;

    const totalStock = parts.reduce((total, part) => {
        return total + Number(part.stock_quantity || 0);
    }, 0);

    const lowStock = parts.filter(part => {
        return Number(part.stock_quantity) <= 5;
    }).length;

    inventorySummary.innerHTML = "";

    const summary = document.createElement("div");

    summary.style.padding = "15px";
    summary.style.marginBottom = "20px";
    summary.style.background = "#f1f5f9";
    summary.style.borderRadius = "8px";
    summary.style.lineHeight = "1.9";

    const totalPartsText = document.createElement("p");
    totalPartsText.textContent = `Different Parts: ${totalParts}`;

    const totalStockText = document.createElement("p");
    totalStockText.textContent = `Total Stock Units: ${totalStock}`;

    const lowStockText = document.createElement("p");
    lowStockText.textContent = `Low Stock Parts (5 or fewer): ${lowStock}`;

    summary.append(
        totalPartsText,
        totalStockText,
        lowStockText
    );

    inventorySummary.appendChild(summary);
}

// =====================================
// DISPLAY PARTS
// =====================================

function displayParts(parts) {
    partsList.innerHTML = "";

    if (parts.length === 0) {
        partsList.textContent =
            "No parts in inventory yet. Add your first part.";
        return;
    }

    parts.forEach(part => {
        const card = document.createElement("div");
        card.className = "registered-device";

        card.style.padding = "20px";
        card.style.marginBottom = "15px";

        const title = document.createElement("h4");
        title.textContent = part.name;

        const description = document.createElement("p");
        description.textContent =
            `Description: ${part.description || "None"}`;

        const price = document.createElement("p");

        price.textContent =
            `Unit Price: ${formatCurrency(part.unit_price)}`;

        const stock = document.createElement("p");
        stock.textContent =
            `Stock Quantity: ${part.stock_quantity}`;

        const stockStatus = document.createElement("p");

        const quantity = Number(part.stock_quantity);

        if (quantity === 0) {
            stockStatus.textContent = "Out of Stock";
            stockStatus.style.color = "#dc2626";

        } else if (quantity <= 5) {
            stockStatus.textContent = "Low Stock";
            stockStatus.style.color = "#d97706";

        } else {
            stockStatus.textContent = "In Stock";
            stockStatus.style.color = "#15803d";
        }

        stockStatus.style.fontWeight = "600";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.style.marginRight = "10px";

        editButton.addEventListener("click", () => {
            editPart(part);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.style.background = "#dc2626";

        deleteButton.addEventListener("click", () => {
            deletePart(part);
        });

        const actions = document.createElement("div");
        actions.style.marginTop = "15px";

        actions.append(editButton, deleteButton);

        card.append(
            title,
            description,
            price,
            stock,
            stockStatus,
            actions
        );

        partsList.appendChild(card);
    });
}

// =====================================
// FORMAT PRICE
// =====================================

function formatCurrency(value) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(value) || 0);
}

// =====================================
// ADD OR UPDATE PART
// =====================================

async function savePart(event) {
    event.preventDefault();

    const partId = partIdInput.value.trim();

    const name = partNameInput.value.trim();
    const description = partDescriptionInput.value.trim();

    const price = Number(partPriceInput.value);
    const stock = Number(partStockInput.value);

    if (!name) {
        showMessage("Please enter a part name.", true);
        return;
    }

    if (
        partPriceInput.value === "" ||
        !Number.isFinite(price) ||
        price < 0
    ) {
        showMessage("Please enter a valid unit price.", true);
        return;
    }

    if (
        partStockInput.value === "" ||
        !Number.isSafeInteger(stock) ||
        stock < 0
    ) {
        showMessage("Stock must be a whole number of zero or more.", true);
        return;
    }

    const isEditing = Boolean(partId);

    savePartBtn.disabled = true;
    savePartBtn.textContent = "Saving...";

    showMessage("Saving part...");

    try {
        const response = await fetch(
            isEditing
                ? `${PARTS_API}/${partId}`
                : PARTS_API,
            {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    description,
                    unit_price: price,
                    stock_quantity: stock
                })
            }
        );

        const data = await readResponse(response);

        resetPartForm();

        showMessage(
            data.message ||
            (isEditing
                ? "Part updated successfully."
                : "Part added successfully.")
        );

        await loadParts();

    } catch (error) {
        console.error("Save part error:", error);
        showMessage(error.message, true);

    } finally {
        savePartBtn.disabled = false;

        savePartBtn.textContent =
            partIdInput.value ? "Update Part" : "Add Part";
    }
}

// =====================================
// EDIT PART
// =====================================

function editPart(part) {
    partIdInput.value = part.part_id;

    partNameInput.value = part.name || "";
    partDescriptionInput.value = part.description || "";
    partPriceInput.value = part.unit_price;
    partStockInput.value = part.stock_quantity;

    partFormTitle.textContent = "Edit Part";
    savePartBtn.textContent = "Update Part";
    cancelEditBtn.style.display = "inline-block";

    showMessage(`Editing: ${part.name}`);

    partForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    partNameInput.focus();
}

// =====================================
// DELETE PART
// =====================================

async function deletePart(part) {
    const confirmed = window.confirm(
        `Are you sure you want to delete "${part.name}"?`
    );

    if (!confirmed) {
        return;
    }

    showMessage("Deleting part...");

    try {
        const response = await fetch(
            `${PARTS_API}/${part.part_id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await readResponse(response);

        if (partIdInput.value === String(part.part_id)) {
            resetPartForm();
        }

        showMessage(
            data.message || "Part deleted successfully."
        );

        await loadParts();

    } catch (error) {
        console.error("Delete part error:", error);
        showMessage(error.message, true);
    }
}

// =====================================
// RESET FORM
// =====================================

function resetPartForm() {
    partForm.reset();

    partIdInput.value = "";

    partFormTitle.textContent = "Add New Part";
    savePartBtn.textContent = "Add Part";

    cancelEditBtn.style.display = "none";
}
