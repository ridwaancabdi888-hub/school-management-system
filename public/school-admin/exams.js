async function renderExams(content) {
  const [classes, subjects] = await Promise.all([fetchClasses(), fetchSubjects()]);
  content.innerHTML = `
    <div class="section-header"><h2>Exams &amp; Results</h2><button class="btn" id="add-exam-btn">+ Create Exam</button></div>
    <div id="exams-table"></div>
  `;
  const load = async () => {
    const { exams } = await api('/exams');
    content.querySelector('#exams-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Class</th><th>Term</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${exams.map(e => `<tr>
          <td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.class_name)}</td><td>${escapeHtml(e.term || '-')}</td><td>${badge(e.status)}</td>
          <td class="btn-row">
            <button class="btn secondary sm" data-marks="${e.id}">Enter Marks</button>
            <button class="btn secondary sm" data-perf="${e.id}">Class Performance</button>
            ${e.status === 'draft'
              ? `<button class="btn success sm" data-publish="${e.id}">Publish</button>`
              : `<button class="btn danger sm" data-unpublish="${e.id}">Unpublish</button>`}
          </td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="5">No exams yet</td></tr>`}
      </tbody></table></div>
    `;
    content.querySelectorAll('[data-marks]').forEach(btn => btn.addEventListener('click', () => openMarksheet(btn.dataset.marks, load)));
    content.querySelectorAll('[data-perf]').forEach(btn => btn.addEventListener('click', () => openClassPerformance(btn.dataset.perf)));
    content.querySelectorAll('[data-publish]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Publish this exam? Students and parents will be able to see the results.')) return;
      await api(`/exams/${btn.dataset.publish}/publish`, { method: 'POST' }); load();
    }));
    content.querySelectorAll('[data-unpublish]').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/exams/${btn.dataset.unpublish}/unpublish`, { method: 'POST' }); load();
    }));
  };
  content.querySelector('#add-exam-btn').addEventListener('click', () => openExamForm(classes, subjects, load));
  await load();
}

function openExamForm(classes, subjects, onDone) {
  openModal({
    title: 'Create Exam',
    wide: true,
    bodyHtml: `
      <form id="f">
        <div class="form-grid">
          <div class="field"><label>Exam Name *</label><input name="name" required placeholder="e.g. Mid-Term Exam"></div>
          <div class="field"><label>Term</label><input name="term" placeholder="e.g. Term 1"></div>
          <div class="field"><label>Academic Year</label><input name="academicYear" placeholder="2025-2026"></div>
          <div class="field"><label>Class *</label><select name="classId" required><option value="">Select</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
        </div>
        <h4>Subjects &amp; Marks</h4>
        <div id="subject-rows">
          ${subjects.map(s => `<div class="form-grid" style="align-items:end;margin-bottom:6px">
            <div class="checkbox-row"><input type="checkbox" name="subj-${s.id}" id="subj-${s.id}"><label for="subj-${s.id}" style="margin:0">${escapeHtml(s.name)}</label></div>
            <div class="field"><label>Max Marks</label><input type="number" name="max-${s.id}" value="100"></div>
            <div class="field"><label>Pass Marks</label><input type="number" name="pass-${s.id}" value="40"></div>
          </div>`).join('')}
        </div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Create Exam</button></div>
      </form>
    `,
    onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const selectedSubjects = subjects.filter(s => fd.get(`subj-${s.id}`)).map(s => ({
        subjectId: s.id, maxMarks: fd.get(`max-${s.id}`), passMarks: fd.get(`pass-${s.id}`)
      }));
      try {
        await api('/exams', { method: 'POST', body: { name: fd.get('name'), term: fd.get('term'), academicYear: fd.get('academicYear'), classId: fd.get('classId'), subjects: selectedSubjects } });
        toast('Exam created', 'success');
        close();
        onDone();
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}

async function openMarksheet(examId, onDone) {
  const { exam, subjects, students, marks } = await api(`/results/exam/${examId}/marksheet`);
  openModal({
    title: `Marks — ${exam.name}`,
    wide: true,
    bodyHtml: `
      <div class="table-wrap" style="max-height:60vh;overflow-y:auto">
        <table><thead><tr><th>Student</th>${subjects.map(s => `<th>${escapeHtml(s.subject_name)} (/${s.max_marks})</th>`).join('')}</tr></thead>
        <tbody>${students.map(st => `<tr>
          <td>${escapeHtml(st.first_name)} ${escapeHtml(st.last_name || '')}</td>
          ${subjects.map(s => {
            const existing = marks[`${st.id}-${s.exam_subject_id}`];
            return `<td><input type="number" style="width:80px" data-student="${st.id}" data-examsubject="${s.exam_subject_id}" value="${existing && existing.marks_obtained != null ? existing.marks_obtained : ''}"></td>`;
          }).join('')}
        </tr>`).join('') || `<tr class="empty-row"><td colspan="${subjects.length + 1}">No students in this class</td></tr>`}</tbody></table>
      </div>
      <div class="btn-row" style="margin-top:12px;justify-content:flex-end">
        <a class="btn secondary" href="#" id="view-report-cards">Preview Report Cards</a>
        <button class="btn" id="save-marks">Save Marks</button>
      </div>
    `,
    onMount: (body, close) => {
      body.querySelector('#save-marks').addEventListener('click', async () => {
        const inputs = body.querySelectorAll('input[data-student]');
        const entries = Array.from(inputs).map(inp => ({ studentId: inp.dataset.student, examSubjectId: inp.dataset.examsubject, marks: inp.value }));
        await api(`/results/exam/${examId}/marks`, { method: 'POST', body: { entries } });
        toast('Marks saved', 'success');
        onDone();
      });
      body.querySelector('#view-report-cards').addEventListener('click', (e) => {
        e.preventDefault();
        if (students[0]) window.open(apiDownloadUrl(`/results/exam/${examId}/report-card/${students[0].id}/pdf`), '_blank');
      });
    }
  });
}

async function openClassPerformance(examId) {
  const { exam, ranking } = await api(`/results/exam/${examId}/performance`);
  openModal({
    title: `Class Performance — ${exam.name}`,
    wide: true,
    bodyHtml: `
      <div class="table-wrap"><table><thead><tr><th>Rank</th><th>Student</th><th>Total</th><th>Average</th><th>Grade</th><th></th></tr></thead><tbody>
        ${ranking.map(r => `<tr><td>${r.rank}</td><td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name || '')}</td><td>${r.total}</td><td>${r.average == null ? '-' : r.average + '%'}</td><td>${r.grade || '-'}</td>
          <td><a class="btn secondary sm" href="${apiDownloadUrl(`/results/exam/${examId}/report-card/${r.id}/pdf`)}" target="_blank">Report Card</a></td></tr>`).join('') || `<tr class="empty-row"><td colspan="6">No results yet</td></tr>`}
      </tbody></table></div>
    `
  });
}
