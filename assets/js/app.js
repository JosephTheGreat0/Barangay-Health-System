(() => {
  'use strict';

  const TOKEN_KEY = 'barangayHealth.token';
  const USER_KEY = 'barangayHealth.user';
  const API_BASE_KEY = 'barangayHealth.apiBase';
  const DEFAULT_API_BASE = 'http://localhost:8080';
  const API_BASE = resolveApiBase();
  const PAGE = decodeURIComponent((window.location.pathname.split('/').pop() || 'login.html').toLowerCase());

  const patientCache = new Map();
  const householdCache = new Map();
  let inventoryItems = [];
  let currentReport = null;
  let auditRows = [];
  let mchState = { tab: 'prenatal', patientId: '', patientName: '' };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    if (isLoginPage()) {
      initAuthPage();
      return;
    }

    if (!getToken()) {
      window.location.href = 'login.html';
      return;
    }

    initShell();

    if (PAGE === 'dashboard.html') initDashboardPage();
    if (PAGE === 'patientreg.html') initPatientRegisterPage();
    if (PAGE === 'consulation.html') initConsultationPage();
    if (PAGE === 'appointments&queue.html') initAppointmentsPage();
    if (PAGE === 'inventory.html') initInventoryPage();
    if (PAGE === 'referrals.html') initReferralsPage();
    if (PAGE === 'maternal&child.html') initMchPage();
    if (PAGE === 'reports.html') initReportsPage();
    if (PAGE === 'auditlog.html') initAuditLogPage();
  }

  function resolveApiBase() {
    const configured = window.BHS_API_BASE || window.localStorage.getItem(API_BASE_KEY);
    if (configured) return configured.replace(/\/$/, '');
    if (window.location.protocol === 'file:') return DEFAULT_API_BASE;
    return window.location.port === '8080' ? '' : DEFAULT_API_BASE;
  }

  function isLoginPage() {
    return PAGE === 'login.html' || PAGE === '';
  }

  function getToken() {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(window.localStorage.getItem(USER_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveAuth(result) {
    window.localStorage.setItem(TOKEN_KEY, result.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(result.user || {}));
  }

  function clearAuth() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;

    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      body = JSON.stringify(body);
    }
    if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      if (response.status === 401 && !isLoginPage()) {
        clearAuth();
        window.location.href = 'login.html';
      }
      const message = data && typeof data === 'object'
        ? data.error || data.detail || response.statusText
        : data || response.statusText;
      const error = new Error(message || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }

  function debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function todayIso(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function currentMonth(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString();
  }

  function formatTime(value) {
    if (!value) return '';
    return String(value).slice(0, 5);
  }

  function ageFromBirthdate(birthdate) {
    if (!birthdate) return '';
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return '';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDelta = now.getMonth() - birth.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
    return age < 0 ? '' : String(age);
  }

  function humanize(value) {
    return String(value || '').replace(/_/g, ' ');
  }

  function chip(label, mode = '') {
    return `<span class="status-chip ${mode}">${escapeHtml(humanize(label))}</span>`;
  }

  function loadingRow(colspan, text = 'Loading records...') {
    return `<tr class="empty-table-row"><td colspan="${colspan}"><div class="empty-message"><h2>${escapeHtml(text)}</h2></div></td></tr>`;
  }

  function emptyRow(colspan, title, text, icon = '+') {
    return `<tr class="empty-table-row"><td colspan="${colspan}"><div class="empty-message"><div class="empty-icon">${escapeHtml(icon)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div></td></tr>`;
  }

  function setTableRows(tbody, rows, colspan, emptyTitle, emptyText) {
    tbody.innerHTML = rows.length ? rows.join('') : emptyRow(colspan, emptyTitle, emptyText);
  }

  function toast(message, type = 'success') {
    const existing = $('.toast');
    if (existing) existing.remove();
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 3600);
  }

  function setMessage(node, message, type = '') {
    if (!node) return;
    node.textContent = message || '';
    node.className = `form-message ${type}`.trim();
  }

  function readForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    $all('input[type="checkbox"][name]', form).forEach(input => {
      data[input.name] = input.checked;
    });
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'string') data[key] = data[key].trim();
    });
    return data;
  }

  function option(value, label, selectedValue = '') {
    const selected = String(value) === String(selectedValue) ? ' selected' : '';
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }

  function checked(value) {
    return value ? ' checked' : '';
  }

  function numOrNull(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function openModal({ title, body, submitText = 'Save', onSubmit, onOpen }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <h2>${escapeHtml(title)}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">x</button>
        </header>
        <form>
          ${body}
          <p class="form-message" role="status" aria-live="polite"></p>
          <footer>
            <button class="btn" type="button" data-close>Cancel</button>
            <button class="btn primary" type="submit">${escapeHtml(submitText)}</button>
          </footer>
        </form>
      </section>
    `;

    const close = () => backdrop.remove();
    const form = $('form', backdrop);
    const submitButton = $('button[type="submit"]', form);
    const message = $('.form-message', form);

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop || event.target.closest('[data-close]')) close();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      setMessage(message, '');
      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Saving...';
      try {
        await onSubmit(readForm(form), form, close);
        close();
      } catch (error) {
        setMessage(message, error.message || 'Unable to save record.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });

    document.body.appendChild(backdrop);
    if (onOpen) onOpen(form, close);
    const firstInput = $('input, select, textarea, button[type="submit"]', form);
    if (firstInput) firstInput.focus();
  }

  function initShell() {
    const user = getUser();
    const today = $('.today');
    if (today && user.username) {
      today.innerHTML = `<strong>${escapeHtml(user.fullName || user.username)}</strong>${escapeHtml(humanize(user.role || 'staff'))}`;
    }

    const topbar = $('.topbar');
    if (topbar && !$('.logout-button', topbar)) {
      const logout = document.createElement('button');
      logout.className = 'btn logout-button';
      logout.type = 'button';
      logout.textContent = 'Sign out';
      logout.addEventListener('click', () => {
        clearAuth();
        window.location.href = 'login.html';
      });
      topbar.appendChild(logout);
    }

    const search = $('.topbar .search');
    if (search && PAGE !== 'auditlog.html') attachGlobalPatientSearch(search);
  }

  function initAuthPage() {
    const form = $('#auth-form');
    if (!form) return;

    let mode = 'login';
    const title = $('.login-card h1');
    const intro = $('.login-card > p');
    const submit = $('.login-button', form);
    const toggle = $('[data-action="toggle-auth-mode"]', form);
    const fullNameLabel = $('.register-only', form);
    const message = $('.form-message', form);

    $all('.roles button').forEach(button => {
      button.addEventListener('click', () => {
        $all('.roles button').forEach(item => item.classList.remove('selected'));
        button.classList.add('selected');
      });
    });

    const setMode = nextMode => {
      mode = nextMode;
      const registering = mode === 'register';
      if (title) title.textContent = registering ? 'Create station account' : 'Sign in to the health register';
      if (intro) intro.textContent = registering
        ? 'Create a staff login, then continue to the dashboard.'
        : 'For BHW, midwives, doctors, and station administrators.';
      if (submit) submit.textContent = registering ? 'Create account' : 'Sign in';
      if (toggle) toggle.textContent = registering ? 'Use existing account' : 'Create account';
      if (fullNameLabel) fullNameLabel.hidden = !registering;
      const fullName = $('[name="fullName"]', form);
      if (fullName) fullName.required = registering;
      setMessage(message, '');
    };

    if (toggle) {
      toggle.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      setMessage(message, '');
      const data = readForm(form);
      const selectedRole = $('.roles .selected');
      const role = selectedRole ? selectedRole.dataset.role : 'bhw';

      submit.disabled = true;
      submit.textContent = mode === 'register' ? 'Creating...' : 'Signing in...';
      try {
        if (mode === 'register') {
          await api('/auth/register', {
            method: 'POST',
            body: {
              username: data.username,
              password: data.password,
              fullName: data.fullName,
              role,
            },
          });
        }

        const result = await api('/auth/login', {
          method: 'POST',
          body: { username: data.username, password: data.password },
        });
        saveAuth(result);
        window.location.href = 'dashboard.html';
      } catch (error) {
        setMessage(message, error.message || 'Authentication failed.', 'error');
      } finally {
        submit.disabled = false;
        submit.textContent = mode === 'register' ? 'Create account' : 'Sign in';
      }
    });

    if (getToken()) window.location.href = 'dashboard.html';
  }

  async function fetchPatients(search = '') {
    const path = search ? `/patients?search=${encodeURIComponent(search)}` : '/patients';
    const patients = await api(path);
    patients.forEach(patient => patientCache.set(patient.id, patient));
    return patients;
  }

  async function getPatient(id) {
    if (!id) return null;
    if (patientCache.has(id)) return patientCache.get(id);
    try {
      const patient = await api(`/patients/${encodeURIComponent(id)}`);
      patientCache.set(patient.id, patient);
      return patient;
    } catch {
      return null;
    }
  }

  async function hydratePatients(ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    await Promise.all(uniqueIds.map(id => getPatient(id)));
  }

  function patientName(patientOrId) {
    const patient = typeof patientOrId === 'string' ? patientCache.get(patientOrId) : patientOrId;
    if (!patient) return 'Unknown patient';
    return `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unnamed patient';
  }

  async function getHousehold(id) {
    if (!id) return null;
    if (householdCache.has(id)) return householdCache.get(id);
    try {
      const household = await api(`/households/${encodeURIComponent(id)}`);
      householdCache.set(id, household);
      return household;
    } catch {
      return null;
    }
  }

  async function hydrateHouseholds(ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    await Promise.all(uniqueIds.map(id => getHousehold(id)));
  }

  function householdLabel(id) {
    const household = householdCache.get(id);
    if (!household) return id ? id.slice(0, 8) : 'Unassigned';
    return `${household.address}, ${household.barangay}`;
  }

  function attachPatientPicker(input, onSelect) {
    if (!input || input.dataset.pickerAttached) return;
    input.dataset.pickerAttached = 'true';
    input.autocomplete = 'off';

    const wrapper = input.closest('.patient-select, .picker-field, .field') || input.parentElement;
    wrapper.classList.add('picker-field');
    const suggestions = document.createElement('div');
    suggestions.className = 'suggestions';
    suggestions.hidden = true;
    input.insertAdjacentElement('afterend', suggestions);

    const runSearch = debounce(async () => {
      const term = input.value.trim();
      try {
        const patients = await fetchPatients(term);
        suggestions.innerHTML = patients.length
          ? patients.map(patient => `<button type="button" data-patient-id="${escapeHtml(patient.id)}">${escapeHtml(patientName(patient))}<br><span class="record-meta">${escapeHtml(patient.sex)} ${escapeHtml(formatDate(patient.birthdate))}</span></button>`).join('')
          : '<button type="button" disabled>No patients found</button>';
        suggestions.hidden = false;
      } catch (error) {
        suggestions.innerHTML = `<button type="button" disabled>${escapeHtml(error.message)}</button>`;
        suggestions.hidden = false;
      }
    }, 220);

    input.addEventListener('input', () => {
      input.dataset.patientId = '';
      runSearch();
    });
    input.addEventListener('focus', runSearch);
    suggestions.addEventListener('click', event => {
      const button = event.target.closest('button[data-patient-id]');
      if (!button) return;
      const patient = patientCache.get(button.dataset.patientId);
      input.dataset.patientId = button.dataset.patientId;
      input.value = patientName(patient);
      suggestions.hidden = true;
      if (onSelect) onSelect(patient);
    });
    document.addEventListener('click', event => {
      if (!wrapper.contains(event.target)) suggestions.hidden = true;
    });
  }

  function attachGlobalPatientSearch(input) {
    attachPatientPicker(input, patient => {
      if (patient) {
        window.location.href = `patientreg.html?search=${encodeURIComponent(patient.last_name || patient.first_name || '')}`;
      }
    });
  }

  async function recordAudit(serviceName, entityType, entityId, action, payload = {}) {
    try {
      await api('/audit-events', {
        method: 'POST',
        body: { serviceName, entityType, entityId, action, payload },
      });
    } catch {
      // Audit writes should not block the clinical workflow.
    }
  }

  async function initDashboardPage() {
    const today = todayIso();
    const cards = $all('.dashboard-stats .stat-card');

    const results = await Promise.allSettled([
      api(`/visits/stats/summary?date=${today}&month=${currentMonth()}`),
      api(`/queue?date=${today}`),
      api('/stock-items'),
      api('/referrals?status=pending'),
      api('/prenatal-checkups/due?days=7'),
      api('/immunizations/due?days=7'),
    ]);

    const visitStats = settledValue(results[0], {});
    const queue = settledValue(results[1], []);
    const stock = settledValue(results[2], []);
    const referrals = settledValue(results[3], []);
    const prenatalDue = settledValue(results[4], []);
    const immunizationsDue = settledValue(results[5], []);

    updateStat(cards[0], visitStats.patientsSeenToday || 0, 'Patients with visits recorded today.');
    updateStat(cards[1], queue.filter(row => row.status !== 'done').length, 'Patients currently waiting or in consultation.');
    updateStat(cards[2], stock.filter(item => Number(item.quantity_on_hand) <= Number(item.reorder_level)).length, 'Items at or below reorder level.');
    updateStat(cards[3], referrals.length, 'Pending referrals awaiting follow-up.');

    await hydratePatients([
      ...queue.map(row => row.patient_id),
      ...prenatalDue.map(row => row.patient_id),
      ...immunizationsDue.map(row => row.patient_id),
    ]);

    const panels = $all('.dashboard-panel');
    renderRecordPanel(
      $('.empty-panel', panels[0]),
      queue,
      row => `<article class="record-card"><strong>#${escapeHtml(row.queue_number)} ${escapeHtml(patientName(row.patient_id))}</strong><span class="record-meta">${chip(row.status, row.status === 'waiting' ? 'warn' : '')}</span></article>`,
      'Queue is empty',
      'Walk-in and appointment entries will appear here.'
    );

    const dueRows = [
      ...prenatalDue.map(row => ({ type: 'Prenatal', date: row.next_visit_date, patient_id: row.patient_id })),
      ...immunizationsDue.map(row => ({ type: 'Immunization', date: row.next_due_date, patient_id: row.patient_id })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    renderRecordPanel(
      $('.empty-panel', panels[1]),
      dueRows,
      row => `<article class="record-card"><strong>${escapeHtml(patientName(row.patient_id))}</strong><span class="record-meta">${escapeHtml(row.type)} due ${escapeHtml(formatDate(row.date))}</span></article>`,
      'No due records',
      'Maternal and child health reminders will appear here.'
    );
  }

  function settledValue(result, fallback) {
    return result.status === 'fulfilled' ? result.value : fallback;
  }

  function updateStat(card, value, text) {
    if (!card) return;
    const number = $('.empty-number', card);
    const paragraph = $('p', card);
    if (number) number.textContent = value;
    if (paragraph) paragraph.textContent = text;
  }

  function renderRecordPanel(container, rows, renderRow, emptyTitle, emptyText) {
    if (!container) return;
    container.classList.remove('empty-panel');
    container.classList.add('record-list');
    container.innerHTML = rows.length
      ? rows.map(renderRow).join('')
      : `<div class="empty-message"><div class="empty-icon">+</div><h2>${escapeHtml(emptyTitle)}</h2><p>${escapeHtml(emptyText)}</p></div>`;
  }

  async function initPatientRegisterPage() {
    const tbody = $('.blank-table tbody');
    const filterInput = $('.filter-bar input[type="search"]');
    const params = new URLSearchParams(window.location.search);
    if (filterInput && params.get('search')) filterInput.value = params.get('search');

    $('[data-action="add-patient"]')?.addEventListener('click', () => openPatientModal());
    filterInput?.addEventListener('input', debounce(() => loadPatientsTable(filterInput.value.trim()), 250));
    tbody?.addEventListener('click', event => {
      const button = event.target.closest('[data-action="edit-patient"]');
      if (!button) return;
      const patient = patientCache.get(button.dataset.id);
      if (patient) openPatientModal(patient);
    });

    await loadPatientsTable(filterInput ? filterInput.value.trim() : '');
  }

  async function loadPatientsTable(search = '') {
    const tbody = $('.blank-table tbody');
    if (!tbody) return;
    tbody.innerHTML = loadingRow(5);
    try {
      const patients = await fetchPatients(search);
      await hydrateHouseholds(patients.map(patient => patient.household_id));
      const rows = patients.map(patient => `
        <tr>
          <td class="data-cell"><strong>${escapeHtml(patientName(patient))}</strong><br><span class="record-meta">${escapeHtml(patient.id.slice(0, 8))}</span></td>
          <td>${escapeHtml(ageFromBirthdate(patient.birthdate) || 'N/A')} / ${escapeHtml(humanize(patient.sex))}</td>
          <td>${escapeHtml(householdLabel(patient.household_id))}</td>
          <td>${patient.is_pwd ? chip('PWD', 'warn') : ''} ${patient.is_pregnant ? chip('Pregnant', 'warn') : chip('Active')}</td>
          <td><div class="table-actions"><button class="btn" type="button" data-action="edit-patient" data-id="${escapeHtml(patient.id)}">Edit</button></div></td>
        </tr>
      `);
      setTableRows(tbody, rows, 5, 'No patient records', 'Add a patient to start building the barangay health register.');
    } catch (error) {
      tbody.innerHTML = emptyRow(5, 'Unable to load patients', error.message);
    }
  }

  function openPatientModal(patient = null) {
    const editing = Boolean(patient);
    const body = editing ? `
      <div class="form-grid">
        <div class="field"><label>First name</label><input name="firstName" required value="${escapeHtml(patient.first_name)}"></div>
        <div class="field"><label>Last name</label><input name="lastName" required value="${escapeHtml(patient.last_name)}"></div>
        <div class="field"><label>Contact number</label><input name="contactNumber" value="${escapeHtml(patient.contact_number || '')}"></div>
        <div class="field"><label>Status</label><label><input type="checkbox" name="isPwd"${checked(patient.is_pwd)}> PWD</label><label><input type="checkbox" name="isPregnant"${checked(patient.is_pregnant)}> Pregnant</label></div>
      </div>
    ` : `
      <div class="form-grid">
        <div class="field"><label>First name</label><input name="firstName" required></div>
        <div class="field"><label>Last name</label><input name="lastName" required></div>
        <div class="field"><label>Birthdate</label><input name="birthdate" type="date" required></div>
        <div class="field"><label>Sex</label><select name="sex" required>${option('female', 'Female')}${option('male', 'Male')}</select></div>
        <div class="field"><label>Contact number</label><input name="contactNumber"></div>
        <div class="field"><label>Status</label><label><input type="checkbox" name="isPwd"> PWD</label><label><input type="checkbox" name="isPregnant"> Pregnant</label></div>
        <div class="field"><label>Household address</label><input name="address"></div>
        <div class="field"><label>Barangay</label><input name="barangay" value="Aplaya"></div>
      </div>
    `;

    openModal({
      title: editing ? 'Edit patient' : 'Add patient',
      body,
      submitText: editing ? 'Save changes' : 'Add patient',
      onSubmit: async data => {
        if (editing) {
          const updated = await api(`/patients/${encodeURIComponent(patient.id)}`, {
            method: 'PUT',
            body: {
              firstName: data.firstName,
              lastName: data.lastName,
              contactNumber: data.contactNumber || null,
              isPwd: Boolean(data.isPwd),
              isPregnant: Boolean(data.isPregnant),
            },
          });
          patientCache.set(updated.id, updated);
          await recordAudit('patient-service', 'patient', updated.id, 'update', updated);
          toast('Patient updated.');
        } else {
          let householdId = null;
          if (data.address && data.barangay) {
            const household = await api('/households', {
              method: 'POST',
              body: { address: data.address, barangay: data.barangay },
            });
            householdId = household.id;
            householdCache.set(household.id, household);
          }

          const created = await api('/patients', {
            method: 'POST',
            body: {
              householdId,
              firstName: data.firstName,
              lastName: data.lastName,
              birthdate: data.birthdate,
              sex: data.sex,
              contactNumber: data.contactNumber || null,
              isPwd: Boolean(data.isPwd),
              isPregnant: Boolean(data.isPregnant),
            },
          });
          patientCache.set(created.id, created);
          await recordAudit('patient-service', 'patient', created.id, 'create', created);
          toast('Patient added.');
        }
        const filterInput = $('.filter-bar input[type="search"]');
        await loadPatientsTable(filterInput ? filterInput.value.trim() : '');
      },
    });
  }

  function initConsultationPage() {
    const patientInput = $('#patient');
    attachPatientPicker(patientInput, patient => {
      if (patient) loadConsultationHistory(patient.id);
    });

    const buttons = $all('.page-head .actions .btn');
    buttons[0]?.addEventListener('click', () => saveConsultation(true));
    buttons[1]?.addEventListener('click', () => saveConsultation(false));
    ensureConsultationHistoryPanel();
  }

  function ensureConsultationHistoryPanel() {
    if ($('#consultation-history')) return;
    const panel = document.createElement('section');
    panel.id = 'consultation-history';
    panel.className = 'dashboard-panel';
    panel.style.marginTop = '24px';
    panel.innerHTML = '<header><h2>Patient visits</h2></header><div class="empty-panel"><div class="empty-message"><div class="empty-icon">+</div><h2>No patient selected</h2><p>Visits for the selected patient will appear here.</p></div></div>';
    $('.page')?.appendChild(panel);
  }

  async function saveConsultation(isDraft) {
    const form = $('.consultation-form');
    const patientInput = $('#patient');
    const patientId = patientInput?.dataset.patientId;
    if (!patientId) {
      toast('Select a patient first.', 'error');
      return;
    }

    const completeButton = isDraft ? $all('.page-head .actions .btn')[0] : $all('.page-head .actions .btn')[1];
    const originalText = completeButton?.textContent;
    if (completeButton) {
      completeButton.disabled = true;
      completeButton.textContent = isDraft ? 'Saving...' : 'Completing...';
    }

    try {
      const diagnosis = $('#diagnosis')?.value.trim() || '';
      const visit = await api('/visits', {
        method: 'POST',
        body: { patientId, notes: isDraft ? `Draft consultation: ${diagnosis}` : diagnosis || 'Consultation visit' },
      });

      const vitals = {
        heightCm: numOrNull($('#height')?.value),
        weightKg: numOrNull($('#weight')?.value),
        bloodPressure: $('#bp')?.value.trim() || null,
        temperatureC: numOrNull($('#temperature')?.value),
        pulseRate: numOrNull($('#pulse')?.value),
      };
      if (Object.values(vitals).some(value => value !== null && value !== '')) {
        await api(`/visits/${encodeURIComponent(visit.id)}/vitals`, { method: 'POST', body: vitals });
      }

      if (!isDraft && diagnosis) {
        await api(`/visits/${encodeURIComponent(visit.id)}/diagnoses`, {
          method: 'POST',
          body: { diagnosisText: diagnosis },
        });
      }

      const medicineName = $('#medicine')?.value.trim() || '';
      const quantity = numOrNull($('#quantity')?.value);
      if (!isDraft && medicineName) {
        if (!quantity) throw new Error('Quantity is required when a medicine is entered.');
        await api(`/visits/${encodeURIComponent(visit.id)}/prescriptions`, {
          method: 'POST',
          body: {
            medicineName,
            dosage: $('#dosage')?.value.trim() || null,
            quantity,
            instructions: $('#prescriptions')?.value.trim() || null,
          },
        });
      }

      await recordAudit('consultation-service', 'visit', visit.id, 'create', { patientId, isDraft });
      toast(isDraft ? 'Consultation draft saved.' : 'Visit completed.');
      form?.reset();
      if (patientInput) patientInput.dataset.patientId = '';
      ensureConsultationHistoryPanel();
    } catch (error) {
      toast(error.message || 'Unable to save consultation.', 'error');
    } finally {
      if (completeButton) {
        completeButton.disabled = false;
        completeButton.textContent = originalText;
      }
    }
  }

  async function loadConsultationHistory(patientId) {
    ensureConsultationHistoryPanel();
    const container = $('#consultation-history .empty-panel, #consultation-history .record-list');
    try {
      const visits = await api(`/visits?patient_id=${encodeURIComponent(patientId)}`);
      renderRecordPanel(
        container,
        visits,
        visit => `<article class="record-card"><strong>${escapeHtml(formatDate(visit.visit_date))}</strong><span class="record-meta">${escapeHtml(visit.notes || 'No notes recorded')}</span></article>`,
        'No visits yet',
        'Completed consultations for this patient will appear here.'
      );
    } catch (error) {
      renderRecordPanel(container, [], () => '', 'Unable to load visits', error.message);
    }
  }

  async function initAppointmentsPage() {
    $('[data-action="book-appointment"]')?.addEventListener('click', openAppointmentModal);
    $('[data-action="check-in-walkin"]')?.addEventListener('click', openWalkInModal);
    $('.appointment-board')?.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      try {
        if (button.dataset.action === 'check-in-appointment') {
          await api('/queue/check-in', {
            method: 'POST',
            body: { patientId: button.dataset.patientId, appointmentId: button.dataset.id },
          });
          await recordAudit('appointment-service', 'queue_entry', button.dataset.id, 'create', { appointmentId: button.dataset.id });
          toast('Patient checked in.');
          await loadAppointmentBoard();
        }
        if (button.dataset.action === 'queue-status') {
          await api(`/queue/${encodeURIComponent(button.dataset.id)}/status`, {
            method: 'PATCH',
            body: { status: button.dataset.status },
          });
          await recordAudit('appointment-service', 'queue_entry', button.dataset.id, 'update', { status: button.dataset.status });
          toast('Queue status updated.');
          await loadAppointmentBoard();
        }
        if (button.dataset.action === 'appointment-status') {
          await api(`/appointments/${encodeURIComponent(button.dataset.id)}/status`, {
            method: 'PATCH',
            body: { status: button.dataset.status },
          });
          await recordAudit('appointment-service', 'appointment', button.dataset.id, 'update', { status: button.dataset.status });
          toast('Appointment updated.');
          await loadAppointmentBoard();
        }
      } catch (error) {
        toast(error.message || 'Unable to update appointment.', 'error');
      }
    });
    await loadAppointmentBoard();
  }

  async function loadAppointmentBoard() {
    const panels = $all('.appointment-panel');
    if (panels.length < 2) return;
    panels[0].innerHTML = '<div class="empty-panel"><div class="empty-message"><h2>Loading queue...</h2></div></div>';
    panels[1].innerHTML = '<div class="empty-panel"><div class="empty-message"><h2>Loading appointments...</h2></div></div>';
    try {
      const [queue, appointments] = await Promise.all([
        api(`/queue?date=${todayIso()}`),
        api(`/appointments?date=${todayIso()}`),
      ]);
      await hydratePatients([...queue.map(row => row.patient_id), ...appointments.map(row => row.patient_id)]);

      renderAppointmentPanel(
        panels[0],
        queue,
        row => {
          const nextStatus = row.status === 'waiting' ? 'in_consultation' : row.status === 'in_consultation' ? 'done' : '';
          return `<article class="record-card">
            <strong>#${escapeHtml(row.queue_number)} ${escapeHtml(patientName(row.patient_id))}</strong>
            <span class="record-meta">${chip(row.status, row.status === 'waiting' ? 'warn' : row.status === 'done' ? 'muted' : '')}</span>
            ${nextStatus ? `<div class="table-actions"><button class="btn" type="button" data-action="queue-status" data-id="${escapeHtml(row.id)}" data-status="${escapeHtml(nextStatus)}">${escapeHtml(humanize(nextStatus))}</button></div>` : ''}
          </article>`;
        },
        'Queue is empty',
        'Walk-in patient entries will appear here.'
      );

      renderAppointmentPanel(
        panels[1],
        appointments,
        row => `<article class="record-card">
          <strong>${escapeHtml(formatTime(row.scheduled_time) || 'Any time')} - ${escapeHtml(patientName(row.patient_id))}</strong>
          <span class="record-meta">${escapeHtml(row.purpose || 'Appointment')} ${chip(row.priority_level, row.priority_level === 'normal' ? '' : 'warn')} ${chip(row.status, row.status === 'cancelled' || row.status === 'no_show' ? 'danger' : '')}</span>
          <div class="table-actions">
            ${row.status === 'scheduled' ? `<button class="btn" type="button" data-action="check-in-appointment" data-id="${escapeHtml(row.id)}" data-patient-id="${escapeHtml(row.patient_id)}">Check in</button>` : ''}
            ${row.status !== 'completed' ? `<button class="btn" type="button" data-action="appointment-status" data-id="${escapeHtml(row.id)}" data-status="completed">Complete</button>` : ''}
            ${row.status === 'scheduled' ? `<button class="btn" type="button" data-action="appointment-status" data-id="${escapeHtml(row.id)}" data-status="cancelled">Cancel</button>` : ''}
          </div>
        </article>`,
        'No appointments scheduled',
        'Booked appointments for the day will appear here.'
      );
    } catch (error) {
      panels[0].innerHTML = `<div class="empty-panel"><div class="empty-message"><h2>Unable to load queue</h2><p>${escapeHtml(error.message)}</p></div></div>`;
      panels[1].innerHTML = `<div class="empty-panel"><div class="empty-message"><h2>Unable to load appointments</h2><p>${escapeHtml(error.message)}</p></div></div>`;
    }
  }

  function renderAppointmentPanel(panel, rows, renderRow, title, text) {
    panel.innerHTML = rows.length
      ? `<div class="record-list">${rows.map(renderRow).join('')}</div>`
      : `<div class="empty-panel"><div class="empty-message"><div class="empty-icon">+</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div></div>`;
  }

  function openAppointmentModal() {
    openModal({
      title: 'Book appointment',
      body: `
        <div class="form-grid">
          <div class="field picker-field full"><label>Patient</label><input name="patient" data-patient-picker required placeholder="Search patient"></div>
          <div class="field"><label>Date</label><input name="scheduledDate" type="date" required value="${todayIso()}"></div>
          <div class="field"><label>Time</label><input name="scheduledTime" type="time"></div>
          <div class="field full"><label>Purpose</label><textarea name="purpose"></textarea></div>
          <div class="field"><label>Priority</label><select name="priorityLevel">${option('normal', 'Normal')}${option('senior', 'Senior')}${option('pwd', 'PWD')}${option('pregnant', 'Pregnant')}</select></div>
        </div>
      `,
      submitText: 'Book appointment',
      onOpen: form => attachPatientPicker($('[data-patient-picker]', form)),
      onSubmit: async (data, form) => {
        const patientId = $('[data-patient-picker]', form).dataset.patientId;
        if (!patientId) throw new Error('Select a patient from the list.');
        const created = await api('/appointments', {
          method: 'POST',
          body: {
            patientId,
            scheduledDate: data.scheduledDate,
            scheduledTime: data.scheduledTime || null,
            purpose: data.purpose || null,
            priorityLevel: data.priorityLevel || 'normal',
          },
        });
        await recordAudit('appointment-service', 'appointment', created.id, 'create', created);
        toast('Appointment booked.');
        await loadAppointmentBoard();
      },
    });
  }

  function openWalkInModal() {
    openModal({
      title: 'Check in walk-in',
      body: '<div class="form-grid"><div class="field picker-field full"><label>Patient</label><input name="patient" data-patient-picker required placeholder="Search patient"></div></div>',
      submitText: 'Check in',
      onOpen: form => attachPatientPicker($('[data-patient-picker]', form)),
      onSubmit: async (data, form) => {
        const patientId = $('[data-patient-picker]', form).dataset.patientId;
        if (!patientId) throw new Error('Select a patient from the list.');
        const created = await api('/queue/check-in', { method: 'POST', body: { patientId } });
        await recordAudit('appointment-service', 'queue_entry', created.id, 'create', created);
        toast('Walk-in checked in.');
        await loadAppointmentBoard();
      },
    });
  }

  async function initInventoryPage() {
    $('[data-action="add-stock-item"]')?.addEventListener('click', openStockItemModal);
    $('[data-action="restock"]')?.addEventListener('click', () => openStockTransactionModal('restock'));
    $('[data-action="dispense"]')?.addEventListener('click', () => openStockTransactionModal('dispense'));
    $('.blank-table tbody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (button?.dataset.action === 'row-restock') openStockTransactionModal('restock', button.dataset.id);
      if (button?.dataset.action === 'row-dispense') openStockTransactionModal('dispense', button.dataset.id);
    });
    await loadInventoryTable();
  }

  async function loadInventoryTable() {
    const tbody = $('.blank-table tbody');
    if (!tbody) return;
    tbody.innerHTML = loadingRow(5);
    try {
      inventoryItems = await api('/stock-items');
      const rows = inventoryItems.map(item => {
        const quantity = Number(item.quantity_on_hand);
        const reorder = Number(item.reorder_level);
        const expired = item.expiry_date && String(item.expiry_date).slice(0, 10) < todayIso();
        const low = quantity <= reorder;
        const status = expired ? chip('Expired', 'danger') : low ? chip('Low stock', 'warn') : chip('In stock');
        return `<tr>
          <td class="data-cell"><strong>${escapeHtml(item.item_name)}</strong><br><span class="record-meta">${escapeHtml(item.unit)}</span></td>
          <td>${escapeHtml(quantity)}</td>
          <td>${escapeHtml(reorder)}</td>
          <td>${escapeHtml(formatDate(item.expiry_date))}</td>
          <td>${status}<div class="table-actions"><button class="btn" type="button" data-action="row-restock" data-id="${escapeHtml(item.id)}">Restock</button><button class="btn" type="button" data-action="row-dispense" data-id="${escapeHtml(item.id)}">Dispense</button></div></td>
        </tr>`;
      });
      setTableRows(tbody, rows, 5, 'No inventory items', 'Add medicine or supplies to start tracking available stock.');
    } catch (error) {
      tbody.innerHTML = emptyRow(5, 'Unable to load inventory', error.message);
    }
  }

  function openStockItemModal() {
    openModal({
      title: 'Add inventory item',
      body: `
        <div class="form-grid">
          <div class="field"><label>Item name</label><input name="itemName" required></div>
          <div class="field"><label>Unit</label><input name="unit" required placeholder="tablet, vial, box"></div>
          <div class="field"><label>Quantity on hand</label><input name="quantityOnHand" type="number" min="0" value="0"></div>
          <div class="field"><label>Reorder level</label><input name="reorderLevel" type="number" min="0" value="10"></div>
          <div class="field"><label>Expiry date</label><input name="expiryDate" type="date"></div>
        </div>
      `,
      submitText: 'Add item',
      onSubmit: async data => {
        const created = await api('/stock-items', {
          method: 'POST',
          body: {
            itemName: data.itemName,
            unit: data.unit,
            quantityOnHand: numOrNull(data.quantityOnHand) || 0,
            expiryDate: data.expiryDate || null,
            reorderLevel: numOrNull(data.reorderLevel) || 10,
          },
        });
        await recordAudit('inventory-service', 'stock_item', created.id, 'create', created);
        toast('Inventory item added.');
        await loadInventoryTable();
      },
    });
  }

  function openStockTransactionModal(type, selectedItemId = '') {
    const isDispense = type === 'dispense';
    openModal({
      title: isDispense ? 'Dispense item' : 'Restock item',
      body: `
        <div class="form-grid">
          <div class="field"><label>Item</label><select name="itemId" required>${inventoryItems.map(item => option(item.id, item.item_name, selectedItemId)).join('')}</select></div>
          <div class="field"><label>Quantity</label><input name="quantity" type="number" min="1" required></div>
          ${isDispense ? '<div class="field picker-field full"><label>Patient</label><input name="patient" data-patient-picker placeholder="Optional patient"></div>' : ''}
        </div>
      `,
      submitText: isDispense ? 'Dispense' : 'Restock',
      onOpen: form => {
        const picker = $('[data-patient-picker]', form);
        if (picker) attachPatientPicker(picker);
      },
      onSubmit: async (data, form) => {
        if (!data.itemId) throw new Error('Add an inventory item first.');
        const path = isDispense ? '/stock-transactions/dispense' : '/stock-transactions/restock';
        const picker = $('[data-patient-picker]', form);
        const created = await api(path, {
          method: 'POST',
          body: {
            itemId: data.itemId,
            quantity: numOrNull(data.quantity),
            patientId: picker?.dataset.patientId || null,
          },
        });
        await recordAudit('inventory-service', 'stock_transaction', created.id, 'create', created);
        toast(isDispense ? 'Item dispensed.' : 'Item restocked.');
        await loadInventoryTable();
      },
    });
  }

  async function initReferralsPage() {
    $('[data-action="new-referral"]')?.addEventListener('click', openReferralModal);
    $('.blank-table tbody')?.addEventListener('change', async event => {
      const select = event.target.closest('[data-action="referral-status"]');
      if (!select) return;
      try {
        const updated = await api(`/referrals/${encodeURIComponent(select.dataset.id)}/status`, {
          method: 'PATCH',
          body: { status: select.value },
        });
        await recordAudit('referral-service', 'referral', updated.id, 'update', { status: updated.status });
        toast('Referral status updated.');
        await loadReferralsTable();
      } catch (error) {
        toast(error.message || 'Unable to update referral.', 'error');
      }
    });
    await loadReferralsTable();
  }

  async function loadReferralsTable() {
    const tbody = $('.blank-table tbody');
    if (!tbody) return;
    tbody.innerHTML = loadingRow(4);
    try {
      const referrals = await api('/referrals');
      await hydratePatients(referrals.map(referral => referral.patient_id));
      const rows = referrals.map(referral => `
        <tr>
          <td class="data-cell"><strong>${escapeHtml(patientName(referral.patient_id))}</strong><br><span class="record-meta">${escapeHtml(formatDate(referral.created_at))}</span></td>
          <td>${escapeHtml(referral.reason)}</td>
          <td>${escapeHtml(referral.destination_facility)}</td>
          <td><select class="btn" data-action="referral-status" data-id="${escapeHtml(referral.id)}">
            ${['pending', 'sent', 'acknowledged', 'completed'].map(status => option(status, humanize(status), referral.status)).join('')}
          </select></td>
        </tr>
      `);
      setTableRows(tbody, rows, 4, 'No referrals', 'New patient referrals will appear here when they are created.');
    } catch (error) {
      tbody.innerHTML = emptyRow(4, 'Unable to load referrals', error.message);
    }
  }

  function openReferralModal() {
    openModal({
      title: 'New referral',
      body: `
        <div class="form-grid">
          <div class="field picker-field full"><label>Patient</label><input name="patient" data-patient-picker required placeholder="Search patient"></div>
          <div class="field full"><label>Reason</label><textarea name="reason" required></textarea></div>
          <div class="field"><label>Destination facility</label><input name="destinationFacility" required></div>
          <div class="field"><label>Referring provider</label><input name="referringProvider"></div>
          <div class="field full"><label>Visit ID</label><input name="visitId" placeholder="Optional"></div>
        </div>
      `,
      submitText: 'Create referral',
      onOpen: form => attachPatientPicker($('[data-patient-picker]', form)),
      onSubmit: async (data, form) => {
        const patientId = $('[data-patient-picker]', form).dataset.patientId;
        if (!patientId) throw new Error('Select a patient from the list.');
        const created = await api('/referrals', {
          method: 'POST',
          body: {
            patientId,
            visitId: data.visitId || null,
            reason: data.reason,
            destinationFacility: data.destinationFacility,
            referringProvider: data.referringProvider || null,
          },
        });
        await recordAudit('referral-service', 'referral', created.id, 'create', created);
        toast('Referral created.');
        await loadReferralsTable();
      },
    });
  }

  function initMchPage() {
    const toolbar = document.createElement('section');
    toolbar.className = 'toolbar-panel';
    toolbar.innerHTML = '<div class="field picker-field"><label for="mch-patient">Patient</label><input id="mch-patient" placeholder="Search and select a patient"></div>';
    $('.page-head')?.insertAdjacentElement('afterend', toolbar);
    attachPatientPicker($('#mch-patient'), patient => {
      mchState.patientId = patient?.id || '';
      mchState.patientName = patient ? patientName(patient) : '';
      loadMchRecords();
    });

    $all('.tabs [role="tab"]').forEach(tab => {
      tab.addEventListener('click', () => {
        $all('.tabs [role="tab"]').forEach(item => {
          item.classList.remove('active');
          item.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        mchState.tab = tab.textContent.toLowerCase().includes('immun') ? 'immunizations' : tab.textContent.toLowerCase().includes('growth') ? 'growth' : 'prenatal';
        loadMchRecords();
      });
    });

    $('[data-action="new-prenatal"]')?.addEventListener('click', () => openMchModal('prenatal'));
    $('[data-action="new-immunization"]')?.addEventListener('click', () => openMchModal('immunizations'));
    $('[data-action="new-growth"]')?.addEventListener('click', () => openMchModal('growth'));
    loadMchRecords();
  }

  async function loadMchRecords() {
    const table = $('.blank-table');
    const tbody = $('tbody', table);
    const thead = $('thead', table);
    if (!tbody || !thead) return;

    const config = mchConfig(mchState.tab);
    thead.innerHTML = config.header;

    if (!mchState.patientId) {
      tbody.innerHTML = emptyRow(config.colspan, 'Select a patient', 'Maternal and child records load after selecting a patient.');
      renderMchDuePanel([]);
      return;
    }

    tbody.innerHTML = loadingRow(config.colspan);
    try {
      const rows = await api(`${config.path}?patient_id=${encodeURIComponent(mchState.patientId)}`);
      const html = rows.map(row => config.render(row));
      setTableRows(tbody, html, config.colspan, config.emptyTitle, config.emptyText);
      const immunizations = mchState.tab === 'immunizations'
        ? rows
        : await api(`/immunizations?patient_id=${encodeURIComponent(mchState.patientId)}`);
      renderMchDuePanel(immunizations);
    } catch (error) {
      tbody.innerHTML = emptyRow(config.colspan, 'Unable to load records', error.message);
    }
  }

  function mchConfig(tab) {
    if (tab === 'immunizations') {
      return {
        path: '/immunizations',
        colspan: 5,
        emptyTitle: 'No immunization records',
        emptyText: 'Immunizations for the selected patient will appear here.',
        header: '<tr><th>Patient</th><th>Vaccine</th><th>Dose</th><th>Date given</th><th>Next due</th></tr>',
        render: row => `<tr><td class="data-cell">${escapeHtml(mchState.patientName)}</td><td>${escapeHtml(row.vaccine_name)}</td><td>${escapeHtml(row.dose_number)}</td><td>${escapeHtml(formatDate(row.date_given))}</td><td>${escapeHtml(formatDate(row.next_due_date))}</td></tr>`,
      };
    }
    if (tab === 'growth') {
      return {
        path: '/growth-records',
        colspan: 5,
        emptyTitle: 'No growth records',
        emptyText: 'Growth monitoring records for the selected patient will appear here.',
        header: '<tr><th>Patient</th><th>Age months</th><th>Height</th><th>Weight</th><th>Record date</th></tr>',
        render: row => `<tr><td class="data-cell">${escapeHtml(mchState.patientName)}</td><td>${escapeHtml(row.age_months || 'N/A')}</td><td>${escapeHtml(row.height_cm || 'N/A')}</td><td>${escapeHtml(row.weight_kg || 'N/A')}</td><td>${escapeHtml(formatDate(row.record_date))}</td></tr>`,
      };
    }
    return {
      path: '/prenatal-checkups',
      colspan: 5,
      emptyTitle: 'No prenatal records',
      emptyText: 'Maternal health records will appear here once added.',
      header: '<tr><th>Patient</th><th>Gestational age</th><th>Last findings</th><th>Next visit</th><th>Status</th></tr>',
      render: row => `<tr><td class="data-cell">${escapeHtml(mchState.patientName)}</td><td>${escapeHtml(row.gestational_age_weeks || 'N/A')} weeks</td><td>${escapeHtml(row.findings || 'No findings')}</td><td>${escapeHtml(formatDate(row.next_visit_date))}</td><td>${chip(row.next_visit_date ? 'Scheduled' : 'No follow-up', row.next_visit_date ? '' : 'muted')}</td></tr>`,
    };
  }

  function renderMchDuePanel(immunizations) {
    const container = $('.dashboard-panel .empty-panel, .dashboard-panel .record-list');
    if (!container) return;
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const due = immunizations.filter(row => {
      if (!row.next_due_date) return false;
      const date = new Date(row.next_due_date);
      return date >= new Date(todayIso()) && date <= end;
    });
    renderRecordPanel(
      container,
      due,
      row => `<article class="record-card"><strong>${escapeHtml(row.vaccine_name)}</strong><span class="record-meta">Dose ${escapeHtml(row.dose_number)} due ${escapeHtml(formatDate(row.next_due_date))}</span></article>`,
      'No immunizations due',
      'Upcoming child immunization reminders will appear here.'
    );
  }

  function openMchModal(type) {
    const config = {
      prenatal: {
        title: 'Add prenatal checkup',
        path: '/prenatal-checkups',
        entity: 'prenatal_checkup',
        body: '<div class="field"><label>Gestational age weeks</label><input name="gestationalAgeWeeks" type="number" min="0"></div><div class="field full"><label>Findings</label><textarea name="findings"></textarea></div><div class="field"><label>Next visit</label><input name="nextVisitDate" type="date"></div>',
        payload: data => ({ gestationalAgeWeeks: numOrNull(data.gestationalAgeWeeks), findings: data.findings || null, nextVisitDate: data.nextVisitDate || null }),
      },
      immunizations: {
        title: 'Add immunization',
        path: '/immunizations',
        entity: 'immunization',
        body: `<div class="field"><label>Vaccine</label><input name="vaccineName" required></div><div class="field"><label>Dose number</label><input name="doseNumber" type="number" min="1" value="1"></div><div class="field"><label>Date given</label><input name="dateGiven" type="date" value="${todayIso()}"></div><div class="field"><label>Next due</label><input name="nextDueDate" type="date"></div>`,
        payload: data => ({ vaccineName: data.vaccineName, doseNumber: numOrNull(data.doseNumber) || 1, dateGiven: data.dateGiven || todayIso(), nextDueDate: data.nextDueDate || null }),
      },
      growth: {
        title: 'Add growth record',
        path: '/growth-records',
        entity: 'growth_record',
        body: '<div class="field"><label>Age months</label><input name="ageMonths" type="number" min="0"></div><div class="field"><label>Height cm</label><input name="heightCm" inputmode="decimal"></div><div class="field"><label>Weight kg</label><input name="weightKg" inputmode="decimal"></div>',
        payload: data => ({ ageMonths: numOrNull(data.ageMonths), heightCm: numOrNull(data.heightCm), weightKg: numOrNull(data.weightKg) }),
      },
    }[type];

    openModal({
      title: config.title,
      body: `
        <div class="form-grid">
          <div class="field picker-field full"><label>Patient</label><input name="patient" data-patient-picker required value="${escapeHtml(mchState.patientName)}"></div>
          ${config.body}
        </div>
      `,
      submitText: 'Save record',
      onOpen: form => {
        const input = $('[data-patient-picker]', form);
        if (mchState.patientId) input.dataset.patientId = mchState.patientId;
        attachPatientPicker(input);
      },
      onSubmit: async (data, form) => {
        const picker = $('[data-patient-picker]', form);
        const patientId = picker.dataset.patientId;
        if (!patientId) throw new Error('Select a patient from the list.');
        const created = await api(config.path, {
          method: 'POST',
          body: { patientId, ...config.payload(data) },
        });
        mchState.patientId = patientId;
        mchState.patientName = picker.value;
        $('#mch-patient').value = picker.value;
        $('#mch-patient').dataset.patientId = patientId;
        await recordAudit('mch-service', config.entity, created.id, 'create', created);
        toast('MCH record saved.');
        await loadMchRecords();
      },
    });
  }

  function initReportsPage() {
    const select = $('select[aria-label="Reporting period"]');
    if (!select) return;
    select.innerHTML = buildMonthOptions();
    select.value = currentMonth();
    select.addEventListener('change', () => loadReport());
    $('[data-action="generate-report"]')?.addEventListener('click', generateReport);
    $('[data-action="export-report"]')?.addEventListener('click', exportReportCsv);
    loadReport();
  }

  function buildMonthOptions() {
    const options = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = 0; i < 12; i += 1) {
      const value = currentMonth(cursor);
      const label = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      options.push(option(value, label));
      cursor.setMonth(cursor.getMonth() - 1);
    }
    return options.join('');
  }

  async function loadReport() {
    const month = $('select[aria-label="Reporting period"]')?.value || currentMonth();
    try {
      currentReport = await api(`/reports/monthly?month=${encodeURIComponent(month)}`);
      renderReport(currentReport);
    } catch (error) {
      currentReport = null;
      renderMissingReport(error.status === 404 ? 'No report generated for this month yet.' : error.message);
    }
  }

  async function generateReport() {
    const button = $('[data-action="generate-report"]');
    const month = $('select[aria-label="Reporting period"]')?.value || currentMonth();
    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Generating...';
    }
    try {
      currentReport = await api('/reports/generate', { method: 'POST', body: { month } });
      renderReport(currentReport);
      await recordAudit('reporting-service', 'monthly_summary', currentReport.id, 'create', currentReport);
      toast('Report generated.');
    } catch (error) {
      toast(error.message || 'Unable to generate report.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function renderReport(report) {
    const cards = $all('.dashboard-stats .stat-card');
    updateStat(cards[0], report.total_visits || 0, 'Visits recorded during this month.');
    updateStat(cards[1], report.total_referrals || 0, 'Referrals issued during this month.');
    updateStat(cards[2], report.total_dispensed_items || 0, 'Medicine and supply units dispensed.');

    const values = [
      { label: 'Visits', value: Number(report.total_visits) || 0 },
      { label: 'Referrals', value: Number(report.total_referrals) || 0 },
      { label: 'Dispensed', value: Number(report.total_dispensed_items) || 0 },
    ];
    const max = Math.max(...values.map(item => item.value), 1);
    const panel = $('.dashboard-panel .empty-panel, .dashboard-panel .record-list');
    if (panel) {
      panel.classList.remove('empty-panel', 'record-list');
      panel.classList.add('chart-bars');
      panel.innerHTML = values.map(item => `
        <div class="chart-bar">
          <span style="height:${Math.max(16, Math.round((item.value / max) * 180))}px"></span>
          <strong>${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.label)}</small>
        </div>
      `).join('');
    }
  }

  function renderMissingReport(message) {
    const cards = $all('.dashboard-stats .stat-card');
    cards.forEach(card => updateStat(card, '-', message));
    const panel = $('.dashboard-panel .empty-panel, .dashboard-panel .record-list, .dashboard-panel .chart-bars');
    if (panel) {
      panel.className = 'empty-panel';
      panel.innerHTML = `<div class="empty-message"><div class="empty-icon">+</div><h2>No report data</h2><p>${escapeHtml(message)}</p></div>`;
    }
  }

  function exportReportCsv() {
    if (!currentReport) {
      toast('Generate or select a report first.', 'error');
      return;
    }
    const rows = [
      ['report_month', 'total_visits', 'total_referrals', 'total_dispensed_items', 'generated_at'],
      [
        String(currentReport.report_month).slice(0, 10),
        currentReport.total_visits || 0,
        currentReport.total_referrals || 0,
        currentReport.total_dispensed_items || 0,
        currentReport.generated_at || '',
      ],
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barangay-health-report-${String(currentReport.report_month).slice(0, 7)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function initAuditLogPage() {
    const tbody = $('.blank-table tbody');
    const search = $('.topbar .search');
    if (search) search.placeholder = 'Search audit activity...';
    search?.addEventListener('input', debounce(() => renderAuditRows(search.value.trim()), 160));
    if (tbody) tbody.innerHTML = loadingRow(5);
    try {
      auditRows = await api('/audit-events');
      renderAuditRows(search ? search.value.trim() : '');
    } catch (error) {
      if (tbody) tbody.innerHTML = emptyRow(5, 'Unable to load audit log', error.message);
    }
  }

  function renderAuditRows(search = '') {
    const tbody = $('.blank-table tbody');
    if (!tbody) return;
    const term = search.toLowerCase();
    const filtered = term
      ? auditRows.filter(row => JSON.stringify(row).toLowerCase().includes(term))
      : auditRows;
    const rows = filtered.map(row => `
      <tr>
        <td class="data-cell">${escapeHtml(formatDate(row.created_at))}</td>
        <td>${escapeHtml(row.service_name)}</td>
        <td>${chip(row.action, row.action === 'delete' ? 'danger' : row.action === 'update' ? 'warn' : '')}</td>
        <td>${escapeHtml(row.entity_type)}<br><span class="record-meta">${escapeHtml(row.entity_id || 'N/A')}</span></td>
        <td>${escapeHtml(row.performed_by || 'System')}</td>
      </tr>
    `);
    setTableRows(tbody, rows, 5, 'No audit activity', 'System activity will appear here when actions are recorded.');
  }
})();
