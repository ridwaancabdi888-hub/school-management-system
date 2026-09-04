const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { uploadFile } = require('../utils/storage');

// A school admin may view/edit their OWN school only — scoped by req.schoolId,
// never by an id supplied in the request.
async function getMySchool(req, res) {
  const [rows] = await db.query('SELECT * FROM schools WHERE id = ?', [req.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'School not found' });
  res.json({ school: rows[0] });
}

async function updateMySchool(req, res) {
  const { name, address, city, phone, email, brandColor, currency, academicYear, reportCardHeader } = req.body;
  const [rows] = await db.query('SELECT * FROM schools WHERE id = ?', [req.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'School not found' });
  const cur = rows[0];
  const logoPath = req.file ? await uploadFile(req.file.buffer, 'logos', req.file.originalname, req.file.mimetype) : cur.logo;

  await db.query(
    `UPDATE schools SET name = ?, logo = ?, address = ?, city = ?, phone = ?, email = ?,
       brand_color = ?, currency = ?, academic_year = ?, report_card_header = ? WHERE id = ?`,
    [
      name ?? cur.name, logoPath, address ?? cur.address, city ?? cur.city, phone ?? cur.phone, email ?? cur.email,
      brandColor ?? cur.brand_color, currency ?? cur.currency, academicYear ?? cur.academic_year,
      reportCardHeader ?? cur.report_card_header, req.schoolId
    ]
  );
  res.json({ ok: true });
}

// ---- Accounts (all users belonging to this school) -------------------------
async function listAccounts(req, res) {
  const { role } = req.query;
  const where = ['school_id = ?'];
  const params = [req.schoolId];
  if (role) { where.push('role = ?'); params.push(role); }
  const [rows] = await db.query(
    `SELECT id, role, name, username, email, phone, status, must_change_password, created_at
     FROM users WHERE ${where.join(' AND ')} ORDER BY role, name`,
    params
  );
  res.json({ accounts: rows });
}

async function resetAccountPassword(req, res) {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
  const [rows] = await db.query('SELECT id FROM users WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
  const hash = await hashPassword(newPassword);
  await db.query('UPDATE users SET password_hash = ?, must_change_password = true WHERE id = ?', [hash, req.params.id]);
  res.json({ ok: true });
}

async function setAccountStatus(req, res) {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'status must be active or inactive' });
  const [result] = await db.query('UPDATE users SET status = ? WHERE id = ? AND school_id = ?', [status, req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Account not found' });
  res.json({ ok: true });
}

module.exports = { getMySchool, updateMySchool, listAccounts, resetAccountPassword, setAccountStatus };
