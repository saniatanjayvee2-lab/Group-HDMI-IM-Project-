/* FixTrack password visibility and confirmation dialogs. */
(() => {
    "use strict";
    if (window.FixTrackConfirm) return;

    const EYE = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A12.2 12.2 0 0 1 12 5c6.4 0 10 7 10 7a16.7 16.7 0 0 1-3.1 3.7M6.2 6.8C3.4 8.7 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>';

    function setVisibility(field, button, visible) {
        field.type = visible ? "text" : "password";
        button.innerHTML = visible ? EYE_OFF : EYE;
        button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
        button.setAttribute("title", visible ? "Hide password" : "Show password");
        button.setAttribute("aria-pressed", String(visible));
    }

    function enhancePasswords(root = document) {
        const fields = root.querySelectorAll("input[type='password']");
        fields.forEach(field => {
            if (field.dataset.ftEyeReady === "true") return;
            field.dataset.ftEyeReady = "true";
            let wrapper;
            if (field.parentElement?.classList.contains("pw-wrap")) {
                wrapper = field.parentElement;
                // Keep the existing login handler untouched, but replace
                // its text toggle visually with the universal eye button.
                const original = wrapper.querySelector(".pw-toggle");
                if (original) {
                    original.hidden = true;
                    original.style.display = "none";
                }
            } else {
                wrapper = document.createElement("span");
                field.parentNode.insertBefore(wrapper, field);
                wrapper.appendChild(field);
            }
            wrapper.classList.add("ft-password-wrap");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ft-eye-button";
            setVisibility(field, button, false);
            button.addEventListener("click", () =>
                setVisibility(field, button, field.type === "password")
            );
            wrapper.appendChild(button);
            field.form?.addEventListener("reset", () => {
                setTimeout(() => setVisibility(field, button, false), 0);
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => enhancePasswords(), { once: true });
    } else enhancePasswords();

    const observer = new MutationObserver(items => {
        // Check newly inserted elements (including dynamically built
        // technician reset forms); never observe attributes.
        for (const item of items) {
            for (const node of item.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches("input[type='password']") || node.querySelector("input[type='password']")) {
                    enhancePasswords();
                    return;
                }
            }
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    let dialogActive = false;
    function ask(options = {}) {
        if (dialogActive) return Promise.resolve(null);
        dialogActive = true;
        const previous = document.activeElement;
        return new Promise(resolve => {
            let finished = false;
            const overlay = document.createElement("div");
            overlay.className = "ft-confirm-backdrop";
            const panel = document.createElement("section");
            panel.className = "ft-confirm-dialog card border-0 shadow-lg";
            panel.setAttribute("role", "alertdialog");
            panel.setAttribute("aria-modal", "true");
            const head = document.createElement("div");
            head.className = "ft-confirm-header";
            const symbol = document.createElement("span");
            symbol.className = "ft-confirm-symbol";
            symbol.textContent = options.dangerous ? "!" : "?";
            const heading = document.createElement("div");
            const title = document.createElement("h3");
            title.textContent = options.title || "Confirm action";
            title.id = "ft-confirm-title";
            const message = document.createElement("p");
            message.className = "ft-confirm-message";
            message.textContent = options.message || "Are you sure you want to continue?";
            heading.append(title, message);
            head.append(symbol, heading);
            panel.setAttribute("aria-labelledby", "ft-confirm-title");
            let password = null;
            if (options.password) {
                const field = document.createElement("div");
                field.className = "ft-confirm-password-group";
                const label = document.createElement("label");
                label.htmlFor = "ft-confirm-password";
                label.textContent = options.passwordLabel || "Confirm your password";
                password = document.createElement("input");
                password.type = "password";
                password.id = "ft-confirm-password";
                password.autocomplete = "current-password";
                password.className = "form-control";
                password.required = true;
                field.append(label, password);
                panel.append(head, field);
            } else panel.append(head);
            const warning = document.createElement("p");
            warning.className = "ft-confirm-warning";
            warning.setAttribute("role","status");
            panel.append(warning);
            const actions = document.createElement("div");
            actions.className = "ft-confirm-actions";
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "btn btn-outline-secondary";
            cancel.textContent = "Cancel";
            const submit = document.createElement("button");
            submit.type = "button";
            submit.className = options.dangerous ? "btn btn-danger" : "btn btn-primary";
            submit.textContent = options.confirmText || "Confirm";
            actions.append(cancel, submit);
            panel.append(actions);
            overlay.append(panel);
            document.body.appendChild(overlay);
            enhancePasswords(overlay);
            function finish(value) {
                if (finished) return;
                finished = true;
                dialogActive = false;
                document.removeEventListener("keydown", onKey, true);
                overlay.remove();
                if (previous?.isConnected && typeof previous.focus === "function") previous.focus();
                resolve(value);
            }
            function onKey(event) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    finish(null);
                }
                if (event.key === "Tab") {
                    const focusable = [...panel.querySelectorAll("button:not([disabled]),input:not([disabled])")];
                    if (!focusable.length) return;
                    const first = focusable[0], last = focusable[focusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault(); last.focus();
                    } else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault(); first.focus();
                    }
                }
            }
            document.addEventListener("keydown", onKey, true);
            cancel.addEventListener("click", () => finish(null));
            overlay.addEventListener("click", e => {
                if (e.target === overlay) finish(null);
            });
            submit.addEventListener("click", () => {
                if (password && !password.value) {
                    warning.textContent = "Enter your password to continue.";
                    password.focus();
                    return;
                }
                finish({ confirmed: true, password: password?.value || "" });
            });
            if (password) password.focus(); else cancel.focus();
        });
    }
    window.FixTrackConfirm = { ask };
})();
