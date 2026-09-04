async function fetchClasses() { return (await api('/academics/classes')).classes; }
async function fetchSections(classId) { return (await api(`/academics/sections${classId ? '?classId=' + classId : ''}`)).sections; }
async function fetchSubjects() { return (await api('/academics/subjects')).subjects; }

function classOptionsHtml(classes, selected) {
  return `<option value="">All Classes</option>` + classes.map(c => `<option value="${c.id}" ${c.id == selected ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
}
function sectionOptionsHtml(sections, selected) {
  return `<option value="">All Sections</option>` + sections.map(s => `<option value="${s.id}" ${s.id == selected ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
}

async function renderClasses(content) {
  const [classes, sections, subjects] = await Promise.all([fetchClasses(), fetchSections(), fetchSubjects()]);

  content.innerHTML = `
    <div class="pill-tabs">
      <button class="active" data-tab="classes">Classes & Sections</button>
      <button data-tab="subjects">Subjects</button>
      <button data-tab="assign">Subject-Teacher Assignment</button>
    </div>
    <div id="panel-classes"></div>
    <div id="panel-subjects" class="hidden"></div>
    <div id="panel-assign" class="hidden"></div>
  `;

  content.querySelectorAll('.pill-tabs button').forEach(btn => btn.addEventListener('click', () => {
    content.querySelectorAll('.pill-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['classes', 'subjects', 'assign'].forEach(t => content.querySelector(`#panel-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
  }));

  renderClassesPanel(content.querySelector('#panel-classes'), classes, sections);
  renderSubjectsPanel(content.querySelector('#panel-subjects'), subjects);
  renderAssignPanel(content.querySelector('#panel-assign'), classes, subjects);
}

function renderClassesPanel(panel, classes, sections) {
  panel.innerHTML = `
    <div class="two-col">
      <div>
        <div class="section-header"><h2>Classes</h2><button class="btn sm" id="add-class-btn">+ Add Class</button></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Academic Year</th><th>Students</th><th></th></tr></thead>
        <tbody>${classes.map(c => `<tr>
          <td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.academic_year || '-')}</td><td>${c.student_count}</td>
          <td><button class="btn danger sm" data-del-class="${c.id}">Delete</button></td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="4">No classes yet</td></tr>`}</tbody></table></div>
      </div>
      <div>
        <div class="section-header"><h2>Sections</h2><button class="btn sm" id="add-section-btn">+ Add Section</button></div>
        <div class="table-wrap"><table><thead><tr><th>Class</th><th>Section</th><th>Class Teacher</th><th></th></tr></thead>
        <tbody>${sections.map(s => `<tr>
          <td>${escapeHtml(s.class_name)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.class_teacher_name || '-')}</td>
          <td><button class="btn danger sm" data-del-section="${s.id}">Delete</button></td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="4">No sections yet</td></tr>`}</tbody></table></div>
      </div>
    </div>
  `;

  panel.querySelector('#add-class-btn').addEventListener('click', () => {
    openModal({
      title: 'Add Class',
      bodyHtml: `<form id="f"><div class="field"><label>Class Name *</label><input name="name" required placeholder="e.g. Grade 3"></div>
        <div class="field"><label>Academic Year</label><input name="academicYear" placeholder="2025-2026"></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save</button></div></form>`,
      onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        await api('/academics/classes', { method: 'POST', body: payload });
        close(); toast('Class added', 'success'); renderClasses(document.getElementById('content'));
      })
    });
  });

  panel.querySelector('#add-section-btn').addEventListener('click', () => {
    openModal({
      title: 'Add Section',
      bodyHtml: `<form id="f">
        <div class="field"><label>Class *</label><select name="classId" required>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Section Name *</label><input name="name" required placeholder="e.g. A"></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save</button></div></form>`,
      onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        await api('/academics/sections', { method: 'POST', body: payload });
        close(); toast('Section added', 'success'); renderClasses(document.getElementById('content'));
      })
    });
  });

  panel.querySelectorAll('[data-del-class]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDialog('Delete this class? This cannot be undone.')) return;
    try { await api(`/academics/classes/${btn.dataset.delClass}`, { method: 'DELETE' }); renderClasses(document.getElementById('content')); }
    catch (err) { toast(err.message, 'error'); }
  }));
  panel.querySelectorAll('[data-del-section]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDialog('Delete this section?')) return;
    await api(`/academics/sections/${btn.dataset.delSection}`, { method: 'DELETE' });
    renderClasses(document.getElementById('content'));
  }));
}

function renderSubjectsPanel(panel, subjects) {
  panel.innerHTML = `
    <div class="section-header"><h2>Subjects</h2><button class="btn sm" id="add-subject-btn">+ Add Subject</button></div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th></th></tr></thead>
    <tbody>${subjects.map(s => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.code || '-')}</td>
      <td><button class="btn danger sm" data-del="${s.id}">Delete</button></td></tr>`).join('') || `<tr class="empty-row"><td colspan="3">No subjects yet</td></tr>`}</tbody></table></div>
  `;
  panel.querySelector('#add-subject-btn').addEventListener('click', () => {
    openModal({
      title: 'Add Subject',
      bodyHtml: `<form id="f"><div class="field"><label>Subject Name *</label><input name="name" required></div>
        <div class="field"><label>Code</label><input name="code"></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save</button></div></form>`,
      onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        await api('/academics/subjects', { method: 'POST', body: payload });
        close(); toast('Subject added', 'success'); renderClasses(document.getElementById('content'));
      })
    });
  });
  panel.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDialog('Delete this subject?')) return;
    await api(`/academics/subjects/${btn.dataset.del}`, { method: 'DELETE' });
    renderClasses(document.getElementById('content'));
  }));
}

function renderAssignPanel(panel, classes, subjects) {
  panel.innerHTML = `
    <div class="field" style="max-width:280px"><label>Select Class</label>
      <select id="assign-class-select"><option value="">Choose a class...</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
    </div>
    <div id="assign-table"></div>
  `;
  panel.querySelector('#assign-class-select').addEventListener('change', async (e) => {
    const classId = e.target.value;
    const table = panel.querySelector('#assign-table');
    if (!classId) { table.innerHTML = ''; return; }
    const [{ assignments }, teachers] = await Promise.all([api(`/academics/class-subjects/${classId}`), (await api('/teachers')).teachers]);
    table.innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Teacher</th></tr></thead><tbody>
        ${subjects.map(sub => {
          const existing = assignments.find(a => a.subject_id === sub.id);
          return `<tr><td>${escapeHtml(sub.name)}</td><td>
            <select data-subject="${sub.id}">
              <option value="">Unassigned</option>
              ${teachers.map(t => `<option value="${t.id}" ${existing && existing.teacher_id == t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select></td></tr>`;
        }).join('')}
      </tbody></table></div>
      <div class="btn-row" style="margin-top:10px"><button class="btn sm" id="save-assign">Save Assignments</button></div>
    `;
    table.querySelector('#save-assign').addEventListener('click', async () => {
      const selects = table.querySelectorAll('select[data-subject]');
      for (const sel of selects) {
        await api('/academics/class-subjects', { method: 'POST', body: { classId, subjectId: sel.dataset.subject, teacherId: sel.value || null } });
      }
      toast('Assignments saved', 'success');
    });
  });
}
