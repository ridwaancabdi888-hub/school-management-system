let CURRENT_USER = null;

async function init() {
  CURRENT_USER = await requireRole(['student']);
  if (!CURRENT_USER) return;
  const content = buildShell({
    user: CURRENT_USER,
    brandLabel: CURRENT_USER.schoolName || 'Student Portal',
    navItems: [
      { route: '/profile', label: 'My Profile' },
      { route: '/attendance', label: 'Attendance' },
      { route: '/results', label: 'Results & Report Cards' },
      { route: '/fees', label: 'Fee Status' },
      { route: '/timetable', label: 'Timetable' },
      { route: '/announcements', label: 'Announcements' }
    ]
  });
  initRouter({
    '/profile': renderProfile,
    '/attendance': renderAttendance,
    '/results': renderResults,
    '/fees': renderFees,
    '/timetable': renderTimetable,
    '/announcements': renderAnnouncements
  }, content, '/profile');
}

async function renderProfile(content) {
  const { student } = await api('/student-portal/profile');
  content.innerHTML = `
    <h2>My Profile</h2>
    <div class="card" style="max-width:500px">
      <div class="flex items-center gap-14" style="margin-bottom:14px">
        ${student.photo ? `<img class="avatar-photo" style="width:64px;height:64px" src="${student.photo}">` : `<div class="avatar-photo" style="width:64px;height:64px"></div>`}
        <div><h3 style="margin:0">${escapeHtml(student.first_name)} ${escapeHtml(student.last_name || '')}</h3><p class="text-muted" style="margin:0">${escapeHtml(student.admission_no)}</p></div>
      </div>
      <p><strong>Class:</strong> ${escapeHtml(student.class_name || '-')} ${escapeHtml(student.section_name || '')}</p>
      <p><strong>Gender:</strong> ${escapeHtml(student.gender || '-')} &nbsp; <strong>DOB:</strong> ${fmtDate(student.dob)}</p>
      <p><strong>Guardian:</strong> ${escapeHtml(student.guardian_name || '-')} (${escapeHtml(student.guardian_phone || '-')})</p>
      <p><strong>Address:</strong> ${escapeHtml(student.address || '-')}</p>
      <p><strong>Status:</strong> ${badge(student.status)}</p>
    </div>
  `;
}

async function renderAttendance(content) {
  const { records, percentage } = await api('/student-portal/attendance');
  content.innerHTML = `
    <h2>My Attendance</h2>
    <div class="card" style="max-width:300px;margin-bottom:16px">
      <div class="label">Attendance Rate</div><div class="value" style="font-size:28px;font-weight:800">${percentage == null ? '-' : percentage + '%'}</div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Remarks</th></tr></thead><tbody>
      ${records.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${badge(r.status)}</td><td>${escapeHtml(r.remarks || '-')}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="3">No attendance records yet</td></tr>`}
    </tbody></table></div>
  `;
}

async function renderResults(content) {
  const { results } = await api('/student-portal/results');
  const examIds = [...new Set(results.map(r => r.exam_id))];
  content.innerHTML = `
    <h2>Results &amp; Report Cards</h2>
    ${examIds.map(examId => {
      const rows = results.filter(r => r.exam_id === examId);
      return `<div class="card" style="margin-bottom:14px">
        <div class="section-header"><h3 style="margin:0">${escapeHtml(rows[0].exam_name)} (${escapeHtml(rows[0].term || '')})</h3>
          <a class="btn secondary sm" href="${apiDownloadUrl(`/student-portal/report-card/${examId}/pdf`)}" target="_blank">Download Report Card</a></div>
        <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Marks</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td>${escapeHtml(r.subject_name)}</td><td>${r.marks_obtained == null ? '-' : r.marks_obtained} / ${r.max_marks}</td></tr>`).join('')}
        </tbody></table></div>
      </div>`;
    }).join('') || `<p class="text-muted">No published results yet</p>`}
  `;
}

async function renderFees(content) {
  const { feeSummary, payments } = await api('/student-portal/fees');
  content.innerHTML = `
    <h2>Fee Status</h2>
    <div class="table-wrap"><table><thead><tr><th>Fee Type</th><th>Required</th><th>Paid</th><th>Balance</th></tr></thead><tbody>
      ${feeSummary.map(f => `<tr><td>${escapeHtml(f.fee_type)}</td><td>${fmtMoney(f.amount_required)}</td><td>${fmtMoney(f.amount_paid)}</td><td>${fmtMoney(f.amount_required - f.amount_paid)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="4">No fees assigned</td></tr>`}
    </tbody></table></div>
    <h3 style="margin-top:18px">Payment History</h3>
    <div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Amount</th><th>Date</th></tr></thead><tbody>
      ${payments.map(p => `<tr><td>${escapeHtml(p.receipt_no)}</td><td>${fmtMoney(p.amount)}</td><td>${fmtDate(p.payment_date)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="3">No payments yet</td></tr>`}
    </tbody></table></div>
  `;
}

async function renderTimetable(content) {
  const { timetable } = await api('/student-portal/timetable');
  content.innerHTML = `
    <h2>My Timetable</h2>
    <div class="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th></tr></thead><tbody>
      ${timetable.map(t => `<tr><td>${t.day}</td><td>${t.start_time.slice(0,5)} - ${t.end_time.slice(0,5)}</td><td>${escapeHtml(t.subject_name || '-')}</td><td>${escapeHtml(t.teacher_name || '-')}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="4">No timetable available</td></tr>`}
    </tbody></table></div>
  `;
}

async function renderAnnouncements(content) {
  const { announcements } = await api('/student-portal/announcements');
  content.innerHTML = `
    <h2>Announcements</h2>
    ${announcements.map(a => `<div class="card" style="margin-bottom:10px"><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.body)}</p><p class="text-muted">${fmtDate(a.created_at)}</p></div>`).join('') || `<p class="text-muted">No announcements yet</p>`}
  `;
}

init();
