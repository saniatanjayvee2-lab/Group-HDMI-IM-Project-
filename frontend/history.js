(() => {
const API = "https://fixtrack-backend.vercel.app/api/repairs";
const list = document.getElementById("history-list");
const message = document.getElementById("history-message");
const count = document.getElementById("history-count");
const refresh = document.getElementById("history-refresh");
const token = localStorage.getItem("fixtrack_token");
let user;
try { user = JSON.parse(localStorage.getItem("fixtrack_user") || "null"); } catch { user = null; }
if (!token || !user || user.role !== "customer") { location.replace("index.html"); return; }
const date = value => { if (!value) return "Not recorded"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Not recorded" : d.toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"}); };
const field = (container,label,value) => { if (!value) return; const p=document.createElement("p"); const b=document.createElement("strong"); b.textContent=label+": "; p.append(b,document.createTextNode(String(value)));container.append(p); };
async function load() {
 refresh.disabled=true; message.textContent=""; count.textContent="Loading repair history..."; list.replaceChildren();
 try {
 const response=await fetch(API,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if (!response.ok) throw new Error(data.message || "Could not load repair history.");
 const repairs=(Array.isArray(data)?data:Array.isArray(data.repairs)?data.repairs:[])
 .filter(r=>["completed","released"].includes(String(r.status||"").trim().toLowerCase()));
 count.textContent=repairs.length+" completed or released repair"+(repairs.length===1?"":"s");
 if(!repairs.length){const empty=document.createElement("p");empty.className="history-empty";empty.textContent="No completed repairs yet. Repairs will appear here when their status is Completed or Released.";list.append(empty);return;}
 for(const repair of repairs){
 const card=document.createElement("article"); card.className="history-record";
 const top=document.createElement("div");top.className="history-record-header";
 const heading=document.createElement("h4"); heading.textContent=[repair.brand,repair.model].filter(Boolean).join(" ") || repair.device_type || "Device repair";
 const badge=document.createElement("span");badge.className="history-status";badge.textContent=repair.status;
 top.append(heading,badge);card.append(top);
 field(card,"Repair ID","#"+repair.repair_id);field(card,"Submitted",date(repair.date_submitted));field(card,"Completed",date(repair.date_completed));field(card,"Reported issue",repair.problem_description);
 field(card,"Technician",[repair.technician_first_name,repair.technician_last_name].filter(Boolean).join(" "));
 field(card,"Diagnosis",repair.diagnosis_details);field(card,"Recommended action",repair.recommended_action);list.append(card);
 }
 }catch(err){message.textContent=err.message;count.textContent="Unable to load records";}
 finally{refresh.disabled=false;}
}
refresh.addEventListener("click",load);load();
})();