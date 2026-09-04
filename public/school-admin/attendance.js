async function renderAttendance(content) {
  const classes = await fetchClasses();
  content.innerHTML = `
    <div class="pill-tabs">
      <button class="active" data-tab="mark">Mark Attendance</button>
      <button data-tab="report">Monthly Report</button>
    </div>
    <div id="panel-mark"></div>
    <div id="panel-report" class="hidden"></div>
  `;
  content.querySelectorAll('.pill-tabs button').forEach(btn => btn.addEventListener('click', () => {
    content.querySelectorAll('.pill-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['mark', 'report'].forEach(t => content.querySelector(`#panel-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
  }));
  renderMarkPanel(content.querySelector('#panel-mark'), classes);
  renderReportPanel(content.querySelector('#panel-report'), classes);
}

function renderMarkPanel(panel, classes) {
  const today = new Date().toISOString().slice(0, 10);
  panel.innerHTML = `
    <div class="toolbar">
      <select id="a-class"><option value="">Select Class</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="a-section"><option value="">Select Section</option></select>
      <input type="date" id="a-date" value="${today}">
      <button class="btn sm" id="a-load">Load Students</button>
    </div>
    <div id="a-table"></div>
  `;
  panel.querySelector('#a-class').addEventListener('change', async (e) => {
    const sections = await fetchSections(e.target.value || undefined);
    panel.querySelector('#a-section').innerHTML = `<option value="">Select Section</option>` + sections.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  });
  panel.querySelector('#a-load').addEventListener('click', async () => {
    const classId = panel.querySelector('#a-class').value;
    const sectionId = panel.querySelector('#a-section').value;
    const date = panel.querySelector('#a-date').value;
    if (!classId || !date) { toast('Select a class and date', 'error'); return; }
    const { records } = await api(`/attendance/daily?classId=${classId}${sectionId ? '&sectionId=' + sectionId : ''}&date=${date}`);
    const statuses = ['present', 'absent', 'late', 'excused'];
    panel.querySelector('#a-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Admission No</th><th>Name</th><th>Status</th></tr></thead><tbody>
        ${records.map(r => `<tr data-student="${r.student_id}">
          <td>${escapeHtml(r.admission_no)}</td><td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name || '')}</td>
          <td>
            <div class="pill-tabs" style="margin:0" data-status-group>
              ${statuses.map(st => `<button type="button" class="${r.status === st ? 'active' : (!r.status && st === 'present' ? 'active' : '')}" data-status="${st}">${st[0].toUpperCase() + st.slice(1)}</button>`).join('')}
            </div>
          </td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="3">No active students in this selection</td></tr>`}
      </tbody></table></div>
      ${records.length ? `<div class="btn-row" style="margin-top:12px"><button class="btn" id="a-save">Save Attendance</button></div>` : ''}
    `;
    panel.querySelectorAll('[data-status-group]').forEach(group => {
      group.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        group.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      }));
    });
    const saveBtn = panel.querySelector('#a-save');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const rows = panel.querySelectorAll('#a-table tbody tr[data-student]');
      const recordsPayload = Array.from(rows).map(row => ({
        studentId: row.dataset.student,
        status: row.querySelector('[data-status-group] button.active')?.dataset.status || 'present'
      }));
      await api('/attendance/mark', { method: 'POST', body: { classId, sectionId: sectionId || null, date, records: recordsPayload } });
      toast('Attendance saved', 'success');
    });
  });
}

function renderReportPanel(panel, classes) {
  const month = new Date().toISOString().slice(0, 7);
  panel.innerHTML = `
    <div class="toolbar">
      <select id="r-class"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="r-section"><option value="">All Sections</option></select>
      <input type="month" id="r-month" value="${month}">
      <button class="btn sm" id="r-load">Run Report</button>
    </div>
    <div id="r-table"></div>
  `;
  panel.querySelector('#r-class').addEventListener('change', async (e) => {
    const sections = await fetchSections(e.target.value || undefined);
    panel.querySelector('#r-section').innerHTML = sectionOptionsHtml(sections);
  });
  panel.querySelector('#r-load').addEventListener('click', async () => {
    const classId = panel.querySelector('#r-class').value;
    const sectionId = panel.querySelector('#r-section').value;
    const m = panel.querySelector('#r-month').value;
    const { records } = await api(`/attendance/monthly-report?month=${m}${classId ? '&classId=' + classId : ''}${sectionId ? '&sectionId=' + sectionId : ''}`);
    panel.querySelector('#r-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Admission No</th><th>Name</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>%</th></tr></thead><tbody>
        ${records.map(r => {
          const pct = r.total > 0 ? Math.round((r.present / r.total) * 1000) / 10 : null;
          return `<tr><td>${escapeHtml(r.admission_no)}</td><td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name || '')}</td>
          <td>${r.present || 0}</td><td>${r.absent || 0}</td><td>${r.late || 0}</td><td>${r.excused || 0}</td><td>${pct == null ? '-' : pct + '%'}</td></tr>`;
        }).join('') || `<tr class="empty-row"><td colspan="7">No data</td></tr>`}
      </tbody></table></div>
    `;
  });
}
