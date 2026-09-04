let CURRENT_USER = null;

async function init() {
  CURRENT_USER = await requireRole(['super_admin']);
  if (!CURRENT_USER) return;

  const content = buildShell({
    user: CURRENT_USER,
    brandLabel: 'Platform Admin',
    navItems: [
      { route: '/dashboard', label: 'Dashboard' },
      { route: '/schools', label: 'Schools' }
    ]
  });

  initRouter({
    '/dashboard': renderDashboard,
    '/schools': renderSchools
  }, content, '/dashboard');
}

// ---------------------------------------------------------------- Dashboard
async function renderDashboard(content) {
  const s = await api('/super-admin/stats');
  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total Schools</div><div class="value">${s.totalSchools}</div></div>
      <div class="stat-card"><div class="label">Active Schools</div><div class="value text-success">${s.activeSchools}</div></div>
      <div class="stat-card"><div class="label">Suspended Schools</div><div class="value text-danger">${s.suspendedSchools}</div></div>
      <div class="stat-card"><div class="label">Total Students</div><div class="value">${s.totalStudents}</div></div>
      <div class="stat-card"><div class="label">Total Teachers</div><div class="value">${s.totalTeachers}</div></div>
    </div>
    <div class="card">
      <h3>Recently Added Schools</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Package</th><th>Added</th></tr></thead>
          <tbody>
            ${s.recentSchools.map(sc => `<tr>
              <td>${escapeHtml(sc.name)}</td><td>${escapeHtml(sc.code)}</td>
              <td>${badge(sc.status)}</td><td>${escapeHtml(sc.package)}</td><td>${fmtDate(sc.created_at)}</td>
            </tr>`).join('') || `<tr class="empty-row"><td colspan="5">No schools yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------ Schools
async function renderSchools(content) {
  const { schools } = await api('/super-admin/schools');
  content.innerHTML = `
    <div class="section-header">
      <h2>Schools</h2>
      <button class="btn" id="add-school-btn">+ Add New School</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>School</th><th>Code</th><th>City</th><th>Status</th><th>Package</th><th>Students</th><th>Teachers</th><th>Actions</th></tr></thead>
        <tbody>
          ${schools.map(sc => `<tr>
            <td><strong>${escapeHtml(sc.name)}</strong></td>
            <td>${escapeHtml(sc.code)}</td>
            <td>${escapeHtml(sc.city || '-')}</td>
            <td>${badge(sc.status)}</td>
            <td>${escapeHtml(sc.package)}</td>
            <td>${sc.student_count}</td>
            <td>${sc.teacher_count}</td>
            <td class="btn-row">
              <button class="btn secondary sm" data-view="${sc.id}">View</button>
              ${sc.status === 'active'
                ? `<button class="btn danger sm" data-suspend="${sc.id}">Suspend</button>`
                : `<button class="btn success sm" data-activate="${sc.id}">Activate</button>`}
            </td>
          </tr>`).join('') || `<tr class="empty-row"><td colspan="8">No schools yet — add your first school to get started.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  content.querySelector('#add-school-btn').addEventListener('click', () => openAddSchoolModal(() => renderSchools(content)));
  content.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => openSchoolDetail(btn.dataset.view, () => renderSchools(content))));
  content.querySelectorAll('[data-suspend]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDialog('Suspend this school? Its users will be unable to log in until reactivated.')) return;
    await api(`/super-admin/schools/${btn.dataset.suspend}/suspend`, { method: 'POST' });
    toast('School suspended', 'success');
    renderSchools(content);
  }));
  content.querySelectorAll('[data-activate]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/super-admin/schools/${btn.dataset.activate}/activate`, { method: 'POST' });
    toast('School activated', 'success');
    renderSchools(content);
  }));
}

