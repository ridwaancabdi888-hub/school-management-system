let CURRENT_USER = null;

async function fetchClasses() { return (await api('/academics/classes')).classes; }
async function fetchSections(classId) { return (await api(`/academics/sections${classId ? '?classId=' + classId : ''}`)).sections; }
function sectionOptionsHtml(sections, selected) {
  return `<option value="">All Sections</option>` + sections.map(s => `<option value="${s.id}" ${s.id == selected ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
}

async function init() {
  CURRENT_USER = await requireRole(['teacher']);
  if (!CURRENT_USER) return;
  const content = buildShell({
    user: CURRENT_USER,
    brandLabel: CURRENT_USER.schoolName || 'Teacher Portal',
    navItems: [
      { route: '/dashboard', label: 'Dashboard' },
      { route: '/my-classes', label: 'My Classes' },
      { route: '/attendance', label: 'Attendance' },
      { route: '/marks', label: 'Marks Entry' },
      { route: '/announcements', label: 'Announcements' }
    ]
  });
  initRouter({
    '/dashboard': renderDashboard,
    '/my-classes': renderMyClasses,
    '/attendance': renderAttendance,
    '/marks': renderMarksEntry,
    '/announcements': renderAnnouncements
  }, content, '/dashboard');
}

async function renderDashboard(content) {
  const s = await api('/dashboard/teacher');
  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Assigned Classes (Subjects)</div><div class="value">${s.assignedClasses}</div></div>
      <div class="stat-card"><div class="label">Class Teacher Of</div><div class="value">${s.classTeacherSections}</div></div>
    </div>
    <div class="card"><h3>Recent Announcements</h3>
      <div class="table-wrap"><table><thead><tr><th>Title</th><th>Date</th></tr></thead><tbody>
        ${s.recentAnnouncements.map(a => `<tr><td>${escapeHtml(a.title)}</td><td>${fmtDate(a.created_at)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="2">No announcements</td></tr>`}
      </tbody></table></div>
    </div>
  `;
}

async function renderMyClasses(content) {
  const { classTeacherOf, subjectAssignments } = await api('/teachers/my-classes');
  content.innerHTML = `
    <h2>My Classes</h2>
    <div class="two-col">
      <div class="card"><h3>Class Teacher Of</h3>
        ${classTeacherOf.map(c => `<p>${escapeHtml(c.class_name)} — ${escapeHtml(c.section_name)}</p>`).join('') || `<p class="text-muted">Not assigned as class teacher</p>`}
      </div>
      <div class="card"><h3>Subject Assignments</h3>
        ${subjectAssignments.map(a => `<p>${escapeHtml(a.subject_name)} — ${escapeHtml(a.class_name)}</p>`).join('') || `<p class="text-muted">No subject assignments</p>`}
      </div>
    </div>
  `;
}

async function renderAttendance(content) {
  const classes = await fetchClasses();
  const today = new Date().toISOString().slice(0, 10);
  content.innerHTML = `
    <h2>Mark Attendance</h2>
    <div class="toolbar">
      <select id="a-class"><option value="">Select Class</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="a-section"><option value="">Select Section</option></select>
      <input type="date" id="a-date" value="${today}">
      <button class="btn sm" id="a-load">Load Students</button>
    </div>
    <div id="a-table"></div>
  `;
  content.querySelector('#a-class').addEventListener('change', async (e) => {
    const sections = await fetchSections(e.target.value || undefined);
    content.querySelector('#a-section').innerHTML = `<option value="">Select Section</option>` + sections.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  });
  content.querySelector('#a-load').addEventListener('click', async () => {
    const classId = content.querySelector('#a-class').value;
    const sectionId = content.querySelector('#a-section').value;
    const date = content.querySelector('#a-date').value;
    if (!classId || !date) { toast('Select a class and date', 'error'); return; }
    const { records } = await api(`/attendance/daily?classId=${classId}${sectionId ? '&sectionId=' + sectionId : ''}&date=${date}`);
    const statuses = ['present', 'absent', 'late', 'excused'];
    content.querySelector('#a-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Admission No</th><th>Name</th><th>Status</th></tr></thead><tbody>
        ${records.map(r => `<tr data-student="${r.student_id}">
          <td>${escapeHtml(r.admission_no)}</td><td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name || '')}</td>
          <td><div class="pill-tabs" style="margin:0" data-status-group>
            ${statuses.map(st => `<button type="button" class="${r.status === st || (!r.status && st === 'present') ? 'active' : ''}" data-status="${st}">${st[0].toUpperCase() + st.slice(1)}</button>`).join('')}
          </div></td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="3">No active students</td></tr>`}
      </tbody></table></div>
      ${records.length ? `<div class="btn-row" style="margin-top:12px"><button class="btn" id="a-save">Save Attendance</button></div>` : ''}
    `;
    content.querySelectorAll('[data-status-group]').forEach(group => group.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      group.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    })));
    const saveBtn = content.querySelector('#a-save');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const rows = content.querySelectorAll('#a-table tbody tr[data-student]');
      const recordsPayload = Array.from(rows).map(row => ({ studentId: row.dataset.student, status: row.querySelector('[data-status-group] button.active')?.dataset.status || 'present' }));
      await api('/attendance/mark', { method: 'POST', body: { classId, sectionId: sectionId || null, date, records: recordsPayload } });
      toast('Attendance saved', 'success');
    });
  });
}

async function renderMarksEntry(content) {
  const { exams } = await api('/exams');
  content.innerHTML = `
    <h2>Marks Entry</h2>
    <div class="toolbar"><select id="m-exam"><option value="">Select Exam</option>${exams.map(e => `<option value="${e.id}">${escapeHtml(e.name)} — ${escapeHtml(e.class_name)} (${e.status})</option>`).join('')}</select></div>
    <div id="m-table"></div>
  `;
  content.querySelector('#m-exam').addEventListener('change', async (e) => {
    const examId = e.target.value;
    if (!examId) { content.querySelector('#m-table').innerHTML = ''; return; }
    const { exam, subjects, students, marks } = await api(`/results/exam/${examId}/marksheet`);
    content.querySelector('#m-table').innerHTML = `
      <div class="table-wrap" style="max-height:60vh;overflow-y:auto"><table><thead><tr><th>Student</th>${subjects.map(s => `<th>${escapeHtml(s.subject_name)} (/${s.max_marks})</th>`).join('')}</tr></thead>
      <tbody>${students.map(st => `<tr><td>${escapeHtml(st.first_name)} ${escapeHtml(st.last_name || '')}</td>
        ${subjects.map(s => {
          const existing = marks[`${st.id}-${s.exam_subject_id}`];
          return `<td><input type="number" style="width:80px" data-student="${st.id}" data-examsubject="${s.exam_subject_id}" value="${existing && existing.marks_obtained != null ? existing.marks_obtained : ''}"></td>`;
        }).join('')}</tr>`).join('') || `<tr class="empty-row"><td colspan="${subjects.length + 1}">No students</td></tr>`}</tbody></table></div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" id="save-marks">Save Marks</button></div>
    `;
    content.querySelector('#save-marks').addEventListener('click', async () => {
      const inputs = content.querySelectorAll('input[data-student]');
      const entries = Array.from(inputs).map(inp => ({ studentId: inp.dataset.student, examSubjectId: inp.dataset.examsubject, marks: inp.value }));
      await api(`/results/exam/${examId}/marks`, { method: 'POST', body: { entries } });
      toast('Marks saved', 'success');
    });
  });
}

async function renderTimetable(content) {
  const { timetable } = await api(`/timetable?teacherUserId=${CURRENT_USER.id}`);
  content.innerHTML = `
    <h2>My Timetable</h2>
    <div class="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Class</th><th>Subject</th></tr></thead><tbody>
      ${timetable.map(t => `<tr><td>${t.day}</td><td>${t.start_time.slice(0,5)} - ${t.end_time.slice(0,5)}</td><td>${escapeHtml(t.class_name)} ${escapeHtml(t.section_name || '')}</td><td>${escapeHtml(t.subject_name || '-')}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="4">No timetable slots assigned</td></tr>`}
    </tbody></table></div>
  `;
}

async function renderAnnouncements(content) {
  const { announcements } = await api('/announcements/mine');
  content.innerHTML = `
    <h2>Announcements</h2>
    ${announcements.map(a => `<div class="card" style="margin-bottom:10px"><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p><p class="text-muted">${fmtDate(a.created_at)}</p></div>`).join('') || `<p class="text-muted">No announcements yet</p>`}
  `;
}

init();
