
const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");

let currentUser = null;

// =====================================
// CHECK LOGIN INFORMATION
// =====================================

try {
    currentUser = userData
        ? JSON.parse(userData)
        : null;
} catch (error) {
    console.error("Invalid user data:", error);
}

// =====================================
// CHECK ADMIN ACCESS
// =====================================

if (!token || !currentUser) {
    window.location.replace("index.html");

} else if (currentUser.role !== "admin") {

    if (currentUser.role === "technician") {
        window.location.replace("technician-dashboard.html");
    } else {
        window.location.replace("dashboard.html");
    }

} else {
    initializeAdminDashboard();
}

// =====================================
// INITIALIZE ADMIN DASHBOARD
// =====================================

function initializeAdminDashboard() {

    const welcomeUser =
        document.getElementById("welcomeUser");

    const logoutBtn =
        document.getElementById("logoutBtn");

    const customersBtn =
        document.getElementById("manageCustomersBtn");

    const paymentsBtn =
        document.getElementById("managePaymentsBtn");

    const reportsBtn =
        document.getElementById("viewReportsBtn");

    // =====================================
    // DISPLAY ADMIN NAME
    // =====================================

    if (welcomeUser) {
        welcomeUser.textContent =
            `Welcome, ${currentUser.first_name}!`;
    }

    // =====================================
    // LOGOUT
    // =====================================

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }

    // =====================================
    // CUSTOMER MANAGEMENT
    // =====================================

    if (customersBtn) {
        customersBtn.addEventListener("click", () => {
            alert(
                "Customer Management will be implemented next."
            );
        });
    }

    // =====================================
    // PAYMENT MANAGEMENT
    // =====================================

    if (paymentsBtn) {
        paymentsBtn.addEventListener("click", () => {
            window.location.href = "admin-payments.html";
        });
    }

    // =====================================
    // REPORTS
    // =====================================

    if (reportsBtn) {
        reportsBtn.addEventListener("click", () => {
            alert(
                "Reports will be available after the reporting feature is built."
            );
        });
    }
}

// =====================================
// LOGOUT
// =====================================

function logout() {

    localStorage.removeItem("fixtrack_token");
    localStorage.removeItem("fixtrack_user");

    window.location.replace("index.html");
}
