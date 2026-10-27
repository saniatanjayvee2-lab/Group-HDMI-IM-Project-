/* FixTrack admin navigation enhancement: no API calls or business-logic modifications. */
(() => {
const links=[["admin-dashboard.html","▦","Overview"],["admin-repairs.html","⚒","Repair Requests"],["admin-customers.html","♙","Customers"],["technicians.html","♧","Technicians"],["admin-parts.html","▣","Parts & Inventory"],["admin-payments.html","▤","Payments"],["admin-reports.html","◫","Reports"]];
const current=location.pathname.split("/").pop();
document.body.classList.add("ft-admin-workspace");
const side=document.createElement("aside");
side.className="ft-module-side";side.setAttribute("aria-label","Administrator navigation");
const title=document.createElement("a");title.href="admin-dashboard.html";title.className="ft-side-brand";title.innerHTML='Fix<span>Track</span>';side.append(title);
const box=document.createElement("div");const label=document.createElement("div");label.className="ft-side-label";label.textContent="Workspace";box.append(label);
const nav=document.createElement("nav");nav.className="ft-side-nav";
for(const [href,mark,name] of links){const a=document.createElement("a");a.href=href;if(href===current)a.setAttribute("aria-current","page");const icon=document.createElement("span");icon.className="ft-nav-mark";icon.textContent=mark;a.append(icon,document.createTextNode(name));nav.append(a);}
box.append(nav);side.append(box);const foot=document.createElement("div");foot.className="ft-side-foot";foot.textContent="FixTrack • Repair shop workspace";side.append(foot);document.body.prepend(side);
})();
