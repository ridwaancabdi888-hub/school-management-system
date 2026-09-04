async function renderTeachers(content) {
  content.innerHTML = `
    <div class="section-header"><h2>Teachers</h2><button class="btn" id="add-teacher-btn">+ Add Teacher</button></div>
    <div class="toolbar"><input id="t-search" placeholder="Search by name..."></div>
    <div id="teachers-table"></div>
  `;
  const load = async () => {
    const search = content.querySelector('#t-search').value;
    const { teachers } = await api(`/teachers${search ? '?search=' + encodeURIComponent(search) : ''}`);
    content.querySelector('#teachers-table').innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${teachers.map(t => `<tr>
          <td>${t.photo ? `<img class="avatar-photo" src="${t.photo}">` : `<div class="avatar-photo"></div>`}</td>
          <td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.username)}</td><td>${escapeHtml(t.email || '-')}</td>
          <td>${escapeHtml(t.phone || '-')}</td><td>${fmtDate(t.joining_date)}</td><td>${badge(t.status)}</td>
          <td class="btn-row">
            <button class="btn secondary sm" data-edit="${t.id}">Edit</button>
            ${t.status === 'active' ? `<button class="btn danger sm" data-deact="${t.id}">Deactivate</button>` : `<button class="btn success sm" data-act="${t.id}">Activate</button>`}
          </td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="8">No teachers yet</td></tr>`}</tbody>
      </table></div>
    `;
    content.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
      const t = teachers.find(x => x.id == btn.dataset.edit);
      openTeacherForm(content, t);
    }));
    content.querySelectorAll('[data-deact]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Deactivate this teacher?')) return;
      await api(`/teachers/${btn.dataset.deact}/status`, { method: 'PUT', body: { status: 'inactive' } });
      load();
    }));
    content.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/teachers/${btn.dataset.act}/status`, { method: 'PUT', body: { status: 'active' } });
      load();
    }));
  };
  content.querySelector('#add-teacher-btn').addEventListener('click', () => openTeacherForm(content));
  let timer; content.querySelector('#t-search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
  await load();
}

function openTeacherForm(content, teacher) {
  const isEdit = !!teacher;
  openModal({
    title: isEdit ? 'Edit Teacher' : 'Add Teacher',
    bodyHtml: `
      <form id="f" enctype="multipart/form-data">
        <div class="form-grid">
          <div class="field"><label>Name *</label><input name="name" required value="${escapeHtml(teacher?.name || '')}"></div>
          ${isEdit ? '' : `<div class="field"><label>Username *</label><input name="username" required></div>`}
          <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(teacher?.email || '')}"></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(teacher?.phone || '')}"></div>
          <div class="field"><label>Joining Date</label><input type="date" name="joiningDate" value="${teacher ? (fmtDate(teacher.joining_date) === '-' ? '' : fmtDate(teacher.joining_date)) : ''}"></div>
          ${isEdit ? '' : `<div class="field"><label>Initial Password *</label><input name="password" required></div>`}
          <div class="field"><label>Photo</label><input type="file" name="photo" accept="image/*"></div>
        </div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">${isEdit ? 'Save' : 'Add Teacher'}</button></div>
      </form>
    `,
    onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        if (isEdit) {
          await api(`/teachers/${teacher.id}`, { method: 'PUT', body: fd, isForm: true });
          toast('Teacher updated', 'success');
        } else {
          const result = await api('/teachers', { method: 'POST', body: fd, isForm: true });
          toast('Teacher added', 'success');
        }
        close();
        renderTeachers(document.getElementById('content'));
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}
