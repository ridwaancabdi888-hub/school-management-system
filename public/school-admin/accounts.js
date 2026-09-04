async function renderAccounts(content) {
  content.innerHTML = `
    <div class="section-header"><h2>Accounts</h2><button class="btn" id="add-accountant-btn">+ Add Accountant</button></div>
    <div class="toolbar">
      <select id="acc-role">
        <option value="">All Roles</option>
        <option value="school_admin">School Admin</option><option value="teacher">Teacher</option>
        <option value="accountant">Accountant</option>
        <option value="student">Student</option><option value="parent">Parent</option>
      </select>
    </div>
    <div id="acc-table"></div>
  `;
  content.querySelector('#add-accountant-btn').addEventListener('click', () => {
    openModal({
      title: 'Add Accountant',
      bodyHtml: `
        <form id="f">
          <div class="form-grid">
            <div class="field"><label>Name *</label><input name="name" required></div>
            <div class="field"><label>Username *</label><input name="username" required></div>
            <div class="field"><label>Email</label><input name="email" type="email"></div>
            <div class="field"><label>Phone</label><input name="phone"></div>
            <div class="field"><label>Initial Password *</label><input name="password" required minlength="6"></div>
          </div>
          <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Add Accountant</button></div>
        </form>
      `,
      onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        payload.designation = 'accountant';
        try {
          await api('/staff', { method: 'POST', body: payload });
          toast('Accountant account created', 'success');
          close();
          load();
        } catch (err) { toast(err.message, 'error'); }
      })
    });
  });
  const load = async () => {
    const role = content.querySelector('#acc-role').value;
    const { accounts } = await api(`/school/accounts${role ? '?role=' + role : ''}`);
    content.querySelector('#acc-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${accounts.map(a => `<tr>
          <td>${escapeHtml(a.name)}</td><td>${badge(a.role, 'info')}</td><td>${escapeHtml(a.username)}</td><td>${escapeHtml(a.email || '-')}</td>
          <td>${badge(a.status)}</td>
          <td class="btn-row">
            <button class="btn secondary sm" data-reset="${a.id}">Reset Password</button>
            ${a.status === 'active' ? `<button class="btn danger sm" data-deact="${a.id}">Deactivate</button>` : `<button class="btn success sm" data-act="${a.id}">Activate</button>`}
          </td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="6">No accounts found</td></tr>`}
      </tbody></table></div>
    `;
    content.querySelectorAll('[data-reset]').forEach(btn => btn.addEventListener('click', () => {
      openModal({
        title: 'Reset Password',
        bodyHtml: `<form id="f"><div class="field"><label>New Password *</label><input name="newPassword" required minlength="6"></div>
          <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Reset</button></div></form>`,
        onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const payload = Object.fromEntries(new FormData(e.target).entries());
          await api(`/school/accounts/${btn.dataset.reset}/password`, { method: 'PUT', body: payload });
          toast('Password reset', 'success');
          close();
        })
      });
    }));
    content.querySelectorAll('[data-deact]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Deactivate this account?')) return;
      await api(`/school/accounts/${btn.dataset.deact}/status`, { method: 'PUT', body: { status: 'inactive' } });
      load();
    }));
    content.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/school/accounts/${btn.dataset.act}/status`, { method: 'PUT', body: { status: 'active' } });
      load();
    }));
  };
  content.querySelector('#acc-role').addEventListener('change', load);
  await load();
}
