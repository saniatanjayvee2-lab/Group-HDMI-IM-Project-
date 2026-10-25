
const API_URL = "http://localhost:3000/api/repairs";
const TECHNICIANS_API = "http://localhost:3000/api/technicians";
const BILLING_API = "http://localhost:3000/api/billing";
const PARTS_API = "http://localhost:3000/api/parts";

const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");
const repairList = document.getElementById("admin-repair-list");

let technicians = [];
let isAdmin = false;

// CHECK ADMIN LOGIN
try {
    const user = userData ? JSON.parse(userData) : null;
    isAdmin = Boolean(token && user && user.role === "admin");
} catch (error) {
    console.error("Invalid user data:", error);
}

if (!isAdmin) {
    window.location.replace("index.html");
} else {
    initializeAdminRepairs();
}

// HELPERS
function authHeaders(withJson = false) {
    return {
        Authorization: `Bearer ${token}`,
        ...(withJson ? { "Content-Type": "application/json" } : {})
    };
}

function formatMoney(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(amount) || 0);
}

function createElement(tag, text = "", className = "") {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "#dc2626" : "#15803d";
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...authHeaders(Boolean(options.body)),
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
    }
    return data;
}

// INITIALIZE
async function initializeAdminRepairs() {
    await loadTechnicians();
    await loadAdminRepairs();
}

// LOAD TECHNICIANS
async function loadTechnicians() {
    try {
        const data = await apiRequest(TECHNICIANS_API);
        technicians = Array.isArray(data)
            ? data
            : Array.isArray(data.technicians) ? data.technicians : [];
    } catch (error) {
        console.error("Load technicians error:", error);
        technicians = [];
    }
}

// LOAD ADMIN REPAIRS
async function loadAdminRepairs(successMessage = "") {
    if (!repairList) {
        console.error("Repair list element not found.");
        return;
    }

    repairList.textContent = "Loading repair requests...";
    try {
        const repairs = await apiRequest(`${API_URL}/admin`);
        if (!Array.isArray(repairs)) {
            repairList.textContent = "Invalid repair data.";
            return;
        }

        repairList.replaceChildren();
        if (successMessage) {
            const notice = createElement("p", successMessage, "repair-update-message");
            notice.setAttribute("role", "status");
            showMessage(notice, successMessage);
            repairList.appendChild(notice);
        }

        if (repairs.length === 0) {
            repairList.appendChild(createElement("p", "No customer repair requests yet."));
            return;
        }
        repairs.forEach(createRepairCard);
    } catch (error) {
        console.error("Load repairs error:", error);
        repairList.textContent = error.message;
    }
}

// CREATE REPAIR CARD
function createRepairCard(repair) {
    const card = createElement("div", "", "registered-device");
    card.classList.add("admin-repair-card");

    const title = createElement("h4", `${repair.brand || "Unknown"} ${repair.model || "Device"}`);
    const repairNumber = createElement("p", `Repair ID: #${repair.repair_id}`);
    const customer = createElement("p", `Customer: ${repair.first_name || ""} ${repair.last_name || ""}`);
    const problem = createElement("p", `Problem: ${repair.problem_description || "Not provided"}`);
    const submitted = createElement(
        "p",
        `Submitted: ${repair.date_submitted ? new Date(repair.date_submitted).toLocaleDateString() : "Unknown"}`
    );
    const currentStatus = createElement("p", `Current Status: ${repair.status}`);

    const assignedTechnician = technicians.find(
        tech => Number(tech.technician_id) === Number(repair.technician_id)
    );
    const assignmentInfo = createElement(
        "p",
        assignedTechnician
            ? `Assigned Technician: ${assignedTechnician.first_name} ${assignedTechnician.last_name}`
            : "Assigned Technician: Unassigned"
    );

    const technicianLabel = createElement("label", "Assign Technician");
    const technicianSelect = document.createElement("select");
    technicianSelect.className = "admin-technician-select";
    const unassignedOption = document.createElement("option");
    unassignedOption.value = "";
    unassignedOption.textContent = "Unassigned";
    technicianSelect.appendChild(unassignedOption);

    technicians.forEach(technician => {
        const option = document.createElement("option");
        option.value = String(technician.technician_id);
        option.textContent = `${technician.first_name} ${technician.last_name}`;
        technicianSelect.appendChild(option);
    });
    technicianSelect.value = repair.technician_id == null ? "" : String(repair.technician_id);

    const statusLabel = createElement("label", "Update Repair Status");
    const statusSelect = document.createElement("select");
    statusSelect.className = "admin-status-select";
    ["Pending", "In Progress", "Completed", "Released"].forEach(status => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        statusSelect.appendChild(option);
    });
    statusSelect.value = repair.status;

    const saveButton = createElement("button", "Save Changes", "save-edit-btn");
    saveButton.type = "button";
    const message = createElement("p", "", "repair-update-message");
    message.setAttribute("role", "status");

    saveButton.addEventListener("click", async () => {
        const technicianId = technicianSelect.value;
        const status = statusSelect.value;
        if (technicianId && (!Number.isSafeInteger(Number(technicianId)) || Number(technicianId) <= 0)) {
            showMessage(message, "Invalid technician selection.", true);
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
        try {
            const data = await apiRequest(`${API_URL}/admin/${repair.repair_id}`, {
                method: "PUT",
                body: JSON.stringify({
                    technician_id: technicianId ? Number(technicianId) : null,
                    status
                })
            });
            await loadAdminRepairs(data.message || "Repair request updated successfully!");
        } catch (error) {
            console.error("Update repair error:", error);
            showMessage(message, error.message, true);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save Changes";
        }
    });

    // BILLING SECTION (INSIDE EACH REPAIR CARD)
    const billingSection = document.createElement("section");
    billingSection.className = "repair-billing-section";
    const billingButton = createElement("button", "Manage Billing", "save-edit-btn");
    billingButton.type = "button";
    const billingContent = document.createElement("div");
    billingContent.className = "repair-billing-content";
    billingContent.hidden = true;
    let billingOpened = false;

    billingButton.addEventListener("click", async () => {
        billingOpened = !billingOpened;
        billingContent.hidden = !billingOpened;
        billingButton.textContent = billingOpened ? "Hide Billing" : "Manage Billing";
        if (billingOpened) {
            await renderBilling(repair.repair_id, repair.status, billingContent);
        }
    });
    billingSection.append(billingButton, billingContent);

    card.append(
        title, repairNumber, customer, problem, submitted, currentStatus,
        assignmentInfo, technicianLabel, technicianSelect,
        statusLabel, statusSelect, saveButton, message, billingSection
    );
    repairList.appendChild(card);
}

