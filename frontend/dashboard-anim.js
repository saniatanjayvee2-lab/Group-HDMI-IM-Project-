/* Shared dashboard motion: greeting, role chip, live clock, stagger, count-up, ripple. No API calls. */
(() => {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("fixtrack_user") || "null"); } catch (e) {}
  document.querySelectorAll(".dashboard-card").forEach((c, i) => c.style.setProperty("--i", i));

  const welcome = document.querySelector(".dashboard-welcome");
  if (welcome && user) {
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px";
    const chip = document.createElement("span");
    chip.className = "ft-role-chip"; chip.dataset.role = user.role;
    chip.innerHTML = "<i></i>";
    chip.append(document.createTextNode(user.role + " session"));
    const clock = document.createElement("span");
    clock.className = "ft-clock";
    const tick = () => { clock.textContent = greet + " • " + new Date().toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
    tick(); setInterval(tick, 1000);
    row.append(chip, clock);
    welcome.prepend(row);
  }

  // count-up for numeric stat values that appear (static or loaded later)
  const animate = (el) => {
    const raw = el.textContent.trim();
    if (!/^\d{1,7}$/.test(raw) || el.dataset.counted) return;
    el.dataset.counted = "1";
    const end = +raw, t0 = performance.now(), dur = 900;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    el.textContent = "0"; requestAnimationFrame(step);
  };
  const scan = (root) => root.querySelectorAll && root.querySelectorAll("[id*='count' i],[id*='total' i],.stat-value,.summary-value,.metric-value").forEach(animate);
  scan(document);
  new MutationObserver((ms) => ms.forEach((m) => {
    if (m.target.nodeType === 1) scan(m.target); else if (m.target.parentElement) animate(m.target.parentElement);
  })).observe(document.body, { childList: true, subtree: true, characterData: true });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const d = document.createElement("span"); d.className = "ft-ripple";
    d.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.append(d); setTimeout(() => d.remove(), 650);
  });
})();
