// Thin fetch wrapper shared by every portal. Cookies (the JWT) are sent
// automatically because everything is same-origin.
async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData — browser sets the multipart boundary
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(`/api${path}`, opts);
  if (res.status === 401) {
    // Avoid a reload loop when this call is itself made from the login
    // page (e.g. its "already logged in?" check) — only bounce there
    // from other pages, where a 401 means the session expired.
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login/';
    }
    throw new Error('Not authenticated');
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (data && data.error) || 'Something went wrong';
    throw new Error(message);
  }
  return data;
}

function apiDownloadUrl(path) {
  return `/api${path}`;
}

// ---- Toasts -----------------------------------------------------------------
function toast(message, type = 'info') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    document.body.appendChild(region);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ---- Small DOM helpers --------------------------------------------------------
function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(d) {
  if (!d) return '-';
  return String(d).slice(0, 10);
}

function fmtMoney(n, currency = '') {
  if (n === null || n === undefined) return '-';
  return `${currency ? currency + ' ' : ''}${Number(n).toFixed(2)}`;
}

function badge(text, cls) {
  return `<span class="badge ${cls || (text || '').toLowerCase()}">${escapeHtml(text)}</span>`;
}

// ---- Modal --------------------------------------------------------------------
function openModal({ title, bodyHtml, wide = false, onMount }) {
  const backdrop = h(`<div class="modal-backdrop">
    <div class="modal ${wide ? 'wide' : ''}">
      <div class="modal-header"><h3>${escapeHtml(title)}</h3><button class="modal-close" aria-label="Close">&times;</button></div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  </div>`);
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  if (onMount) onMount(backdrop.querySelector('.modal-body'), close);
  return close;
}

function confirmDialog(message) {
  return window.confirm(message);
}

// ---- Auth guard -----------------------------------------------------------------
async function requireRole(allowedRoles) {
  try {
    const { user } = await api('/auth/me');
    if (!allowedRoles.includes(user.role)) {
      window.location.href = '/login/';
      return null;
    }
    return user;
  } catch (err) {
    window.location.href = '/login/';
    return null;
  }
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = '/login/';
}

function roleHome(role) {
  return {
    super_admin: '/superadmin/',
    school_admin: '/school-admin/',
    teacher: '/teacher/',
    student: '/student/',
    parent: '/parent/',
    accountant: '/accountant/',
    staff: '/school-admin/'
  }[role] || '/login/';
}
