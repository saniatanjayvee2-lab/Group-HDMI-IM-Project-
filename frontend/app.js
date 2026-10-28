
const API_URL = "https://fixtrack-backend.vercel.app/api/auth";

// =========================
// PAGE ELEMENTS
// =========================

const loginBox =
    document.getElementById("login-box");

const registerBox =
    document.getElementById("register-box");

const adminSetupBox =
    document.getElementById("admin-setup-box");

const initialSetupSection =
    document.getElementById("initial-setup-section");

const showRegisterButton =
    document.getElementById("show-register");

const showLoginButton =
    document.getElementById("show-login");

const showAdminSetupButton =
    document.getElementById("show-admin-setup");

const cancelAdminSetupButton =
    document.getElementById("cancel-admin-setup");

const loginForm =
    document.getElementById("login-form");

const registerForm =
    document.getElementById("register-form");

const adminSetupForm =
    document.getElementById("admin-setup-form");

const loginMessage =
    document.getElementById("login-message");

const registerMessage =
    document.getElementById("register-message");

const adminSetupMessage =
    document.getElementById("admin-setup-message");

// =========================
// CHECK INITIAL SETUP
// =========================

async function checkSetupStatus() {
    try {
        const response = await fetch(
            `${API_URL}/setup-status`
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "Unable to check FixTrack setup status."
            );
            return;
        }

        // Show Set Up Shop only if no admin exists
        if (data.adminExists === false) {
            initialSetupSection.classList.remove(
                "hidden"
            );
        } else {
            initialSetupSection.classList.add(
                "hidden"
            );
        }

    } catch (error) {
        console.error(
            "Setup status error:",
            error
        );
    }
}

// =========================
// SWITCH TO REGISTER
// =========================

showRegisterButton.addEventListener(
    "click",
    () => {
        loginBox.classList.add("hidden");
        adminSetupBox.classList.add("hidden");
        registerBox.classList.remove("hidden");

        loginMessage.textContent = "";
        adminSetupMessage.textContent = "";
    }
);

// =========================
// SWITCH REGISTER TO LOGIN
// =========================

showLoginButton.addEventListener(
    "click",
    () => {
        registerBox.classList.add("hidden");
        adminSetupBox.classList.add("hidden");
        loginBox.classList.remove("hidden");

        registerMessage.textContent = "";
        adminSetupMessage.textContent = "";
    }
);

// =========================
// SWITCH TO ADMIN SETUP
// =========================

showAdminSetupButton.addEventListener(
    "click",
    () => {
        loginBox.classList.add("hidden");
        registerBox.classList.add("hidden");
        adminSetupBox.classList.remove("hidden");

        loginMessage.textContent = "";
        registerMessage.textContent = "";
        adminSetupMessage.textContent = "";
    }
);

// =========================
// CANCEL ADMIN SETUP
// =========================

cancelAdminSetupButton.addEventListener(
    "click",
    () => {
        adminSetupBox.classList.add("hidden");
        registerBox.classList.add("hidden");
        loginBox.classList.remove("hidden");

        adminSetupMessage.textContent = "";
    }
);

// =========================
// REGISTER CUSTOMER
// =========================

registerForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        registerMessage.textContent =
            "Creating account...";

        const customerData = {
            first_name:
                document
                    .getElementById("first-name")
                    .value
                    .trim(),

            middle_name:
                document
                    .getElementById("middle-name")
                    .value
                    .trim(),

            last_name:
                document
                    .getElementById("last-name")
                    .value
                    .trim(),

            email:
                document
                    .getElementById("register-email")
                    .value
                    .trim(),

            password:
                document
                    .getElementById("register-password")
                    .value
        };

        try {
            const response = await fetch(
                `${API_URL}/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(customerData)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                registerMessage.textContent =
                    data.message;
                return;
            }

            registerMessage.textContent =
                data.message;

            registerForm.reset();

            setTimeout(() => {
                registerBox.classList.add(
                    "hidden"
                );

                loginBox.classList.remove(
                    "hidden"
                );

                loginMessage.textContent =
                    "Account created. You can now log in.";

                registerMessage.textContent = "";
            }, 1000);

        } catch (error) {
            console.error(
                "Registration error:",
                error
            );

            registerMessage.textContent =
                "Unable to connect to the FixTrack server.";
        }
    }
);

// =========================
// FIRST ADMIN SETUP
// =========================

adminSetupForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        adminSetupMessage.textContent =
            "Creating administrator account...";

        const adminData = {
            first_name:
                document
                    .getElementById(
                        "admin-first-name"
                    )
                    .value
                    .trim(),

            middle_name:
                document
                    .getElementById(
                        "admin-middle-name"
                    )
                    .value
                    .trim(),

            last_name:
                document
                    .getElementById(
                        "admin-last-name"
                    )
                    .value
                    .trim(),

            email:
                document
                    .getElementById(
                        "admin-email"
                    )
                    .value
                    .trim(),

            password:
                document
                    .getElementById(
                        "admin-password"
                    )
                    .value
        };

        try {
            const response = await fetch(
                `${API_URL}/setup-admin`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(adminData)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                adminSetupMessage.textContent =
                    data.message;

                // Recheck in case an admin
                // already exists
                await checkSetupStatus();
                return;
            }

            adminSetupMessage.textContent =
                "Administrator created successfully!";

            adminSetupForm.reset();

            // Hide Set Up Shop permanently
            initialSetupSection.classList.add(
                "hidden"
            );

            setTimeout(() => {
                adminSetupBox.classList.add(
                    "hidden"
                );

                loginBox.classList.remove(
                    "hidden"
                );

                loginMessage.textContent =
                    "Administrator account created. You can now log in.";

                adminSetupMessage.textContent = "";
            }, 1200);

        } catch (error) {
            console.error(
                "Admin setup error:",
                error
            );

            adminSetupMessage.textContent =
                "Unable to connect to the FixTrack server.";
        }
    }
);

// =========================
// LOGIN
// =========================

loginForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        loginMessage.textContent =
            "Logging in...";

        const loginData = {
            email:
                document
                    .getElementById("login-email")
                    .value
                    .trim(),

            password:
                document
                    .getElementById("login-password")
                    .value
        };

        try {
            const response = await fetch(
                `${API_URL}/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(loginData)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                loginMessage.textContent =
                    data.message;
                return;
            }

            // Save JWT token
            localStorage.setItem(
                "fixtrack_token",
                data.token
            );

            // Save logged-in user
            localStorage.setItem(
                "fixtrack_user",
                JSON.stringify(data.user)
            );

            // =========================
            // ROLE-BASED REDIRECT
            // =========================

            finishLogin(data);

        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            loginMessage.textContent =
                "Unable to connect to the FixTrack server.";
        }
    }
);

