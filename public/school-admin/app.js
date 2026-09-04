let CURRENT_USER = null;
let SCHOOL = null;

async function init() {
  CURRENT_USER = await requireRole(['school_admin']);
  if (!CURRENT_USER) return;
  SCHOOL = await api('/school');

  const navItems = [
    { route: '/dashboard', label: 'Dashboard' },
    { route: '/students', label: 'Students' },
    { route: '/teachers', label: 'Teachers' },
    { route: '/classes', label: 'Classes & Subjects' },
    { route: '/attendance', label: 'Attendance' },
    { route: '/fees', label: 'Fees' },
    { route: '/payments', label: 'Payments' },
    { route: '/exams', label: 'Exams & Results' },
    { route: '/announcements', label: 'Announcements' },
    { route: '/reports', label: 'Reports' },
    { route: '/accounts', label: 'Accounts' },
    { route: '/settings', label: 'School Settings' }
  ];

  const content = buildShell({ user: CURRENT_USER, brandLabel: SCHOOL.school.name, navItems });

  initRouter({
    '/dashboard': renderSchoolAdminDashboard,
    '/students': renderStudents,
    '/teachers': renderTeachers,
    '/classes': renderClasses,
    '/attendance': renderAttendance,
    '/fees': renderFees,
    '/payments': renderPayments,
    '/exams': renderExams,
    '/announcements': renderAnnouncements,
    '/reports': renderReports,
    '/accounts': renderAccounts,
    '/settings': renderSettings
  }, content, '/dashboard');
}

async function renderSchoolAdminDashboard(content) {
  const s = await api('/dashboard/school-admin');
  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Students</div><div class="value">${s.students}</div></div>
      <div class="stat-card"><div class="label">Teachers</div><div class="value">${s.teachers}</div></div>
      <div class="stat-card"><div class="label">Classes</div><div class="value">${s.classes}</div></div>
      <div class="stat-card"><div class="label">Today's Attendance</div><div class="value">${s.todayAttendance.present}/${s.todayAttendance.total}</div></div>
      <div class="stat-card"><div class="label">This Month's Collections</div><div class="value">${fmtMoney(s.monthlyCollections, SCHOOL.school.currency)}</div></div>
      <div class="stat-card"><div class="label">Outstanding Fees</div><div class="value text-danger">${fmtMoney(s.outstandingFees, SCHOOL.school.currency)}</div></div>
    </div>
    <div class="card">
      <h3>Recent Announcements</h3>
      <div class="table-wrap"><table><thead><tr><th>Title</th><th>Date</th></tr></thead><tbody>
        ${s.recentAnnouncements.map(a => `<tr><td>${escapeHtml(a.title)}</td><td>${fmtDate(a.created_at)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="2">No announcements yet</td></tr>`}
      </tbody></table></div>
    </div>
  `;
}

init();