function openAddSchoolModal(onDone) {
  openModal({
    title: 'Add New School',
    wide: true,
    bodyHtml: `
      <form id="add-school-form">
        <h4>School Details</h4>
        <div class="form-grid">
          <div class="field"><label>School Name *</label><input name="name" required></div>
          <div class="field"><label>School Code *</label><input name="code" required placeholder="e.g. SUNA"></div>
          <div class="field"><label>Logo</label><input type="file" name="logo" accept="image/*"></div>
          <div class="field"><label>Address</label><input name="address"></div>
          <div class="field"><label>City</label><input name="city"></div>
          <div class="field"><label>Phone</label><input name="phone"></div>
          <div class="field"><label>Email</label><input name="email" type="email"></div>
          <div class="field"><label>Package</label>
            <select name="package"><option value="basic">Basic</option><option value="standard" selected>Standard</option><option value="premium">Premium</option></select>
          </div>
          <div class="field"><label>Status</label>
            <select name="status"><option value="active" selected>Active</option><option value="suspended">Suspended</option></select>
          </div>
          <div class="field"><label>Start Date</label><input name="startDate" type="date"></div>
        </div>
        <div class="field"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>

        <h4>School Admin Account</h4>
        <div class="form-grid">
          <div class="field"><label>Admin Name *</label><input name="adminName" required></div>
          <div class="field"><label>Admin Email</label><input name="adminEmail" type="email"></div>
          <div class="field"><label>Username *</label><input name="adminUsername" required></div>
          <div class="field"><label>Initial Password *</label><input name="adminPassword" required minlength="6"></div>
        </div>
        <div class="btn-row" style="margin-top:16px;justify-content:flex-end">
          <button type="button" class="btn secondary" id="cancel-btn">Cancel</button>
          <button type="submit" class="btn">Create School</button>
        </div>
      </form>
    `,
    onMount: (body, close) => {
      body.querySelector('#cancel-btn').addEventListener('click', close);
      body.querySelector('#add-school-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const result = await api('/super-admin/schools', { method: 'POST', body: fd, isForm: true });
          close();
          toast('School created successfully', 'success');
          showCredentials(result);
          onDone();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }
  });
}

function showCredentials(result) {
  openModal({
    title: 'School Created — Save These Credentials',
    bodyHtml: `
      <p>These credentials are shown <strong>once</strong>. Share them securely with the school admin — the plaintext password is not stored and cannot be retrieved again.</p>
      <div class="card">
        <p><strong>School:</strong> ${escapeHtml(result.school.name)} (${escapeHtml(result.school.code)})</p>
        <p><strong>Admin Username:</strong> ${escapeHtml(result.admin.username)}</p>
        <p><strong>Initial Password:</strong> <code>${escapeHtml(result.admin.initialPassword)}</code></p>
      </div>
      <div class="btn-row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="ok-btn">Done</button></div>
    `,
    onMount: (body, close) => body.querySelector('#ok-btn').addEventListener('click', close)
  });
}

async function openSchoolDetail(id, onDone) {
  const { school, admins } = await api(`/super-admin/schools/${id}`);
  openModal({
    title: school.name,
    wide: true,
    bodyHtml: `
      <div class="tabs">
        <button class="active" data-tab="details">Details</button>
        <button data-tab="admins">School Admins</button>
        <button data-tab="branding">Package</button>
      </div>
      <div id="tab-details">
        <form id="edit-school-form">
          <div class="form-grid">
            <div class="field"><label>School Name</label><input name="name" value="${escapeHtml(school.name)}"></div>
            <div class="field"><label>Logo</label><input type="file" name="logo" accept="image/*"></div>
            <div class="field"><label>Address</label><input name="address" value="${escapeHtml(school.address || '')}"></div>
            <div class="field"><label>City</label><input name="city" value="${escapeHtml(school.city || '')}"></div>
            <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(school.phone || '')}"></div>
            <div class="field"><label>Email</label><input name="email" value="${escapeHtml(school.email || '')}"></div>
          </div>
          <div class="field"><label>Notes</label><textarea name="notes" rows="2">${escapeHtml(school.notes || '')}</textarea></div>
          <div class="btn-row" style="justify-content:flex-end"><button type="submit" class="btn">Save Changes</button></div>
        </form>
      </div>
      <div id="tab-admins" class="hidden">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="admins-tbody"></tbody>
          </table>
        </div>
        <h4 style="margin-top:18px">Create Additional School Admin</h4>
        <form id="add-admin-form" class="form-grid">
          <div class="field"><label>Name</label><input name="name" required></div>
          <div class="field"><label>Username</label><input name="username" required></div>
          <div class="field"><label>Email</label><input name="email" type="email"></div>
          <div class="field"><label>Password</label><input name="password" required minlength="6"></div>
          <div class="field" style="align-self:end"><button class="btn" type="submit">Add Admin</button></div>
        </form>
      </div>
      <div id="tab-branding" class="hidden">
        <form id="branding-form">
          <div class="form-grid">
            <div class="field"><label>Package</label>
              <select name="package">
                <option value="basic" ${school.package==='basic'?'selected':''}>Basic</option>
                <option value="standard" ${school.package==='standard'?'selected':''}>Standard</option>
                <option value="premium" ${school.package==='premium'?'selected':''}>Premium</option>
              </select>
            </div>
          </div>
          <div class="btn-row" style="justify-content:flex-end"><button type="submit" class="btn">Save</button></div>
        </form>
      </div>
    `,
    onMount: (body) => {
      const tabs = body.querySelectorAll('.tabs button');
      tabs.forEach(btn => btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ['details', 'admins', 'branding'].forEach(t => body.querySelector(`#tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
      }));

      const renderAdmins = () => {
        body.querySelector('#admins-tbody').innerHTML = admins.map(a => `
          <tr>
            <td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.username)}</td><td>${escapeHtml(a.email || '-')}</td>
            <td>${badge(a.status)}</td>
            <td>${a.status === 'active'
              ? `<button class="btn danger sm" data-deact="${a.id}">Deactivate</button>`
              : `<button class="btn success sm" data-act="${a.id}">Activate</button>`}</td>
          </tr>`).join('') || `<tr class="empty-row"><td colspan="5">No admins yet</td></tr>`;
        body.querySelectorAll('[data-deact]').forEach(btn => btn.addEventListener('click', async () => {
          await api(`/super-admin/schools/${id}/admins/${btn.dataset.deact}/status`, { method: 'PUT', body: { status: 'inactive' } });
          admins.find(a => a.id == btn.dataset.deact).status = 'inactive';
          renderAdmins();
        }));
        body.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
          await api(`/super-admin/schools/${id}/admins/${btn.dataset.act}/status`, { method: 'PUT', body: { status: 'active' } });
          admins.find(a => a.id == btn.dataset.act).status = 'active';
          renderAdmins();
        }));
      };
      renderAdmins();

      body.querySelector('#edit-school-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await api(`/super-admin/schools/${id}`, { method: 'PUT', body: fd, isForm: true });
          toast('School updated', 'success');
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      });

      body.querySelector('#branding-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        try {
          await api(`/super-admin/schools/${id}`, { method: 'PUT', body: payload });
          toast('Branding updated', 'success');
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      });

      body.querySelector('#add-admin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        try {
          const result = await api(`/super-admin/schools/${id}/admins`, { method: 'POST', body: payload });
          toast('School admin created', 'success');
          admins.push({ id: result.admin.id, name: payload.name, username: payload.username, email: payload.email, status: 'active' });
          renderAdmins();
          e.target.reset();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}

init();
