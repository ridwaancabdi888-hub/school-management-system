let STUDENTS_STATE = { search: '', classId: '', sectionId: '', status: '', page: 1 };

async function renderStudents(content) {
  const classes = await fetchClasses();
  content.innerHTML = `
    <div class="section-header">
      <h2>Students</h2>
      <div class="btn-row">
        <button class="btn secondary" id="import-btn">Import Excel/CSV</button>
        <a class="btn secondary" href="${apiDownloadUrl('/import-export/students/export')}" target="_blank">Export</a>
        <button class="btn" id="add-student-btn">+ Add Student</button>
      </div>
    </div>
    <div class="toolbar">
      <input id="s-search" placeholder="Search name or admission no..." value="${escapeHtml(STUDENTS_STATE.search)}">
      <select id="s-class"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}" ${c.id == STUDENTS_STATE.classId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="s-section"><option value="">All Sections</option></select>
      <select id="s-status">
        <option value="">All Status</option>
        <option value="active" ${STUDENTS_STATE.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="inactive" ${STUDENTS_STATE.status === 'inactive' ? 'selected' : ''}>Inactive</option>
      </select>
    </div>
    <div id="students-table"></div>
  `;

  const classSelect = content.querySelector('#s-class');
  const sectionSelect = content.querySelector('#s-section');
  const refreshSections = async () => {
    const sections = await fetchSections(classSelect.value || undefined);
    sectionSelect.innerHTML = sectionOptionsHtml(sections, STUDENTS_STATE.sectionId);
  };
  await refreshSections();

  const doSearch = async () => {
    STUDENTS_STATE.search = content.querySelector('#s-search').value;
    STUDENTS_STATE.classId = classSelect.value;
    STUDENTS_STATE.sectionId = sectionSelect.value;
    STUDENTS_STATE.status = content.querySelector('#s-status').value;
    STUDENTS_STATE.page = 1;
    await loadStudentsTable(content);
  };

  let searchTimer;
  content.querySelector('#s-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 300); });
  classSelect.addEventListener('change', async () => { await refreshSections(); doSearch(); });
  sectionSelect.addEventListener('change', doSearch);
  content.querySelector('#s-status').addEventListener('change', doSearch);

  content.querySelector('#add-student-btn').addEventListener('click', () => openStudentForm(content));
  content.querySelector('#import-btn').addEventListener('click', () => openImportWizard(content));

  await loadStudentsTable(content);
}

async function loadStudentsTable(content) {
  const table = content.querySelector('#students-table');
  table.innerHTML = '<div class="loading">Loading...</div>';
  const params = new URLSearchParams();
  if (STUDENTS_STATE.search) params.set('search', STUDENTS_STATE.search);
  if (STUDENTS_STATE.classId) params.set('classId', STUDENTS_STATE.classId);
  if (STUDENTS_STATE.sectionId) params.set('sectionId', STUDENTS_STATE.sectionId);
  if (STUDENTS_STATE.status) params.set('status', STUDENTS_STATE.status);
  params.set('page', STUDENTS_STATE.page);
  const { students, total, pageSize } = await api(`/students?${params}`);

  table.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th></th><th>Admission No</th><th>Name</th><th>Class</th><th>Section</th><th>Gender</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${students.map(s => `<tr>
            <td>${s.photo ? `<img class="avatar-photo" src="${s.photo}">` : `<div class="avatar-photo" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:#64748b">${escapeHtml(s.first_name[0])}</div>`}</td>
            <td>${escapeHtml(s.admission_no)}</td>
            <td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name || '')}</td>
            <td>${escapeHtml(s.class_name || '-')}</td>
            <td>${escapeHtml(s.section_name || '-')}</td>
            <td>${escapeHtml(s.gender || '-')}</td>
            <td>${badge(s.status)}</td>
            <td class="btn-row">
              <button class="btn secondary sm" data-profile="${s.id}">View</button>
              <button class="btn secondary sm" data-edit="${s.id}">Edit</button>
              ${s.status === 'active'
                ? `<button class="btn danger sm" data-deact="${s.id}">Deactivate</button>`
                : `<button class="btn success sm" data-act="${s.id}">Activate</button>`}
            </td>
          </tr>`).join('') || `<tr class="empty-row"><td colspan="8">No students found</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <span class="text-muted">${total} total</span>
      <button class="btn secondary sm" id="prev-page" ${STUDENTS_STATE.page <= 1 ? 'disabled' : ''}>Prev</button>
      <span>Page ${STUDENTS_STATE.page}</span>
      <button class="btn secondary sm" id="next-page" ${STUDENTS_STATE.page * pageSize >= total ? 'disabled' : ''}>Next</button>
    </div>
  `;

  table.querySelectorAll('[data-profile]').forEach(btn => btn.addEventListener('click', () => openStudentProfile(btn.dataset.profile)));
  table.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
    const { student } = await api(`/students/${btn.dataset.edit}`);
    openStudentForm(content, student);
  }));
  table.querySelectorAll('[data-deact]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDialog('Deactivate this student?')) return;
    await api(`/students/${btn.dataset.deact}/status`, { method: 'PUT', body: { status: 'inactive' } });
    loadStudentsTable(content);
  }));
  table.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/students/${btn.dataset.act}/status`, { method: 'PUT', body: { status: 'active' } });
    loadStudentsTable(content);
  }));
  const prev = table.querySelector('#prev-page'), next = table.querySelector('#next-page');
  if (prev) prev.addEventListener('click', () => { STUDENTS_STATE.page--; loadStudentsTable(content); });
  if (next) next.addEventListener('click', () => { STUDENTS_STATE.page++; loadStudentsTable(content); });
}

