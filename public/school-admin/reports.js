async function renderReports(content) {
  content.innerHTML = `
    <h2>Reports</h2>
    <div class="stat-grid">
      <div class="card"><h3>Students</h3><p class="text-muted">Full student roster with class, guardian and status.</p>
        <a class="btn secondary sm" href="${apiDownloadUrl('/reports/students?format=csv')}" target="_blank">Download CSV</a></div>
      <div class="card"><h3>Attendance</h3><p class="text-muted">Monthly attendance report per class.</p>
        <a class="btn secondary sm" href="#/attendance">Go to Attendance</a></div>
      <div class="card"><h3>Payments</h3><p class="text-muted">All fee payments recorded to date.</p>
        <a class="btn secondary sm" href="${apiDownloadUrl('/reports/payments?format=csv')}" target="_blank">Download CSV</a></div>
      <div class="card"><h3>Unpaid Fees</h3><p class="text-muted">Students with an outstanding balance.</p>
        <a class="btn secondary sm" href="#/fees">Go to Fees</a></div>
      <div class="card"><h3>Exam Results</h3><p class="text-muted">Ranked results per exam.</p>
        <a class="btn secondary sm" href="#/exams">Go to Exams</a></div>
    </div>
  `;
}
