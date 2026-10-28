/* FixTrack inner-page motion: scroll reveal, staggered rows/cards, nav stagger, page transitions. No API calls. */
(() => {
  const bar = document.createElement("div"); bar.className = "ft-progress"; document.body.append(bar);
  requestAnimationFrame(() => { bar.style.width = "100%"; setTimeout(() => { bar.style.opacity = "0"; }, 650); });

  const PANELS = ".customer-panel,.payments-panel,.reports-panel,.reports-stat-card,.payments-stat,.tw-panel,.tw-stat,.device-form-card,.device-list-card,.customer-profile-panel,.history-panel,.repairs-workspace,.payment-section,.dashboard-welcome";
  const ITEMS = "tbody tr,.registered-device,.admin-repair-card,.history-item,.payment-history-item";
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("ft-in"); io.unobserve(e.target); } }), { threshold: .08 }) : null;

  const reveal = (el, i) => { if (el.classList.contains("ft-reveal")) return; el.style.setProperty("--ri", i % 8); el.classList.add("ft-reveal"); io ? io.observe(el) : el.classList.add("ft-in"); };
  const rows = (root) => { let i = 0; root.querySelectorAll(ITEMS).forEach((el) => { if (el.classList.contains("ft-row")) return; el.style.setProperty("--ri", Math.min(i++, 14)); el.classList.add("ft-row"); }); };
  const nav = () => document.querySelectorAll(".ft-nav a,.ft-side-nav a").forEach((a, i) => a.style.setProperty("--ni", i));

  const scan = (root) => { root.querySelectorAll(PANELS).forEach(reveal); rows(root); nav(); };
  scan(document);

  // content loaded later by each page's own script gets animated too
  let t; new MutationObserver((ms) => {
    clearTimeout(t);
    t = setTimeout(() => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches(ITEMS)) rows(n.parentElement || document); scan(n); } })), 30);
  }).observe(document.body, { childList: true, subtree: true });

  // "Loading..." placeholders pulse
  document.querySelectorAll("p,div,span,td").forEach((el) => { if (!el.children.length && /^loading[\s\S]{0,30}\.\.\.$/i.test(el.textContent.trim())) el.classList.add("ft-loading"); });

  // smooth leave when following internal links
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]"); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || a.target === "_blank") return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin || !/\.html$/.test(u.pathname) || u.href === location.href) return;
    e.preventDefault(); document.body.classList.add("ft-leaving"); bar.style.opacity = "1"; bar.style.width = "30%";
    setTimeout(() => { location.href = a.href; }, 200);
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("ft-leaving"); });
})();
