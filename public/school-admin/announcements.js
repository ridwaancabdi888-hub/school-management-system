async function renderAnnouncements(content) {
  const classes = await fetchClasses();
  content.innerHTML = `
    <div class="section-header"><h2>Announcements</h2><button class="btn" id="add-ann-btn">+ New Announcement</button></div>
    <div id="ann-table"></div>
  `;
  const load = async () => {
    const { announcements } = await api('/announcements');
    content.querySelector('#ann-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Title</th><th>Audience</th><th>Date</th><th></th></tr></thead><tbody>
        ${announcements.map(a => `<tr>
          <td><strong>${escapeHtml(a.title)}</strong><br><span class="text-muted">${escapeHtml(a.body.slice(0, 80))}${a.body.length > 80 ? '...' : ''}</span></td>
          <td>${badge(a.target, 'info')} ${a.class_name ? escapeHtml(a.class_name) : ''} ${a.section_name ? escapeHtml(a.section_name) : ''}</td>
          <td>${fmtDate(a.created_at)}</td>
          <td><button class="btn danger sm" data-del="${a.id}">Delete</button></td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="4">No announcements yet</td></tr>`}
      </tbody></table></div>
    `;
    content.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Delete this announcement?')) return;
      await api(`/announcements/${btn.dataset.del}`, { method: 'DELETE' }); load();
    }));
  };
  content.querySelector('#add-ann-btn').addEventListener('click', () => openAnnouncementForm(classes, load));
  await load();
}

function openAnnouncementForm(classes, onDone) {
  openModal({
    title: 'New Announcement',
    bodyHtml: `
      <form id="f">
        <div class="field"><label>Title *</label><input name="title" required></div>
        <div class="field"><label>Message *</label><textarea name="body" rows="4" required></textarea></div>
        <div class="form-grid">
          <div class="field"><label>Audience</label>
            <select name="target" id="ann-target">
              <option value="everyone">Everyone</option><option value="teachers">Teachers</option>
              <option value="students">Students</option><option value="parents">Parents</option>
              <option value="class">Specific Class</option><option value="section">Specific Section</option>
            </select>
          </div>
          <div class="field hidden" id="ann-class-field"><label>Class</label><select name="classId" id="ann-class">${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
          <div class="field hidden" id="ann-section-field"><label>Section</label><select name="sectionId" id="ann-section"></select></div>
        </div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Publish</button></div>
      </form>
    `,
    onMount: (body, close) => {
      const targetSel = body.querySelector('#ann-target');
      const classField = body.querySelector('#ann-class-field');
      const sectionField = body.querySelector('#ann-section-field');
      const refreshVisibility = () => {
        classField.classList.toggle('hidden', !['class', 'section'].includes(targetSel.value));
        sectionField.classList.toggle('hidden', targetSel.value !== 'section');
      };
      targetSel.addEventListener('change', refreshVisibility);
      body.querySelector('#ann-class').addEventListener('change', async (e) => {
        const sections = await fetchSections(e.target.value);
        body.querySelector('#ann-section').innerHTML = sections.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      });
      refreshVisibility();

      body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        await api('/announcements', { method: 'POST', body: payload });
        toast('Announcement published', 'success');
        close();
        onDone();
      });
    }
  });
}
