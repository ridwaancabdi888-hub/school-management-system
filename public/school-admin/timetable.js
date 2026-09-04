const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

async function renderTimetable(content) {
  const [classes, subjects, teachersData] = await Promise.all([fetchClasses(), fetchSubjects(), api('/teachers')]);
  const teachers = teachersData.teachers;
  content.innerHTML = `
    <div class="section-header"><h2>Timetable</h2><button class="btn" id="add-slot-btn">+ Add Slot</button></div>
    <div class="toolbar">
      <select id="tt-class"><option value="">Select Class</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="tt-section"><option value="">All Sections</option></select>
    </div>
    <div id="tt-table"></div>
  `;
  const load = async () => {
    const classId = content.querySelector('#tt-class').value;
    const sectionId = content.querySelector('#tt-section').value;
    if (!classId) { content.querySelector('#tt-table').innerHTML = '<p class="text-muted">Select a class to view its timetable.</p>'; return; }
    const { timetable } = await api(`/timetable?classId=${classId}${sectionId ? '&sectionId=' + sectionId : ''}`);
    content.querySelector('#tt-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th></th></tr></thead><tbody>
        ${timetable.map(t => `<tr>
          <td>${t.day}</td><td>${t.start_time.slice(0,5)} - ${t.end_time.slice(0,5)}</td>
          <td>${escapeHtml(t.subject_name || '-')}</td><td>${escapeHtml(t.teacher_name || '-')}</td>
          <td><button class="btn danger sm" data-del="${t.id}">Delete</button></td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="5">No timetable slots yet</td></tr>`}
      </tbody></table></div>
    `;
    content.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Delete this slot?')) return;
      await api(`/timetable/${btn.dataset.del}`, { method: 'DELETE' }); load();
    }));
  };
  content.querySelector('#tt-class').addEventListener('change', async (e) => {
    const sections = await fetchSections(e.target.value || undefined);
    content.querySelector('#tt-section').innerHTML = sectionOptionsHtml(sections);
    load();
  });
  content.querySelector('#tt-section').addEventListener('change', load);
  content.querySelector('#add-slot-btn').addEventListener('click', () => openSlotForm(classes, subjects, teachers, load));
}

function openSlotForm(classes, subjects, teachers, onDone) {
  openModal({
    title: 'Add Timetable Slot',
    bodyHtml: `
      <form id="f">
        <div class="form-grid">
          <div class="field"><label>Class *</label><select name="classId" id="slot-class" required><option value="">Select</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Section</label><select name="sectionId" id="slot-section"><option value="">All</option></select></div>
          <div class="field"><label>Day *</label><select name="day" required>${DAYS.map(d => `<option value="${d}">${d}</option>`).join('')}</select></div>
          <div class="field"><label>Start Time *</label><input type="time" name="startTime" required></div>
          <div class="field"><label>End Time *</label><input type="time" name="endTime" required></div>
          <div class="field"><label>Subject</label><select name="subjectId"><option value="">-</option>${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Teacher</label><select name="teacherId"><option value="">-</option>${teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select></div>
        </div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save</button></div>
      </form>
    `,
    onMount: (body, close) => {
      body.querySelector('#slot-class').addEventListener('change', async (e) => {
        const sections = await fetchSections(e.target.value || undefined);
        body.querySelector('#slot-section').innerHTML = `<option value="">All</option>` + sections.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      });
      body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        try {
          await api('/timetable', { method: 'POST', body: payload });
          toast('Slot added', 'success');
          close();
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}
