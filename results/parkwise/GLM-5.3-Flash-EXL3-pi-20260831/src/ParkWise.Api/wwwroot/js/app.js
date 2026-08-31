/**
 * ParkWise attendant console. Pure presentation + display formatting: all business
 * rules (fees, grace, capacity) live in the API — the UI only renders what it gets.
 */
import { api, clearToken, fieldError, getToken, setToken } from './api.js';

const $ = (sel) => document.querySelector(sel);
const money = (value) => `€${Number(value ?? 0).toFixed(2)}`;
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayOf = (iso) => new Date(iso).toLocaleDateString();

const state = {
  user: null,
  tickets: null, // null = loading
  ticketsError: null,
  occupancy: null,
  occupancyError: null,
  busy: {}, // per-ticket/action in-flight flags (double-submit safety)
};

/* ---------- toasts ---------- */

function toast(message, kind = 'success') {
  const region = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.setAttribute('data-testid', 'toast');
  const icon = kind === 'success' ? '✔' : '✖';
  el.innerHTML = `<span aria-hidden="true">${icon}</span> ${message}`;
  region.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ---------- auth ---------- */

function renderLogin() {
  $('#app').innerHTML = `
    <div class="card" style="max-width: 420px; margin: var(--space-8) auto;">
      <h1 class="page-title">ParkWise console</h1>
      <p class="page-subtitle">Sign in with your attendant or admin account.</p>
      <form id="login-form" novalidate>
        <div class="field">
          <label class="field__label" for="username">Username</label>
          <input class="field__input" id="username" name="username" autocomplete="username" required />
        </div>
        <div class="field">
          <label class="field__label" for="password">Password</label>
          <input class="field__input" id="password" name="password" type="password" autocomplete="current-password" required />
          <span class="field__error" id="login-error" role="alert" hidden></span>
        </div>
        <div class="form-actions">
          <button class="btn btn--primary" type="submit" id="login-btn">Sign in</button>
        </div>
      </form>
    </div>`;

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#login-btn');
    const error = $('#login-error');
    error.hidden = true;
    button.disabled = true;
    button.innerHTML = '<span class="spinner" role="status" aria-label="Signing in"></span> Signing in…';
    try {
      const res = await api.login($('#username').value.trim(), $('#password').value);
      setToken(res.token);
      state.user = { username: res.username, role: res.role };
      renderConsole();
    } catch (err) {
      error.textContent = err.message ?? 'Sign in failed.';
      error.hidden = false;
      toast(err.message ?? 'Sign in failed.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });
}

function logout() {
  clearToken();
  state.user = null;
  renderLogin();
}

/* ---------- console shell ---------- */

function renderConsole() {
  $('#app').innerHTML = `
    <header class="header">
      <div class="header__inner">
        <span class="header__brand">ParkWise</span>
        <div class="header__spacer"></div>
        <div class="header__user">
          <span>${state.user.username} · ${state.user.role}</span>
          <button class="btn btn--secondary btn--small" id="logout-btn">Log out</button>
        </div>
      </div>
    </header>
    <main class="container">
      <h1 class="page-title">Attendant console</h1>
      <p class="page-subtitle">Register entries, take payments and complete exits. All amounts in EUR.</p>
      <div class="console-grid">
        <div>
          <section class="card" aria-labelledby="entry-heading">
            <h2 class="section-title" id="entry-heading">New entry</h2>
            <form id="entry-form" novalidate>
              <div class="field">
                <label class="field__label" for="plate">Plate</label>
                <input class="field__input" id="plate" name="plate" placeholder="AA-000-BB" autocomplete="off" />
                <span class="field__error" id="plate-error" role="alert" hidden></span>
                <span class="field__hint">Format: two letters, three digits, two letters.</span>
              </div>
              <div class="field">
                <label class="field__label" for="vehicle-type">Vehicle type</label>
                <select class="field__input" id="vehicle-type" name="vehicleType">
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Compact">Compact</option>
                  <option value="Standard" selected>Standard</option>
                  <option value="Ev">EV (charger)</option>
                </select>
              </div>
              <div class="form-actions">
                <button class="btn btn--primary" type="submit" id="entry-btn">Register entry</button>
              </div>
            </form>
          </section>
          ${state.user.role === 'admin' ? `
          <section class="card section-gap" aria-labelledby="occupancy-heading">
            <h2 class="section-title" id="occupancy-heading">Occupancy</h2>
            <div id="occupancy-body"><div class="loading-block" role="status"><span class="spinner" aria-label="Loading"></span> Loading…</div></div>
          </section>` : ''}
        </div>
        <section class="card" aria-labelledby="tickets-heading">
          <h2 class="section-title" id="tickets-heading">Active tickets</h2>
          <div id="tickets-body"><div class="loading-block" role="status"><span class="spinner" aria-label="Loading"></span> Loading tickets…</div></div>
        </section>
      </div>
    </main>
    <div class="toasts" id="toasts" aria-live="polite"></div>`;

  $('#logout-btn').addEventListener('click', logout);
  $('#entry-form').addEventListener('submit', onRegisterEntry);
  loadTickets();
  if (state.user.role === 'admin') loadOccupancy();
}

/* ---------- new entry ---------- */

async function onRegisterEntry(event) {
  event.preventDefault();
  const button = $('#entry-btn');
  const plateError = $('#plate-error');
  plateError.hidden = true;
  $('#plate').classList.remove('field__input--invalid');
  button.disabled = true; // double-submit safe
  button.innerHTML = '<span class="spinner" role="status" aria-label="Registering"></span> Registering…';
  try {
    const ticket = await api.registerEntry($('#plate').value.trim().toUpperCase(), $('#vehicle-type').value);
    toast(`Ticket issued — bay ${ticket.bayId}`);
    $('#entry-form').reset();
    loadTickets();
    if (state.user.role === 'admin') loadOccupancy();
  } catch (err) {
    const fieldMsg = fieldError(err, 'plate');
    if (fieldMsg) {
      plateError.textContent = fieldMsg;
      plateError.hidden = false;
      $('#plate').classList.add('field__input--invalid');
      $('#plate').focus();
    }
    toast(err.message ?? 'Entry failed.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Register entry';
  }
}

/* ---------- tickets table ---------- */

async function loadTickets() {
  const body = $('#tickets-body');
  state.ticketsError = null;
  body.innerHTML = '<div class="loading-block" role="status"><span class="spinner" aria-label="Loading"></span> Loading tickets…</div>';
  try {
    state.tickets = await api.tickets('open');
  } catch (err) {
    state.tickets = [];
    state.ticketsError = err.message ?? 'Failed to load tickets.';
  }
  renderTickets();
}

function renderTickets() {
  const body = $('#tickets-body');
  if (state.ticketsError) {
    body.innerHTML = `
      <div class="state state--error" role="alert">
        <p class="state__title">Something went wrong</p>
        <p>${state.ticketsError}</p>
        <div class="state__actions"><button class="btn btn--secondary" id="retry-tickets">Try again</button></div>
      </div>`;
    $('#retry-tickets').addEventListener('click', loadTickets);
    return;
  }
  if (state.tickets.length === 0) {
    body.innerHTML = `
      <div class="state">
        <p class="state__title">No active tickets</p>
        <p>Register an entry to get started.</p>
      </div>`;
    return;
  }
  const rows = state.tickets
    .map(
      (t) => `
      <tr>
        <td>${t.plate}</td>
        <td>${t.vehicleType}</td>
        <td>${t.bayId}</td>
        <td>${dayOf(t.entryAt)} ${timeOf(t.entryAt)}</td>
        <td><strong>${money(t.currentFee)}</strong></td>
        <td>
          <span class="badge badge--${t.status}"><span aria-hidden="true">${t.status === 'open' ? '●' : t.status === 'paid' ? '✔' : '⚠'}</span> ${t.status}</span>
        </td>
        <td>
          <div class="table__actions">
            ${t.status === 'open' ? `<button class="btn btn--primary btn--small" data-action="pay" data-id="${t.id}" ${state.busy[t.id] ? 'disabled' : ''}>Pay</button>` : ''}
            ${t.status === 'open' ? `<button class="btn btn--secondary btn--small" data-action="lost" data-id="${t.id}" ${state.busy[t.id] ? 'disabled' : ''}>Lost</button>` : ''}
            <button class="btn btn--danger btn--small" data-action="exit" data-id="${t.id}" ${state.busy[t.id] ? 'disabled' : ''}>Exit</button>
          </div>
        </td>
      </tr>`,
    )
    .join('');
  body.innerHTML = `
    <div style="overflow-x: auto;">
      <table class="table">
        <thead>
          <tr><th scope="col">Plate</th><th scope="col">Vehicle</th><th scope="col">Bay</th><th scope="col">Entry</th><th scope="col">Fee (live)</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  body.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onTicketAction(btn.dataset.action, btn.dataset.id));
  });
}

async function onTicketAction(action, ticketId) {
  const key = `${action}:${ticketId}`;
  if (state.busy[key]) return; // double-submit safety
  state.busy[key] = true;
  renderTickets();
  try {
    if (action === 'pay') {
      const receipt = await api.pay(ticketId, 'card');
      toast(`Payment received — ${money(receipt.amount)} (receipt ${receipt.id.slice(0, 8)}…)`);
    } else if (action === 'lost') {
      await api.markLost(ticketId);
      toast('Ticket marked lost — flat fee applies.');
    } else if (action === 'exit') {
      const result = await api.exit(ticketId);
      toast(result.feeCollected > 0 ? `Exit completed — collected ${money(result.feeCollected)}` : 'Exit completed — within grace, no fee.');
    }
  } catch (err) {
    if (err.code === 'PAYMENT_REQUIRED') {
      toast(`Payment required before exit — fee ${money(err.details?.fee)} ${err.details?.currency ?? 'EUR'}.`, 'error');
    } else {
      toast(err.message ?? 'Action failed.', 'error');
    }
  } finally {
    delete state.busy[key];
    loadTickets();
    if (state.user.role === 'admin') loadOccupancy();
  }
}

/* ---------- occupancy (admin only) ---------- */

async function loadOccupancy() {
  const body = $('#occupancy-body');
  if (!body) return;
  try {
    state.occupancy = await api.occupancy();
    state.occupancyError = null;
  } catch (err) {
    state.occupancy = [];
    state.occupancyError = err.message ?? 'Failed to load occupancy.';
  }
  renderOccupancy();
}

function renderOccupancy() {
  const body = $('#occupancy-body');
  if (!body) return;
  if (state.occupancyError) {
    body.innerHTML = `
      <div class="state state--error" role="alert">
        <p class="state__title">Something went wrong</p>
        <p>${state.occupancyError}</p>
        <div class="state__actions"><button class="btn btn--secondary" id="retry-occupancy">Try again</button></div>
      </div>`;
    $('#retry-occupancy').addEventListener('click', loadOccupancy);
    return;
  }
  body.innerHTML = `
    <ul class="occupancy">
      ${state.occupancy
        .map((o) => {
          const pct = o.total === 0 ? 0 : Math.round((o.used / o.total) * 100);
          const full = o.used >= o.total;
          return `
          <li>
            <span class="occupancy__label">${o.type}</span>
            <span class="meter" role="img" aria-label="${o.type}: ${o.used} of ${o.total} bays used">
              <span class="meter__fill${full ? ' meter__fill--full' : ''}" style="width: ${pct}%"></span>
            </span>
            <span class="occupancy__count">${o.used}/${o.total}${full ? ' · full' : ''}</span>
          </li>`;
        })
        .join('')}
    </ul>`;
}

/* ---------- boot ---------- */

if (getToken()) {
  // Session token exists — show the console; the first API call failing with 401
  // surfaces an error state via the normal paths.
  api
    .tickets('open')
    .then(() => {
      // decode role from the token payload for display purposes only
      try {
        const payload = JSON.parse(atob(getToken().split('.')[1]));
        state.user = { username: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? 'user', role: payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? 'attendant' };
      } catch {
        state.user = { username: 'user', role: 'attendant' };
      }
      renderConsole();
    })
    .catch((err) => {
      if (err.code === 'NETWORK') {
        $('#app').innerHTML = '<div class="container"><div class="state state--error" role="alert"><p class="state__title">Cannot reach the server</p><p>Start the ParkWise API, then reload this page.</p></div></div>';
      } else {
        clearToken();
        renderLogin();
      }
    });
} else {
  renderLogin();
}
