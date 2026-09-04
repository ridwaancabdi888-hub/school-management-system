let CURRENT_USER = null;

async function init() {
  CURRENT_USER = await requireRole(['parent']);
  if (!CURRENT_USER) return;
  const content = buildShell({
    user: CURRENT_USER,
    brandLabel: CURRENT_USER.schoolName || 'Parent Portal',
    navItems: [
      { route: '/children', label: 'My Children' },
      { route: '/announcements', label: 'Announcements' }
    ]
  });
  initRouter({
    '/children': renderChildren,
    '/announcements': renderAnnouncements
  }, content, '/children');
}

async function renderChildren(content) {
  const { children } = await api('/parent/children');
  content.innerHTML = `
    <h2>My Children</h2>
    <div class="stat-grid">
      ${children.map(c => `
        <div class="card">
          <div class="flex items-center gap-14" style="margin-bottom:10px">
            ${c.photo ? `<img class="avatar-photo" style="width:48px;height:48px" src="${c.photo}">` : `<div class="avatar-photo" style="width:48px;height:48px"></div>`}
            <div><h3 style="margin:0">${escapeHtml(c.first_name)} ${escapeHtml(c.last_name || '')}</h3><p class="text-muted" style="margin:0">${escapeHtml(c.admission_no)}</p></div>
          </div>
          <p><strong>Class:</strong> ${escapeHtml(c.class_name || '-')} ${escapeHtml(c.section_name || '')}</p>
          <p>${badge(c.status)}</p>
          <button class="btn sm" data-view="${c.id}">View Details</button>
        </div>
      `).join('') || `<p class="text-muted">No children linked to your account yet. Contact the school office.</p>`}
    </div>
  `;
  content.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => openChildDetail(btn.dataset.view, children.find(c => c.id == btn.dataset.view))));
}

async function openChildDetail(studentId, child) {
  const [attendance, results, fees, timetable] = await Promise.all([
    api(`/parent/children/${studentId}/attendance`),
    api(`/parent/children/${studentId}/results`),
    api(`/parent/children/${studentId}/fees`),
    api(`/parent/children/${studentId}/timetable`)
  ]);
  const examIds = [...new Set(results.results.map(r => r.exam_id))];

  openModal({
    title: `${child.first_name} ${child.last_name || ''}`,
    wide: true,
    bodyHtml: `
      <div class="tabs">
        <button class="active" data-tab="attendance">Attendance</button>
        <button data-tab="results">Results</button>
        <button data-tab="fees">Fees</button>
        <button data-tab="timetable">Timetable</button>
      </div>
      <div id="tab-attendance">
        <p><strong>Attendance rate:</strong> ${attendance.percentage == null ? '-' : attendance.percentage + '%'}</p>
        <div class="table-wrap" style="max-height:280px;overflow-y:auto"><table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>
          ${attendance.records.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${badge(r.status)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="2">No records</td></tr>`}
        </tbody></table></div>
      </div>
      <div id="tab-results" class="hidden">
        ${examIds.map(examId => {
          const rows = results.results.filter(r => r.exam_id === examId);
          return `<div style="margin-bottom:14px"><div class="section-header"><h4 style="margin:0">${escapeHtml(rows[0].exam_name)}</h4>
            <a class="btn secondary sm" href="${apiDownloadUrl(`/parent/children/${studentId}/report-card/${examId}`)}" target="_blank">Report Card (JSON)</a></div>
            <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Marks</th></tr></thead><tbody>
              ${rows.map(r => `<tr><td>${escapeHtml(r.subject_name)}</td><td>${r.marks_obtained == null ? '-' : r.marks_obtained} / ${r.max_marks}</td></tr>`).join('')}
            </tbody></table></div></div>`;
        }).join('') || `<p class="text-muted">No published results yet</p>`}
      </div>
      <div id="tab-fees" class="hidden">
        <div class="table-wrap"><table><thead><tr><th>Fee Type</th><th>Required</th><th>Paid</th><th>Balance</th></tr></thead><tbody>
          ${fees.feeSummary.map(f => `<tr><td>${escapeHtml(f.fee_type)}</td><td>${fmtMoney(f.amount_required)}</td><td>${fmtMoney(f.amount_paid)}</td><td>${fmtMoney(f.amount_required - f.amount_paid)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="4">No fees assigned</td></tr>`}
        </tbody></table></div>
      </div>
      <div id="tab-timetable" class="hidden">
        <div class="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th></tr></thead><tbody>
          ${timetable.timetable.map(t => `<tr><td>${t.day}</td><td>${t.start_time.slice(0,5)}-${t.end_time.slice(0,5)}</td><td>${escapeHtml(t.subject_name || '-')}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="3">No timetable</td></tr>`}
        </tbody></table></div>
      </div>
    `,
    onMount: (body) => {
      const tabs = body.querySelectorAll('.tabs button');
      tabs.forEach(btn => btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ['attendance', 'results', 'fees', 'timetable'].forEach(t => body.querySelector(`#tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
      }));
    }
  });
}

async function renderAnnouncements(content) {
  const { announcements } = await api('/parent/announcements');
  content.innerHTML = `
    <h2>Announcements</h2>
    ${announcements.map(a => `<div class="card" style="margin-bottom:10px"><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p><p class="text-muted">${fmtDate(a.created_at)}</p></div>`).join('') || `<p class="text-muted">No announcements yet</p>`}
  `;
}

init();