// =========================
// START FIXTRACK
// =========================

checkSetupStatus();


// =========================
// ANIMATED LOGIN (role tabs, loading, success transition)
// =========================

const ROLE_INFO = {
    customer:   { page: "dashboard.html",             label: "Customer Portal",       hint: "Track your devices and repair requests." },
    technician: { page: "technician-dashboard.html",  label: "Technician Workspace",  hint: "View assigned repairs and update their status." },
    admin:      { page: "admin-dashboard.html",       label: "Administrator Console", hint: "Manage the shop, team, inventory and payments." }
};
let selectedRole = "customer";

function selectRole(role) {
    selectedRole = role;
    const tabs = [...document.querySelectorAll(".role-tabs [data-role]")];
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.role === role)));
    const pill = document.getElementById("role-pill");
    if (pill) pill.style.transform = `translateX(${tabs.findIndex((t) => t.dataset.role === role) * 100}%)`;
    const hint = document.getElementById("role-hint");
    if (hint) hint.textContent = ROLE_INFO[role].hint;
}
document.querySelectorAll(".role-tabs [data-role]").forEach((t) =>
    t.addEventListener("click", () => selectRole(t.dataset.role)));
selectRole("customer");

const pwToggle = document.getElementById("pw-toggle");
if (pwToggle) pwToggle.addEventListener("click", () => {
    const f = document.getElementById("login-password");
    const show = f.type === "password";
    f.type = show ? "text" : "password";
    pwToggle.textContent = show ? "Hide" : "Show";
});

const loginSubmit = loginForm.querySelector('button[type="submit"]');
loginForm.addEventListener("submit", () => {
    loginSubmit.classList.add("loading");
    loginMessage.textContent = "";
}, true);

// Any error text written by the login handler stops the spinner and shakes the card
new MutationObserver(() => {
    if (loginMessage.textContent) {
        loginSubmit.classList.remove("loading");
        loginBox.classList.remove("shake");
        void loginBox.offsetWidth;
        loginBox.classList.add("shake");
    }
}).observe(loginMessage, { childList: true, characterData: true, subtree: true });

function finishLogin(data) {
    const role = data.user && data.user.role;
    const info = ROLE_INFO[role];

    if (!info) {
        localStorage.removeItem("fixtrack_token");
        localStorage.removeItem("fixtrack_user");
        loginMessage.textContent = "Your account has an invalid role.";
        return;
    }

    // Signed in on the wrong tab: don't silently open another portal
    if (role !== selectedRole) {
        localStorage.removeItem("fixtrack_token");
        localStorage.removeItem("fixtrack_user");
        loginMessage.textContent =
            `This is a ${role} account. Choose the ${role.charAt(0).toUpperCase() + role.slice(1)} tab to sign in.`;
        return;
    }

    const overlay = document.createElement("div");
    overlay.className = "login-success";
    overlay.innerHTML = '<div><div class="ring">&#10003;</div><h2></h2><p></p><div class="bar"><b></b></div></div>';
    overlay.querySelector("h2").textContent = `Welcome back, ${data.user.first_name || "there"}!`;
    overlay.querySelector("p").textContent = `Opening ${info.label}...`;
    document.body.append(overlay);
    setTimeout(() => { window.location.href = info.page; }, 1800);
}
