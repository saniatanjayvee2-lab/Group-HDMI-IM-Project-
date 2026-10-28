// Get saved login information
const token = localStorage.getItem("fixtrack_token");
const userData = localStorage.getItem("fixtrack_user");


// Check if user is logged in
if (!token || !userData) {

    // No login information, return to login page
    window.location.href = "index.html";

} else {
    let user = null;
    try { user = JSON.parse(userData); } catch (e) {}
    if (!user || user.role !== "customer") {
        window.location.replace("index.html");
        throw new Error("Not a customer session");
    }

    // Display customer's name
    document.getElementById("welcomeUser").textContent =
        `Welcome, ${user.first_name}!`;
}


// LOGOUT
document.getElementById("logoutBtn").addEventListener("click", () => {

    // Remove login information
    localStorage.removeItem("fixtrack_token");
    localStorage.removeItem("fixtrack_user");

    // Return to login page
    window.location.href = "index.html";
});