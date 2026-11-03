(() => {
"use strict";
const API = "https://fixtrack-backend.vercel.app/api/auth/admins";
const token = localStorage.getItem("fixtrack_token");
let user = null;
try { user = JSON.parse(localStorage.getItem("fixtrack_user") || "null"); } catch {}
if (!token || user?.role !== "admin") {
    window.location.replace("index.html");
    return;
}
const form = document.getElementById("create-admin-form");
const message = document.getElementById("create-admin-message");
const list = document.getElementById("admin-list");
const total = document.getElementById("admin-total");
const button = document.getElementById("create-admin-button");
const spinner = document.getElementById("create-admin-spinner");
function field(id){return document.getElementById(id).value;}
const guidance = "Password must contain 8 or more characters with uppercase and lowercase letters, a number, and a special character.";
function validPassword(value){
    return value.length >= 8 && new TextEncoder().encode(value).length <= 72 &&
        /[A-Z]/.test(value) && /[a-z]/.test(value) &&
        /[0-9]/.test(value) && /[^A-Za-z0-9\s]/.test(value);
}
function setMessage(text, error){
    message.textContent = text;
    message.className = error ? "ft-admin-message mt-3 text-danger" : "ft-admin-message mt-3 text-success";
}
async function request(url, options={}){
    const response = await fetch(url,{
        ...options,
        cache:"no-store",
        headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json",...(options.headers||{})}
    });
    const data = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message || "Unable to complete the request.");
    return data;
}
function renderAdmins(admins){
    list.replaceChildren();
    total.textContent = admins.length + (admins.length === 1 ? " account" : " accounts");
    if(!admins.length){list.textContent="No administrators found.";return;}
    for(const admin of admins){
        const row = document.createElement("article");
        row.className = "ft-admin-user";
        const avatar = document.createElement("div");
        avatar.className = "ft-admin-avatar";
        avatar.textContent = (admin.first_name||"A").charAt(0).toUpperCase();
        const main = document.createElement("div");
        main.className = "ft-admin-user-details";
        const name = document.createElement("strong");
        name.textContent = [admin.first_name,admin.middle_name,admin.last_name].filter(Boolean).join(" ");
        const email = document.createElement("span");
        email.textContent = admin.email;
        const details = document.createElement("small");
        const date = admin.created_at ? new Date(admin.created_at).toLocaleDateString("en-PH") : "Not available";
        details.textContent = "Account created: " + date;
        main.append(name,email,details);
        const badge = document.createElement("span");
        badge.className = "badge ft-admin-role";
        badge.textContent = Number(admin.user_id) === Number(user.user_id) ? "Your Account" : "Administrator";
        row.append(avatar,main,badge);
        list.append(row);
    }
}
async function load(){
    try {
        const result = await request(API);
        renderAdmins(Array.isArray(result.admins) ? result.admins : []);
    } catch(error) {
        list.textContent = error.message;
        total.textContent = "Unavailable";
    }
}
form.addEventListener("submit",async event=>{
    event.preventDefault();
    setMessage("",false);
    const password = field("new-admin-password");
    if(!validPassword(password)){setMessage(guidance,true);return;}
    if(password!==field("new-admin-confirm")){setMessage("New passwords do not match.",true);return;}
    const current = field("current-admin-password");
    if(password===current){setMessage("Use a different password for the new administrator.",true);return;}
    const data = {
        first_name:field("new-admin-first").trim(),
        middle_name:field("new-admin-middle").trim(),
        last_name:field("new-admin-last").trim(),
        email:field("new-admin-email").trim().toLowerCase(),
        password,
        current_password:current
    };
    button.disabled=true;
    spinner.classList.remove("d-none");
    try{
        const result = await request(API,{method:"POST",body:JSON.stringify(data)});
        form.reset();
        setMessage(result.message || "Administrator created successfully.",false);
        await load();
    }catch(error){setMessage(error.message,true);}
    finally{button.disabled=false;spinner.classList.add("d-none");}
});
load();
})();