async function openStudentForm(content, student) {
  const classes = await fetchClasses();
  const isEdit = !!student;
  openModal({
    title: isEdit ? 'Edit Student' : 'Add Student',
    wide: true,
    bodyHtml: `
      <form id="f" enctype="multipart/form-data">
        <div class="form-grid">
          <div class="field"><label>First Name *</label><input name="firstName" required value="${escapeHtml(student?.first_name || '')}"></div>
          <div class="field"><label>Last Name</label><input name="lastName" value="${escapeHtml(student?.last_name || '')}"></div>
          <div class="field"><label>Class</label><select name="classId" id="f-class"><option value="">-</option>${classes.map(c => `<option value="${c.id}" ${c.id == student?.class_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Section</label><select name="sectionId" id="f-section"><option value="">-</option></select></div>
          <div class="field"><label>Gender</label><select name="gender"><option value="">-</option><option value="male" ${student?.gender === 'male' ? 'selected' : ''}>Male</option><option value="female" ${student?.gender === 'female' ? 'selected' : ''}>Female</option><option value="other" ${student?.gender === 'other' ? 'selected' : ''}>Other</option></select></div>
          <div class="field"><label>Date of Birth</label><input type="date" name="dob" value="${fmtDate(student?.dob) === '-' ? '' : fmtDate(student?.dob)}"></div>
          <div class="field"><label>Admission Date</label><input type="date" name="admissionDate" value="${fmtDate(student?.admission_date) === '-' ? '' : fmtDate(student?.admission_date)}"></div>
          <div class="field"><label>Admission No ${isEdit ? '' : '(auto if blank)'}</label><input name="admissionNo" ${isEdit ? 'disabled' : ''} value="${escapeHtml(student?.admission_no || '')}"></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(student?.phone || '')}"></div>
          <div class="field"><label>Photo</label><input type="file" name="photo" accept="image/*"></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Parent/Guardian Name</label><input name="guardianName" value="${escapeHtml(student?.guardian_name || '')}"></div>
          <div class="field"><label>Parent/Guardian Phone</label><input name="guardianPhone" value="${escapeHtml(student?.guardian_phone || '')}"></div>
        </div>
        <div class="field"><label>Address</label><input name="address" value="${escapeHtml(student?.address || '')}"></div>

        <div class="btn-row" style="justify-content:flex-end;margin-top:10px">
          <button type="submit" class="btn">${isEdit ? 'Save Changes' : 'Add Student'}</button>
        </div>
      </form>
    `,
    onMount: async (body, close) => {
      const classSel = body.querySelector('#f-class');
      const sectionSel = body.querySelector('#f-section');
      const refresh = async () => {
        const sections = await fetchSections(classSel.value || undefined);
        sectionSel.innerHTML = `<option value="">-</option>` + sections.map(s => `<option value="${s.id}" ${s.id == student?.section_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
      };
      classSel.addEventListener('change', refresh);
      await refresh();

      body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          if (isEdit) {
            await api(`/students/${student.id}`, { method: 'PUT', body: fd, isForm: true });
            toast('Student updated', 'success');
          } else {
            const result = await api('/students', { method: 'POST', body: fd, isForm: true });
            toast(`Student added (${result.admissionNo})`, 'success');
          }
          close();
          loadStudentsTable(document.getElementById('content'));
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}

async function openStudentProfile(id) {
  const data = await api(`/students/${id}`);
  const s = data.student;
  openModal({
    title: `${s.first_name} ${s.last_name || ''}`,
    wide: true,
    bodyHtml: `
      <div class="tabs">
        <button class="active" data-tab="profile">Profile</button>
        <button data-tab="attendance">Attendance</button>
        <button data-tab="fees">Fees & Payments</button>
        <button data-tab="results">Results</button>
      </div>
      <div id="tab-profile">
        <p><strong>Admission No:</strong> ${escapeHtml(s.admission_no)}</p>
        <p><strong>Class:</strong> ${escapeHtml(s.class_name || '-')} ${escapeHtml(s.section_name || '')}</p>
        <p><strong>Gender:</strong> ${escapeHtml(s.gender || '-')} &nbsp; <strong>DOB:</strong> ${fmtDate(s.dob)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(s.phone || '-')}</p>
        <p><strong>Guardian:</strong> ${escapeHtml(s.guardian_name || '-')} (${escapeHtml(s.guardian_phone || '-')})</p>
        <p><strong>Address:</strong> ${escapeHtml(s.address || '-')}</p>
        <p><strong>Status:</strong> ${badge(s.status)}</p>
      </div>
      <div id="tab-attendance" class="hidden">
        <p>Present: ${data.attendanceSummary.present || 0} · Absent: ${data.attendanceSummary.absent || 0} · Late: ${data.attendanceSummary.late || 0} · Excused: ${data.attendanceSummary.excused || 0}</p>
      </div>
      <div id="tab-fees" class="hidden">
        <div class="table-wrap"><table><thead><tr><th>Fee Type</th><th>Required</th><th>Paid</th><th>Balance</th></tr></thead><tbody>
          ${data.feeSummary.map(f => `<tr><td>${escapeHtml(f.fee_type)}</td><td>${fmtMoney(f.amount_required)}</td><td>${fmtMoney(f.amount_paid)}</td><td>${fmtMoney(f.amount_required - f.amount_paid)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="4">No fees assigned</td></tr>`}
        </tbody></table></div>
        <h4 style="margin-top:14px">Payment History</h4>
        <div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Amount</th><th>Date</th><th>Method</th></tr></thead><tbody>
          ${data.payments.map(p => `<tr><td>${escapeHtml(p.receipt_no)}</td><td>${fmtMoney(p.amount)}</td><td>${fmtDate(p.payment_date)}</td><td>${escapeHtml(p.method)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="4">No payments yet</td></tr>`}
        </tbody></table></div>
      </div>
      <div id="tab-results" class="hidden">
        <div class="table-wrap"><table><thead><tr><th>Exam</th><th>Subject</th><th>Marks</th></tr></thead><tbody>
          ${data.results.map(r => `<tr><td>${escapeHtml(r.exam_name)}</td><td>${escapeHtml(r.subject_name)}</td><td>${r.marks_obtained == null ? '-' : r.marks_obtained} / ${r.max_marks}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="3">No published results</td></tr>`}
        </tbody></table></div>
      </div>
    `,
    onMount: (body) => {
      const tabs = body.querySelectorAll('.tabs button');
      tabs.forEach(btn => btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ['profile', 'attendance', 'fees', 'results'].forEach(t => body.querySelector(`#tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
      }));
    }
  });
}

async function openImportWizard(content) {
  openModal({
    title: 'Import Students',
    wide: true,
    bodyHtml: `
      <div id="import-step-upload">
        <p class="text-muted">Upload a CSV or Excel file. Required column: <code>first_name</code>. Optional: admission_no, last_name, class_name, section_name, gender, dob, admission_date, phone, guardian_name, guardian_phone, address.</p>
        <form id="upload-form">
          <div class="field"><input type="file" name="file" accept=".csv,.xlsx,.xls" required></div>
          <button class="btn" type="submit">Upload & Preview</button>
        </form>
      </div>
      <div id="import-preview"></div>
    `,
    onMount: (body, close) => {
      body.querySelector('#upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const preview = await api('/import-export/students/preview', { method: 'POST', body: fd, isForm: true });
          renderImportPreview(body, preview, close, content);
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}

function renderImportPreview(body, preview, close, content) {
  body.querySelector('#import-step-upload').classList.add('hidden');
  const previewDiv = body.querySelector('#import-preview');
  previewDiv.innerHTML = `
    <p><strong>${preview.totalRows}</strong> rows found — <span class="text-success">${preview.validCount} valid</span>,
      <span class="text-danger">${preview.errorCount} with errors</span>, <span class="text-muted">${preview.duplicateCount} duplicates</span></p>
    <div class="table-wrap" style="max-height:320px;overflow-y:auto">
      <table><thead><tr><th>#</th><th>Name</th><th>Class</th><th>Status</th></tr></thead><tbody>
        ${preview.rows.map(r => `<tr>
          <td>${r.rowNumber}</td><td>${escapeHtml(r.data.first_name)} ${escapeHtml(r.data.last_name)}</td><td>${escapeHtml(r.data.class_name || '-')}</td>
          <td>${r.valid ? badge('Valid', 'active') : r.duplicate ? badge('Duplicate', 'pending') : `<span class="text-danger" title="${escapeHtml(r.errors.join('; '))}">${escapeHtml(r.errors.join('; '))}</span>`}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>
    <div class="btn-row" style="margin-top:12px;justify-content:flex-end">
      <button class="btn secondary" id="cancel-import">Cancel</button>
      <button class="btn" id="commit-import" ${preview.validCount === 0 ? 'disabled' : ''}>Import ${preview.validCount} Valid Rows</button>
    </div>
    <div id="import-summary"></div>
  `;
  previewDiv.querySelector('#cancel-import').addEventListener('click', close);
  previewDiv.querySelector('#commit-import').addEventListener('click', async () => {
    const result = await api('/import-export/students/commit', { method: 'POST', body: { rows: preview.rows } });
    previewDiv.querySelector('#import-summary').innerHTML = `
      <div class="card" style="margin-top:12px">
        <p><strong>Imported:</strong> ${result.imported} &nbsp; <strong>Skipped:</strong> ${result.skipped} &nbsp; <strong>Errors:</strong> ${result.errors}</p>
      </div>`;
    toast(`Imported ${result.imported}, skipped ${result.skipped}`, 'success');
    loadStudentsTable(content);
  });
}
