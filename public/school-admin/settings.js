async function renderSettings(content) {
  const { school } = await api('/school');
  content.innerHTML = `
    <h2>School Settings</h2>
    <div class="card" style="max-width:640px">
      <form id="f" enctype="multipart/form-data">
        <div class="form-grid">
          <div class="field"><label>School Name</label><input name="name" value="${escapeHtml(school.name)}"></div>
          <div class="field"><label>Logo</label><input type="file" name="logo" accept="image/*"></div>
          <div class="field"><label>Address</label><input name="address" value="${escapeHtml(school.address || '')}"></div>
          <div class="field"><label>City</label><input name="city" value="${escapeHtml(school.city || '')}"></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(school.phone || '')}"></div>
          <div class="field"><label>Email</label><input name="email" value="${escapeHtml(school.email || '')}"></div>
          <div class="field"><label>Currency</label><input name="currency" value="${escapeHtml(school.currency || 'USD')}"></div>
          <div class="field"><label>Academic Year</label><input name="academicYear" value="${escapeHtml(school.academic_year || '')}"></div>
        </div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save Settings</button></div>
      </form>
    </div>
    <p class="text-muted" style="margin-top:14px">Package: ${escapeHtml(school.package)} &middot; Status: ${badge(school.status)}<br>
    Package is managed by the Platform Super Admin.</p>
  `;
  content.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/school', { method: 'PUT', body: fd, isForm: true });
      toast('Settings saved', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}
