(() => {
    "use strict";
    function setup() {
        if (window.lucide?.createIcons) window.lucide.createIcons();
        const date = document.getElementById("ftCurrentDate");
        if (date) date.textContent = new Date().toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"});

        const toggle = document.querySelector(".ft-mobile-toggle");
        const sidebar = document.querySelector(".ft-sidebar");
        if (!toggle || !sidebar) return;

        const overlay = document.createElement("button");
        overlay.type = "button";
        overlay.className = "ft-nav-backdrop";
        overlay.setAttribute("aria-label", "Close navigation");
        overlay.hidden = true;
        document.body.appendChild(overlay);

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "ft-nav-close";
        closeButton.setAttribute("aria-label", "Close navigation");
        closeButton.textContent = "×";
        sidebar.insertBefore(closeButton, sidebar.firstChild);
        sidebar.id ||= "fixtrack-admin-sidebar";
        toggle.setAttribute("aria-controls", sidebar.id);

        let previousFocus = null;
        function setOpen(open) {
            document.body.classList.toggle("ft-nav-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
            overlay.hidden = !open;
            if (open) {
                previousFocus = document.activeElement;
                closeButton.focus();
            } else if (previousFocus?.isConnected && sidebar.contains(document.activeElement)) {
                toggle.focus();
            }
        }
        setOpen(false);

        toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("ft-nav-open")));
        closeButton.addEventListener("click", () => setOpen(false));
        overlay.addEventListener("click", () => setOpen(false));
        sidebar.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setOpen(false)));
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && document.body.classList.contains("ft-nav-open")) {
                event.preventDefault();
                setOpen(false);
            }
        });
        window.addEventListener("resize", () => {
            if (window.innerWidth > 820 && document.body.classList.contains("ft-nav-open")) setOpen(false);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, {once:true});
    else setup();
})();