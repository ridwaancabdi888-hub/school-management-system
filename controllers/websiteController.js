const db = require('../config/db');
const { uploadFile } = require('../utils/storage');

// ---- PUBLIC (no auth) — looked up by school code, never by numeric id -------
async function getPublicSite(req, res) {
  const [schoolRows] = await db.query(
    `SELECT id, name, code, logo, address, city, phone, email, brand_color, website_enabled
     FROM schools WHERE code = ? AND status = 'active'`,
    [req.params.schoolCode]
  );
  const school = schoolRows[0];
  if (!school || !school.website_enabled) {
    return res.status(404).json({ error: 'This school does not have a public website' });
  }

  const [[content]] = await db.query('SELECT * FROM website_content WHERE school_id = ?', [school.id]);
  const [news] = await db.query('SELECT id, title, body, published_at FROM website_news WHERE school_id = ? ORDER BY published_at DESC LIMIT 10', [school.id]);
  const [gallery] = await db.query('SELECT id, image_path, caption FROM website_gallery WHERE school_id = ? ORDER BY created_at DESC LIMIT 24', [school.id]);

  res.json({ school, content: content || {}, news, gallery });
}

async function submitApplication(req, res) {
  const [schoolRows] = await db.query(`SELECT id FROM schools WHERE code = ? AND status = 'active'`, [req.params.schoolCode]);
  const school = schoolRows[0];
  if (!school) return res.status(404).json({ error: 'School not found' });

  const { studentName, dob, gender, applyingClass, parentName, phone, email, address } = req.body;
  if (!studentName || !parentName || !phone) {
    return res.status(400).json({ error: 'studentName, parentName and phone are required' });
  }

  await db.query(
    `INSERT INTO admission_applications (school_id, student_name, dob, gender, applying_class, parent_name, phone, email, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [school.id, studentName, dob || null, gender || null, applyingClass || null, parentName, phone, email || null, address || null]
  );
  res.status(201).json({ ok: true, message: 'Application submitted successfully' });
}

// ---- ADMIN (authenticated, tenant-scoped) ------------------------------------
async function getContent(req, res) {
  const [rows] = await db.query('SELECT * FROM website_content WHERE school_id = ?', [req.schoolId]);
  res.json({ content: rows[0] || {} });
}

async function updateContent(req, res) {
  const { heroTitle, heroText, aboutText, academicsText, admissionsText, contactEmail, contactPhone, contactAddress } = req.body;
  await db.query(
    `INSERT INTO website_content (school_id, hero_title, hero_text, about_text, academics_text, admissions_text, contact_email, contact_phone, contact_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (school_id) DO UPDATE SET hero_title = EXCLUDED.hero_title, hero_text = EXCLUDED.hero_text, about_text = EXCLUDED.about_text,
       academics_text = EXCLUDED.academics_text, admissions_text = EXCLUDED.admissions_text,
       contact_email = EXCLUDED.contact_email, contact_phone = EXCLUDED.contact_phone, contact_address = EXCLUDED.contact_address`,
    [req.schoolId, heroTitle || null, heroText || null, aboutText || null, academicsText || null, admissionsText || null, contactEmail || null, contactPhone || null, contactAddress || null]
  );
  res.json({ ok: true });
}

async function listNews(req, res) {
  const [rows] = await db.query('SELECT * FROM website_news WHERE school_id = ? ORDER BY published_at DESC', [req.schoolId]);
  res.json({ news: rows });
}

async function createNews(req, res) {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const [result] = await db.query('INSERT INTO website_news (school_id, title, body) VALUES (?, ?, ?)', [req.schoolId, title, body]);
  res.status(201).json({ id: result.insertId });
}

async function deleteNews(req, res) {
  const [result] = await db.query('DELETE FROM website_news WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'News item not found' });
  res.json({ ok: true });
}

async function addGalleryImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'An image file is required' });
  const imageUrl = await uploadFile(req.file.buffer, 'gallery', req.file.originalname, req.file.mimetype);
  const [result] = await db.query(
    'INSERT INTO website_gallery (school_id, image_path, caption) VALUES (?, ?, ?)',
    [req.schoolId, imageUrl, req.body.caption || null]
  );
  res.status(201).json({ id: result.insertId });
}

async function deleteGalleryImage(req, res) {
  const [result] = await db.query('DELETE FROM website_gallery WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Image not found' });
  res.json({ ok: true });
}

async function listApplications(req, res) {
  const [rows] = await db.query('SELECT * FROM admission_applications WHERE school_id = ? ORDER BY submitted_at DESC', [req.schoolId]);
  res.json({ applications: rows });
}

async function setApplicationStatus(req, res) {
  const { status } = req.body;
  if (!['new', 'reviewed', 'accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const [result] = await db.query('UPDATE admission_applications SET status = ? WHERE id = ? AND school_id = ?', [status, req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Application not found' });
  res.json({ ok: true });
}

module.exports = {
  getPublicSite, submitApplication,
  getContent, updateContent,
  listNews, createNews, deleteNews,
  addGalleryImage, deleteGalleryImage,
  listApplications, setApplicationStatus
};
