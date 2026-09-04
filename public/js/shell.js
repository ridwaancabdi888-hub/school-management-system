// Builds the common sidebar + topbar app shell used by every portal
// (School Admin, Teacher, Accountant, Student, Parent). Each portal supplies
// its own nav items and a map of hash-route -> render function.
function buildShell({ user, brandLabel, navItems }) {
  document.body.innerHTML = `
    <div class="app-shell">
      <div class="sidebar-backdrop"></div>
      <aside class="sidebar">
        <div class="brand"><span class="dot"></span> ${escapeHtml(brandLabel)}</div>
        <nav id="sidebar-nav">
          ${navItems.map(item => `<a href="#${item.route}" data-route="${item.route}">${item.icon || ''} ${escapeHtml(item.label)}</a>`).join('')}
        </nav>
        <div class="foot">${escapeHtml(user.schoolName || 'Platform')}</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="flex items-center gap-8">
            <button class="menu-toggle" aria-label="Toggle menu">&#9776;</button>
            <div class="title" id="page-title">Dashboard</div>
          </div>
          <div class="user">
            <span>${escapeHtml(user.name)}</span>
            <div class="avatar">${escapeHtml((user.name || '?')[0].toUpperCase())}</div>
            <button class="btn secondary sm" id="logout-btn">Logout</button>
          </div>
        </header>
        <main class="content" id="content"><div class="loading">Loading...</div></main>
      </div>
    </div>
  `;

  document.getElementById('logout-btn').addEventListener('click', logout);

  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  document.querySelector('.menu-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  });

  return document.getElementById('content');
}

function initRouter(routes, contentEl, defaultRoute) {
  async function render() {
    const route = (window.location.hash || `#${defaultRoute}`).slice(1);
    document.querySelectorAll('#sidebar-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-backdrop').classList.remove('open');

    const handler = routes[route] || routes[defaultRoute];
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = (document.querySelector(`#sidebar-nav a[data-route="${route}"]`) || {}).textContent || 'Dashboard';

    contentEl.innerHTML = '<div class="loading">Loading...</div>';
    try {
      await handler(contentEl);
    } catch (err) {
      contentEl.innerHTML = `<div class="card"><p class="text-danger">${escapeHtml(err.message)}</p></div>`;
    }
  }
  window.addEventListener('hashchange', render);
  render();
}