// RENDER REPAIR BILLING
async function renderBilling(repairId, repairStatus, container) {
    container.replaceChildren(createElement("p", "Loading billing information..."));

    try {
        const [bill, partsData] = await Promise.all([
            apiRequest(`${BILLING_API}/${repairId}`),
            apiRequest(PARTS_API)
        ]);
        const inventory = Array.isArray(partsData)
            ? partsData
            : Array.isArray(partsData.parts) ? partsData.parts : [];

        container.replaceChildren();
        container.appendChild(createElement("h3", `Repair Billing — #${repairId}`));
        const notice = createElement("p", "", "billing-message");
        notice.setAttribute("role", "status");
        container.appendChild(notice);

        const isReleased = bill.repair_status === "Released" || repairStatus === "Released";
        if (isReleased) {
            container.appendChild(createElement(
                "p", "This repair has been released. Billing changes are disabled."
            ));
        }

        // REPLACEMENT PARTS
        container.appendChild(createElement("h4", "Replacement Parts"));
        const partsList = document.createElement("div");

        if (!bill.parts || bill.parts.length === 0) {
            partsList.appendChild(createElement("p", "No replacement parts added."));
        } else {
            bill.parts.forEach(part => {
                const row = createElement("div", "", "billing-charge-row");
                row.appendChild(createElement(
                    "span", `${part.part_name} × ${part.quantity} — ${formatMoney(part.line_total)}`
                ));

                if (!isReleased) {
                    const removeButton = createElement("button", "Remove", "billing-remove-btn");
                    removeButton.type = "button";
                    removeButton.addEventListener("click", async () => {
                        if (!confirm("Remove this part from the repair?")) return;
                        removeButton.disabled = true;
                        try {
                            await apiRequest(
                                `${BILLING_API}/${repairId}/parts/${part.repair_part_id}`,
                                { method: "DELETE" }
                            );
                            await renderBilling(repairId, repairStatus, container);
                        } catch (error) {
                            showMessage(notice, error.message, true);
                            removeButton.disabled = false;
                        }
                    });
                    row.appendChild(removeButton);
                }
                partsList.appendChild(row);
            });
        }
        container.appendChild(partsList);

        if (!isReleased) {
            const partForm = createElement("form", "", "billing-entry-form");
            const partLabel = createElement("label", "Select Inventory Part");
            const partSelect = document.createElement("select");
            partSelect.required = true;
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Choose a part";
            partSelect.appendChild(placeholder);

            inventory.forEach(part => {
                const option = document.createElement("option");
                const stock = Number(part.stock_quantity);
                option.value = String(part.part_id);
                option.textContent = `${part.part_name || part.name} — ${formatMoney(part.unit_price)} (Stock: ${stock})`;
                option.disabled = !Number.isFinite(stock) || stock <= 0;
                partSelect.appendChild(option);
            });

            const quantityLabel = createElement("label", "Quantity");
            const quantityInput = document.createElement("input");
            quantityInput.type = "number";
            quantityInput.min = "1";
            quantityInput.step = "1";
            quantityInput.value = "1";
            quantityInput.required = true;
            const addPartButton = createElement("button", "Add Part", "save-edit-btn");
            addPartButton.type = "submit";
            partForm.append(partLabel, partSelect, quantityLabel, quantityInput, addPartButton);

            partForm.addEventListener("submit", async event => {
                event.preventDefault();
                const partId = Number(partSelect.value);
                const quantity = Number(quantityInput.value);
                if (!Number.isSafeInteger(partId) || partId <= 0 ||
                    !Number.isSafeInteger(quantity) || quantity <= 0) {
                    showMessage(notice, "Choose a valid part and quantity.", true);
                    return;
                }
                addPartButton.disabled = true;
                try {
                    await apiRequest(`${BILLING_API}/${repairId}/parts`, {
                        method: "POST",
                        body: JSON.stringify({ part_id: partId, quantity })
                    });
                    await renderBilling(repairId, repairStatus, container);
                } catch (error) {
                    showMessage(notice, error.message, true);
                    addPartButton.disabled = false;
                }
            });
            container.appendChild(partForm);
        }

        // LABOR CHARGES
        container.appendChild(createElement("h4", "Labor Charges", "billing-labor-heading"));
        const laborList = document.createElement("div");

        if (!bill.labor || bill.labor.length === 0) {
            laborList.appendChild(createElement("p", "No labor charges added."));
        } else {
            bill.labor.forEach(labor => {
                const row = createElement("div", "", "billing-charge-row");
                row.appendChild(createElement(
                    "span", `${labor.description} — ${formatMoney(labor.labor_cost)}`
                ));

                if (!isReleased) {
                    const removeButton = createElement("button", "Remove", "billing-remove-btn");
                    removeButton.type = "button";
                    removeButton.addEventListener("click", async () => {
                        if (!confirm("Remove this labor charge?")) return;
                        removeButton.disabled = true;
                        try {
                            await apiRequest(
                                `${BILLING_API}/${repairId}/labor/${labor.labor_id}`,
                                { method: "DELETE" }
                            );
                            await renderBilling(repairId, repairStatus, container);
                        } catch (error) {
                            showMessage(notice, error.message, true);
                            removeButton.disabled = false;
                        }
                    });
                    row.appendChild(removeButton);
                }
                laborList.appendChild(row);
            });
        }
        container.appendChild(laborList);

        if (!isReleased) {
            const laborForm = createElement("form", "", "billing-entry-form");
            const descriptionLabel = createElement("label", "Labor Description");
            const descriptionInput = document.createElement("input");
            descriptionInput.type = "text";
            descriptionInput.placeholder = "Example: SSD installation and testing";
            descriptionInput.required = true;
            const costLabel = createElement("label", "Labor Cost (PHP)");
            const costInput = document.createElement("input");
            costInput.type = "number";
            costInput.min = "0";
            costInput.step = "0.01";
            costInput.placeholder = "0.00";
            costInput.required = true;
            const addLaborButton = createElement("button", "Add Labor Charge", "save-edit-btn");
            addLaborButton.type = "submit";
            laborForm.append(descriptionLabel, descriptionInput, costLabel, costInput, addLaborButton);

            laborForm.addEventListener("submit", async event => {
                event.preventDefault();
                const description = descriptionInput.value.trim();
                const laborCost = Number(costInput.value);
                if (!description || !costInput.value ||
                    !Number.isFinite(laborCost) || laborCost < 0) {
                    showMessage(notice, "Enter a valid description and labor cost.", true);
                    return;
                }
                addLaborButton.disabled = true;
                try {
                    await apiRequest(`${BILLING_API}/${repairId}/labor`, {
                        method: "POST",
                        body: JSON.stringify({ description, labor_cost: laborCost })
                    });
                    await renderBilling(repairId, repairStatus, container);
                } catch (error) {
                    showMessage(notice, error.message, true);
                    addLaborButton.disabled = false;
                }
            });
            container.appendChild(laborForm);
        }

        // BILLING TOTALS
        const totals = createElement("div", "", "billing-totals");
        totals.append(
            createElement("p", `Parts Subtotal: ${formatMoney(bill.parts_total)}`),
            createElement("p", `Labor Subtotal: ${formatMoney(bill.labor_total)}`),
            createElement("h3", `Total Repair Cost: ${formatMoney(bill.total_amount)}`)
        );
        container.appendChild(totals);

    } catch (error) {
        console.error("Load billing error:", error);
        container.replaceChildren(createElement("p", `Unable to load billing: ${error.message}`));
    }
}
