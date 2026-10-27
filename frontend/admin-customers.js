(() => {
    'use strict';
    const API = 'https://fixtrack-backend.vercel.app/api/customers';
    const token = localStorage.getItem('fixtrack_token');
    let user;
    try { user = JSON.parse(localStorage.getItem('fixtrack_user')); } catch { /* Redirect below. */ }
    if (!token || !user) { window.location.replace('index.html'); return; }
    if (user.role !== 'admin') { window.location.replace(user.role === 'technician' ? 'technician-dashboard.html' : 'dashboard.html'); return; }
    const el = id => document.getElementById(id);
    const dialog = el('customer-dialog');
    const form = el('customer-edit-form');
    let selected, saving = false, listRequest = 0, detailRequest = 0, returnFocus;
    const fullName = c => [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');
    const date = value => value ? new Date(value).toLocaleDateString() : 'Not provided';
    function node(tag, text, className) {
        const item = document.createElement(tag);
        if (text !== undefined) item.textContent = text;
        if (className) item.className = className;
        return item;
    }
    function message(target, text, error = false) {
        target.textContent = text;
        target.classList.toggle('customer-error', error);
    }
    async function request(path = '', options = {}) {
        const response = await fetch(API + path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
        let data;
        try { data = await response.json(); } catch { throw new Error('Unexpected server response. Please try again.'); }
        if (!response.ok) throw new Error(data.message || 'Unable to complete the request.');
        return data;
    }
    async function load(success = '') {
        const version = ++listRequest;
        el('customer-rows').replaceChildren();
        el('customer-rows').setAttribute('aria-busy', 'true');
        message(el('customer-message'), 'Loading customers…');
        try {
            const customers = await request(`?search=${encodeURIComponent(el('customer-search').value.trim())}`);
            if (version !== listRequest) return;
            for (const customer of customers) {
                const row = node('tr');
                [customer.user_id, fullName(customer), customer.email, customer.phones.map(p => p.phone_number).join(', ') || 'Not provided', date(customer.created_at)].forEach(value => row.append(node('td', value)));
                const actions = node('td');
                for (const [label, mode] of [['View Details', 'view'], ['Edit', 'edit']]) {
                    const button = node('button', label);
                    button.type = 'button';
                    button.setAttribute('aria-label', `${label}: ${fullName(customer)}`);
                    button.addEventListener('click', () => openCustomer(customer.user_id, mode, button));
                    actions.append(button);
                }
                row.append(actions); el('customer-rows').append(row);
            }
            message(el('customer-message'), `${success ? success + ' ' : ''}${customers.length ? `${customers.length} customer(s).` : 'No customers found.'}`);
        } catch (error) { if (version === listRequest) message(el('customer-message'), error.message, true); }
        finally { if (version === listRequest) el('customer-rows').removeAttribute('aria-busy'); }
    }
    function fieldset(container, row, definitions, idKey) {
        const group = node('fieldset', undefined, 'customer-contact-group');
        group.append(node('legend', idKey === 'phone_id' ? 'Contact Number' : 'Address'));
        if (row[idKey]) group.dataset.recordId = row[idKey];
        for (const [name, label, max, required] of definitions) {
            const wrapper = node('label', label), input = node('input');
            input.name = name; input.maxLength = max; input.required = Boolean(required); input.value = row[name] || '';
            if (name === 'phone_number') input.type = 'tel';
            wrapper.append(input); group.append(wrapper);
        }
        container.append(group);
    }
    const phoneDefinitions = [['phone_number', 'Contact Number', 30, true], ['type', 'Type (optional)', 50]];
    const addressDefinitions = [['street_address', 'Street Address', 255], ['city', 'City', 100], ['province', 'Province', 100], ['postal_code', 'Postal Code', 20]];
    function addPhone(row = {}) { fieldset(el('customer-phone-fields'), row, phoneDefinitions, 'phone_id'); }
    function addAddress(row = {}) { fieldset(el('customer-address-fields'), row, addressDefinitions, 'address_id'); }
    function details(customer) {
        const target = el('customer-details'); target.replaceChildren();
        const info = node('dl', undefined, 'customer-info');
        for (const [label, value] of [['Customer ID', customer.user_id], ['Full Name', fullName(customer)], ['Email', customer.email], ['Contact Numbers', customer.phones.map(p => `${p.phone_number}${p.type ? ` (${p.type})` : ''}`).join(', ') || 'Not provided'], ['Registered Date', date(customer.created_at)], ['Addresses', customer.addresses.map(a => [a.street_address, a.city, a.province, a.postal_code].filter(Boolean).join(', ')).join('; ') || 'Not provided']]) {
            info.append(node('dt', label), node('dd', value));
        }
        target.append(info);
        for (const [title, records, format] of [
            ['Registered Devices', customer.devices, d => `#${d.device_id} · ${[d.device_type, d.brand, d.model].filter(Boolean).join(' ')} · Serial: ${d.serial_number || 'Not provided'}${d.accessories_included ? ` · Accessories: ${d.accessories_included}` : ''}`],
            ['Repair Requests', customer.repairs, r => `#${r.repair_id} · Device #${r.device_id} ${[r.brand, r.model].filter(Boolean).join(' ')} · ${r.status} · ${r.problem_description} · Submitted: ${date(r.date_submitted)} · Completed: ${date(r.date_completed)}`]
        ]) {
            target.append(node('h3', `${title} (${records.length})`));
            if (!records.length) target.append(node('p', `No ${title.toLowerCase()} found.`));
            else { const list = node('ul'); records.forEach(record => list.append(node('li', format(record)))); target.append(list); }
        }
    }
    async function openCustomer(id, mode, trigger) {
        const version = ++detailRequest;
        selected = null; returnFocus = trigger;
        form.hidden = true; el('customer-details').replaceChildren();
        el('customer-dialog-title').textContent = mode === 'edit' ? 'Edit Customer' : 'Customer Details';
        message(el('customer-dialog-message'), 'Loading customer…');
        dialog.showModal();
        try {
            const customer = await request(`/${id}`);
            if (version !== detailRequest || !dialog.open) return;
            selected = customer;
            message(el('customer-dialog-message'), '');
            if (mode === 'view') { details(customer); return; }
            form.reset();
            ['first_name', 'middle_name', 'last_name', 'email'].forEach(key => { form.elements.namedItem(key).value = customer[key] || ''; });
            el('customer-phone-fields').replaceChildren(); el('customer-address-fields').replaceChildren();
            customer.phones.forEach(addPhone); customer.addresses.forEach(addAddress);
            form.hidden = false; form.elements.namedItem('first_name').focus();
        } catch (error) { if (version === detailRequest) message(el('customer-dialog-message'), error.message, true); }
    }
    function close() { if (!saving) dialog.close(); }
    el('customer-close').addEventListener('click', close);
    el('customer-cancel').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    dialog.addEventListener('close', () => {
        // A close event can arrive after another customer dialog was opened.
        if (dialog.open) return;
        ++detailRequest; selected = null;
        if (returnFocus?.isConnected) returnFocus.focus(); else el('customer-search').focus();
    });
    el('customer-add-phone').addEventListener('click', () => addPhone());
    el('customer-add-address').addEventListener('click', () => addAddress());
    el('customer-search-form').addEventListener('submit', event => { event.preventDefault(); load(); });
    el('customer-refresh').addEventListener('click', () => load());
    let searchTimer;
    el('customer-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => load(), 300); });
    function collect(container, key) {
        return Array.from(container.querySelectorAll('fieldset')).map(group => {
            const row = {};
            if (group.dataset.recordId) row[key] = Number(group.dataset.recordId);
            group.querySelectorAll('input').forEach(input => { row[input.name] = input.value.trim(); });
            return row;
        });
    }
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || !selected || !form.reportValidity()) return;
        const body = {};
        ['first_name', 'middle_name', 'last_name', 'email'].forEach(key => { body[key] = form.elements.namedItem(key).value.trim(); });
        body.phones = collect(el('customer-phone-fields'), 'phone_id');
        body.addresses = collect(el('customer-address-fields'), 'address_id');
        saving = true;
        const controls = [...form.querySelectorAll('input, button'), el('customer-close')];
        controls.forEach(control => { control.disabled = true; });
        message(el('customer-dialog-message'), 'Saving changes…');
        try {
            const result = await request(`/${selected.user_id}`, { method: 'PUT', body: JSON.stringify(body) });
            saving = false; dialog.close(); await load(result.message);
        } catch (error) { message(el('customer-dialog-message'), error.message, true); }
        finally { saving = false; controls.forEach(control => { control.disabled = false; }); }
    });
    load();
})();
