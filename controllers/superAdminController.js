const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { uploadFile } = require('../utils/storage');

// ---- Platform statistics -------------------------------------------------
async function stats(req, res) {
  const [[schoolCounts]] = await db.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'active') AS active,
            COUNT(*) FILTER (WHERE status = 'suspended') AS suspended
     FROM schools`
  );
  const [[studentCount]] = await db.query(`SELECT COUNT(*) AS total FROM students WHERE status = 'active'`);
  const [[teacherCount]] = await db.query(
    `SELECT COUNT(*) AS total FROM teachers WHERE status = 'active'`
  );
  const [recentSchools] = await db.query(
    `SELECT id, name, code, status, package, created_at FROM schools ORDER BY created_at DESC LIMIT 5`
  );

  res.json({
    totalSchools: schoolCounts.total || 0,
    activeSchools: schoolCounts.active || 0,
    suspendedSchools: schoolCounts.suspended || 0,
    totalStudents: studentCount.total || 0,
    totalTeachers: teacherCount.total || 0,
    recentSchools
  });
}

// ---- Schools --------------------------------------------------------------
async function listSchools(req, res) {
  const [rows] = await db.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) AS student_count,
            (SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id) AS teacher_count,
            (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = 'school_admin') AS admin_count
     FROM schools s
     ORDER BY s.created_at DESC`
  );
  res.json({ schools: rows });
}

async function getSchool(req, res) {
  const [rows] = await db.query('SELECT * FROM schools WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'School not found' });
  const [admins] = await db.query(
    `SELECT id, name, username, email, status, created_at FROM users WHERE school_id = ? AND role = 'school_admin'`,
    [req.params.id]
  );
  res.json({ school: rows[0], admins });
}

async function createSchool(req, res) {
  const {
    name, code, address, city, phone, email,
    adminName, adminEmail, adminUsername, adminPassword,
    status, package: pkg, websiteEnabled, startDate, notes
  } = req.body;

  if (!name || !code || !adminName || !adminUsername || !adminPassword) {
    return res.status(400).json({ error: 'School name, code, admin name, admin username and initial password are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existingCode] = await conn.query('SELECT id FROM schools WHERE code = ?', [code]);
    if (existingCode.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'A school with this code already exists' });
    }

    const logoPath = req.file ? await uploadFile(req.file.buffer, 'logos', req.file.originalname, req.file.mimetype) : null;

    const [schoolResult] = await conn.query(
      `INSERT INTO schools (name, code, logo, address, city, phone, email, status, package, website_enabled, start_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, code, logoPath, address || null, city || null, phone || null, email || null,
        status === 'suspended' ? 'suspended' : 'active',
        ['basic', 'standard', 'premium'].includes(pkg) ? pkg : 'basic',
        websiteEnabled ? true : false,
        startDate || null,
        notes || null
      ]
    );
    const schoolId = schoolResult.insertId;

    const [existingUsername] = await conn.query(
      'SELECT id FROM users WHERE school_id = ? AND username = ?',
      [schoolId, adminUsername]
    );
    if (existingUsername.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'That admin username is already taken for this school' });
    }

    const passwordHash = await hashPassword(adminPassword);
    const [adminResult] = await conn.query(
      `INSERT INTO users (school_id, role, name, username, email, password_hash, status, must_change_password)
       VALUES (?, 'school_admin', ?, ?, ?, ?, 'active', true)`,
      [schoolId, adminName, adminUsername, adminEmail || null, passwordHash]
    );

    await conn.commit();

    res.status(201).json({
      school: { id: schoolId, name, code },
      admin: {
        id: adminResult.insertId,
        name: adminName,
        username: adminUsername,
        // Shown once at creation time only — never retrievable again.
        initialPassword: adminPassword
      }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateSchool(req, res) {
  const { id } = req.params;
  const {
    name, address, city, phone, email, package: pkg,
    websiteEnabled, startDate, notes, brandColor, currency, academicYear, reportCardHeader
  } = req.body;

  const [rows] = await db.query('SELECT * FROM schools WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'School not found' });

  const logoPath = req.file ? await uploadFile(req.file.buffer, 'logos', req.file.originalname, req.file.mimetype) : rows[0].logo;

  await db.query(
    `UPDATE schools SET name = ?, logo = ?, address = ?, city = ?, phone = ?, email = ?,
       package = ?, website_enabled = ?, start_date = ?, notes = ?, brand_color = ?,
       currency = ?, academic_year = ?, report_card_header = ?
     WHERE id = ?`,
    [
      name || rows[0].name, logoPath, address ?? rows[0].address, city ?? rows[0].city,
      phone ?? rows[0].phone, email ?? rows[0].email,
      ['basic', 'standard', 'premium'].includes(pkg) ? pkg : rows[0].package,
      websiteEnabled === undefined ? rows[0].website_enabled : (websiteEnabled ? true : false),
      startDate ?? rows[0].start_date, notes ?? rows[0].notes,
      brandColor ?? rows[0].brand_color, currency ?? rows[0].currency,
      academicYear ?? rows[0].academic_year, reportCardHeader ?? rows[0].report_card_header,
      id
    ]
  );

  res.json({ ok: true });
}

function setSchoolStatus(status) {
  return async (req, res) => {
    const [rows] = await db.query('SELECT id FROM schools WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    await db.query('UPDATE schools SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true, status });
  };
}

// ---- School admin account management --------------------------------------
async function createSchoolAdmin(req, res) {
  const { schoolId } = req.params;
  const { name, username, email, password } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Name, username and password are required' });
  }
  const [school] = await db.query('SELECT id FROM schools WHERE id = ?', [schoolId]);
  if (!school[0]) return res.status(404).json({ error: 'School not found' });

  const [existing] = await db.query('SELECT id FROM users WHERE school_id = ? AND username = ?', [schoolId, username]);
  if (existing.length) return res.status(409).json({ error: 'That username is already taken for this school' });

  const passwordHash = await hashPassword(password);
  const [result] = await db.query(
    `INSERT INTO users (school_id, role, name, username, email, password_hash, status, must_change_password)
     VALUES (?, 'school_admin', ?, ?, ?, ?, 'active', true)`,
    [schoolId, name, username, email || null, passwordHash]
  );
  res.status(201).json({ admin: { id: result.insertId, name, username, initialPassword: password } });
}

async function setAdminStatus(req, res) {
  const { schoolId, adminId } = req.params;
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status must be active or inactive' });
  }
  const [rows] = await db.query(
    `UPDATE users SET status = ? WHERE id = ? AND school_id = ? AND role = 'school_admin'`,
    [status, adminId, schoolId]
  );
  if (!rows.affectedRows) return res.status(404).json({ error: 'Admin not found for this school' });
  res.json({ ok: true });
}

module.exports = {
  stats,
  listSchools,
  getSchool,
  createSchool,
  updateSchool,
  activateSchool: setSchoolStatus('active'),
  suspendSchool: setSchoolStatus('suspended'),
  createSchoolAdmin,
  setAdminStatus
};
