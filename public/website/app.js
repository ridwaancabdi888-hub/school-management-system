async function initWebsite() {
  const app = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);
  const schoolCode = params.get('school');
  if (!schoolCode) {
    app.innerHTML = `<div class="loading">No school specified. Use ?school=CODE in the URL.</div>`;
    return;
  }

  let data;
  try {
    data = await api(`/website/public/${encodeURIComponent(schoolCode)}`);
  } catch (err) {
    app.innerHTML = `<div class="loading">${escapeHtml(err.message)}</div>`;
    return;
  }

  const { school, content, news, gallery } = data;
  document.title = school.name;

  app.innerHTML = `
    <nav class="site-nav">
      <div class="container">
        <strong>${escapeHtml(school.name)}</strong>
        <div class="links">
          <a href="#home">Home</a><a href="#about">About</a><a href="#academics">Academics</a>
          <a href="#admissions">Admissions</a><a href="#news">News</a><a href="#gallery">Gallery</a><a href="#contact">Contact</a>
        </div>
        <a class="btn sm" href="/login/">Login</a>
      </div>
    </nav>

    <header class="hero" id="home" style="background:${school.brand_color || '#2563eb'}">
      <div class="container">
        <h1>${escapeHtml(content.hero_title || school.name)}</h1>
        <p>${escapeHtml(content.hero_text || '')}</p>
        <a class="btn" style="background:#fff;color:${school.brand_color || '#2563eb'}" href="#admissions">Apply for Admission</a>
      </div>
    </header>

    <section id="about"><div class="container"><h2>About Us</h2><p>${escapeHtml(content.about_text || 'Information coming soon.')}</p></div></section>
    <section id="academics"><div class="container"><h2>Academics</h2><p>${escapeHtml(content.academics_text || 'Information coming soon.')}</p></div></section>

    <section id="admissions"><div class="container">
      <h2>Admissions</h2>
      <p>${escapeHtml(content.admissions_text || 'We welcome applications year-round.')}</p>
      <div id="apply-status"></div>
      <form id="apply-form" class="form-grid" style="max-width:560px;margin-top:16px">
        <div class="field"><label>Student Name *</label><input name="studentName" required></div>
        <div class="field"><label>Date of Birth</label><input type="date" name="dob"></div>
        <div class="field"><label>Gender</label><select name="gender"><option value="">-</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
        <div class="field"><label>Applying for Class</label><input name="applyingClass" placeholder="e.g. Grade 1"></div>
        <div class="field"><label>Parent/Guardian Name *</label><input name="parentName" required></div>
        <div class="field"><label>Phone *</label><input name="phone" required></div>
        <div class="field"><label>Email</label><input name="email" type="email"></div>
        <div class="field"><label>Address</label><input name="address"></div>
        <div class="field" style="align-self:end"><button class="btn" type="submit">Submit Application</button></div>
      </form>
    </div></section>

    <section id="news"><div class="container">
      <h2>News &amp; Announcements</h2>
      ${news.map(n => `<div class="card" style="margin-bottom:12px"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.body)}</p><p class="text-muted">${fmtDate(n.published_at)}</p></div>`).join('') || '<p class="text-muted">No news posted yet.</p>'}
    </div></section>

    <section id="gallery"><div class="container">
      <h2>Gallery</h2>
      <div class="gallery-grid">${gallery.map(g => `<img src="${g.image_path}" alt="${escapeHtml(g.caption || '')}">`).join('') || '<p class="text-muted">No photos yet.</p>'}</div>
    </div></section>

    <section id="contact" style="border-bottom:none"><div class="container">
      <h2>Contact</h2>
      <p>${escapeHtml(school.address || '')} ${escapeHtml(school.city || '')}</p>
      <p>${escapeHtml(content.contact_phone || school.phone || '')} &middot; ${escapeHtml(content.contact_email || school.email || '')}</p>
    </div></section>

    <footer>&copy; ${new Date().getFullYear()} ${escapeHtml(school.name)}. Powered by the School Management System.</footer>
  `;

  document.getElementById('apply-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/website/public/${encodeURIComponent(schoolCode)}/apply`, { method: 'POST', body: payload });
      document.getElementById('apply-status').innerHTML = `<p class="text-success">Application submitted successfully. The school will contact you soon.</p>`;
      e.target.reset();
    } catch (err) {
      document.getElementById('apply-status').innerHTML = `<p class="text-danger">${escapeHtml(err.message)}</p>`;
    }
  });
}

initWebsite();
