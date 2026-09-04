async function renderWebsiteAdmin(content) {
  const [{ content: siteContent }, { news }, { applications }] = await Promise.all([
    api('/website/admin/content'), api('/website/admin/news'), api('/website/admin/applications')
  ]);
  content.innerHTML = `
    <div class="section-header"><h2>Public Website</h2>
      <a class="btn secondary sm" href="/website/?school=${encodeURIComponent(SCHOOL.school.code)}" target="_blank">View Live Site</a>
    </div>
    <div class="pill-tabs">
      <button class="active" data-tab="content">Page Content</button>
      <button data-tab="news">News</button>
      <button data-tab="applications">Admission Applications</button>
    </div>
    <div id="panel-content"></div>
    <div id="panel-news" class="hidden"></div>
    <div id="panel-applications" class="hidden"></div>
  `;
  content.querySelectorAll('.pill-tabs button').forEach(btn => btn.addEventListener('click', () => {
    content.querySelectorAll('.pill-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['content', 'news', 'applications'].forEach(t => content.querySelector(`#panel-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
  }));

  content.querySelector('#panel-content').innerHTML = `
    <form id="content-form" class="card" style="max-width:640px">
      <div class="field"><label>Hero Title</label><input name="heroTitle" value="${escapeHtml(siteContent.hero_title || '')}"></div>
      <div class="field"><label>Hero Text</label><textarea name="heroText" rows="2">${escapeHtml(siteContent.hero_text || '')}</textarea></div>
      <div class="field"><label>About</label><textarea name="aboutText" rows="3">${escapeHtml(siteContent.about_text || '')}</textarea></div>
      <div class="field"><label>Academics</label><textarea name="academicsText" rows="3">${escapeHtml(siteContent.academics_text || '')}</textarea></div>
      <div class="field"><label>Admissions</label><textarea name="admissionsText" rows="3">${escapeHtml(siteContent.admissions_text || '')}</textarea></div>
      <div class="form-grid">
        <div class="field"><label>Contact Email</label><input name="contactEmail" value="${escapeHtml(siteContent.contact_email || '')}"></div>
        <div class="field"><label>Contact Phone</label><input name="contactPhone" value="${escapeHtml(siteContent.contact_phone || '')}"></div>
      </div>
      <div class="field"><label>Contact Address</label><input name="contactAddress" value="${escapeHtml(siteContent.contact_address || '')}"></div>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save Content</button></div>
    </form>
  `;
  content.querySelector('#content-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    await api('/website/admin/content', { method: 'PUT', body: payload });
    toast('Website content saved', 'success');
  });

  const renderNews = () => {
    content.querySelector('#panel-news').innerHTML = `
      <div class="section-header"><h3>News Posts</h3><button class="btn sm" id="add-news-btn">+ Add News</button></div>
      <div class="table-wrap"><table><thead><tr><th>Title</th><th>Published</th><th></th></tr></thead><tbody>
        ${news.map(n => `<tr><td>${escapeHtml(n.title)}</td><td>${fmtDate(n.published_at)}</td><td><button class="btn danger sm" data-del-news="${n.id}">Delete</button></td></tr>`).join('') || `<tr class="empty-row"><td colspan="3">No news posts yet</td></tr>`}
      </tbody></table></div>
    `;
    content.querySelector('#add-news-btn').addEventListener('click', () => {
      openModal({
        title: 'Add News Post',
        bodyHtml: `<form id="f"><div class="field"><label>Title *</label><input name="title" required></div>
          <div class="field"><label>Body *</label><textarea name="body" rows="4" required></textarea></div>
          <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Publish</button></div></form>`,
        onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const payload = Object.fromEntries(new FormData(e.target).entries());
          await api('/website/admin/news', { method: 'POST', body: payload });
          toast('News published', 'success');
          close();
          renderWebsiteAdmin(content);
        })
      });
    });
    content.querySelectorAll('[data-del-news]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Delete this news post?')) return;
      await api(`/website/admin/news/${btn.dataset.delNews}`, { method: 'DELETE' });
      renderWebsiteAdmin(content);
    }));
  };
  renderNews();

  content.querySelector('#panel-applications').innerHTML = `
    <div class="table-wrap"><table><thead><tr><th>Applicant</th><th>Class</th><th>Parent</th><th>Phone</th><th>Status</th><th></th></tr></thead><tbody>
      ${applications.map(a => `<tr>
        <td>${escapeHtml(a.student_name)}</td><td>${escapeHtml(a.applying_class || '-')}</td><td>${escapeHtml(a.parent_name || '-')}</td><td>${escapeHtml(a.phone || '-')}</td>
        <td>${badge(a.status)}</td>
        <td><select data-app="${a.id}">
          ${['new', 'reviewed', 'accepted', 'rejected'].map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></td>
      </tr>`).join('') || `<tr class="empty-row"><td colspan="6">No applications submitted yet</td></tr>`}
    </tbody></table></div>
  `;
  content.querySelectorAll('[data-app]').forEach(sel => sel.addEventListener('change', async () => {
    await api(`/website/admin/applications/${sel.dataset.app}/status`, { method: 'PUT', body: { status: sel.value } });
    toast('Application status updated', 'success');
  }));
}
