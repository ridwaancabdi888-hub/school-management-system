async function renderStaff(content) {
  content.innerHTML = `
    <div class="section-header"><h2>Staff</h2><button class="btn" id="add-staff-btn">+ Add Staff</button></div>
    <div class="toolbar">
      <select id="st-designation">
        <option value="">All Roles</option>
        <option value="accountant">Accountant</option><option value="reception">Reception</option>
        <option value="security">Security</option><option value="cleaner">Cleaner</option><option value="driver">Driver</option><option value="other">Other</option>
      </select>
    </div>
    <div id="staff-table"></div>
  `;
  const load = async () => {
    const d = content.querySelector('#st-designation').value;
    const { staff } = await api(`/staff${d ? '?designation=' + d : ''}`);
    content.querySelector('#staff-table').innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Phone</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${staff.map(s => `<tr>
          <td>${escapeHtml(s.name)}</td><td>${badge(s.designation, 'info')}</td><td>${escapeHtml(s.username)}</td>
          <td>${escapeHtml(s.phone || '-')}</td><td>${fmtDate(s.joining_date)}</td><td>${badge(s.status)}</td>
          <td class="btn-row">
            <button class="btn secondary sm" data-edit="${s.id}">Edit</button>
            ${s.status === 'active' ? `<button class="btn danger sm" data-deact="${s.id}">Deactivate</button>` : `<button class="btn success sm" data-act="${s.id}">Activate</button>`}
          </td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="7">No staff yet</td></tr>`}</tbody>
      </table></div>
    `;
    content.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openStaffForm(content, staff.find(x => x.id == btn.dataset.edit))));
    content.querySelectorAll('[data-deact]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Deactivate this staff member?')) return;
      await api(`/staff/${btn.dataset.deact}/status`, { method: 'PUT', body: { status: 'inactive' } });
      load();
    }));
    content.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/staff/${btn.dataset.act}/status`, { method: 'PUT', body: { status: 'active' } });
      load();
    }));
  };
  content.querySelector('#add-staff-btn').addEventListener('click', () => openStaffForm(content));
  content.querySelector('#st-designation').addEventListener('change', load);
  await load();
}

function openStaffForm(content, staff) {
  const isEdit = !!staff;
  openModal({
    title: isEdit ? 'Edit Staff' : 'Add Staff',
    bodyHtml: `
      <form id="f">
        <div class="form-grid">
          <div class="field"><label>Name *</label><input name="name" required value="${escapeHtml(staff?.name || '')}"></div>
          ${isEdit ? '' : `<div class="field"><label>Username *</label><input name="username" required></div>`}
          <div class="field"><label>Role *</label>
            <select name="designation" required>
              ${['accountant', 'reception', 'security', 'cleaner', 'driver', 'other'].map(d => `<option value="${d}" ${staff?.designation === d ? 'selected' : ''}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(staff?.email || '')}"></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(staff?.phone || '')}"></div>
          <div class="field"><label>Joining Date</label><input type="date" name="joiningDate" value="${staff ? (fmtDate(staff.joining_date) === '-' ? '' : fmtDate(staff.joining_date)) : ''}"></div>
          ${isEdit ? '' : `<div class="field"><label>Initial Password *</label><input name="password" required></div>`}
        </div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">${isEdit ? 'Save' : 'Add Staff'}</button></div>
      </form>
    `,
    onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (isEdit) await api(`/staff/${staff.id}`, { method: 'PUT', body: payload });
        else await api('/staff', { method: 'POST', body: payload });
        toast(isEdit ? 'Staff updated' : 'Staff added', 'success');
        close();
        renderStaff(document.getElementById('content'));
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}
