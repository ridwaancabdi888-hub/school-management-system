const db = require('../config/db');
const { hashPassword } = require('../utils/password');

async function listStaff(req, res) {
  const { search, designation } = req.query;
  const where = ['st.school_id = ?'];
  const params = [req.schoolId];
  if (search) { where.push('u.name LIKE ?'); params.push(`%${search}%`); }
  if (designation) { where.push('st.designation = ?'); params.push(designation); }

  const [rows] = await db.query(
    `SELECT st.id, st.designation, st.joining_date, st.status,
            u.id AS user_id, u.name, u.username, u.email, u.phone, u.photo
     FROM staff st JOIN users u ON u.id = st.user_id
     WHERE ${where.join(' AND ')} ORDER BY u.name`,
    params
  );
  res.json({ staff: rows });
}

async function createStaff(req, res) {
  const { name, username, password, email, phone, designation, joiningDate, role } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Name, username and password are required' });

  // "Accountant" is a first-class platform role (fee/payment access); other
  // designations (reception, security, cleaner, driver, other) are plain "staff".
  const userRole = designation === 'accountant' ? 'accountant' : 'staff';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query('SELECT id FROM users WHERE school_id = ? AND username = ?', [req.schoolId, username]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'That username is already taken' });
    }
    const hash = await hashPassword(password);
    const [userResult] = await conn.query(
      `INSERT INTO users (school_id, role, name, username, email, phone, password_hash, status, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', true)`,
      [req.schoolId, userRole, name, username, email || null, phone || null, hash]
    );
    const [staffResult] = await conn.query(
      `INSERT INTO staff (school_id, user_id, designation, joining_date, status) VALUES (?, ?, ?, ?, 'active')`,
      [req.schoolId, userResult.insertId, designation || 'other', joiningDate || null]
    );
    await conn.commit();
    res.status(201).json({ id: staffResult.insertId, userId: userResult.insertId, initialPassword: password });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateStaff(req, res) {
  const { name, email, phone, designation, joiningDate } = req.body;
  const [rows] = await db.query('SELECT * FROM staff WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Staff record not found' });

  await db.query(
    'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone) WHERE id = ?',
    [name, email, phone, rows[0].user_id]
  );
  await db.query(
    'UPDATE staff SET designation = COALESCE(?, designation), joining_date = COALESCE(?, joining_date) WHERE id = ?',
    [designation, joiningDate || null, req.params.id]
  );
  res.json({ ok: true });
}

async function setStaffStatus(req, res) {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'status must be active or inactive' });
  const [rows] = await db.query('SELECT user_id FROM staff WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Staff record not found' });
  await db.query('UPDATE staff SET status = ? WHERE id = ?', [status, req.params.id]);
  await db.query('UPDATE users SET status = ? WHERE id = ?', [status, rows[0].user_id]);
  res.json({ ok: true });
}

module.exports = { listStaff, createStaff, updateStaff, setStaffStatus };
