const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { uploadFile } = require('../utils/storage');

async function listTeachers(req, res) {
  const { search, status } = req.query;
  const where = ['t.school_id = ?'];
  const params = [req.schoolId];
  if (search) { where.push('u.name LIKE ?'); params.push(`%${search}%`); }
  if (status) { where.push('t.status = ?'); params.push(status); }

  const [rows] = await db.query(
    `SELECT t.id, t.joining_date, t.status, u.id AS user_id, u.name, u.username, u.email, u.phone, u.photo
     FROM teachers t JOIN users u ON u.id = t.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY u.name`,
    params
  );
  res.json({ teachers: rows });
}

async function createTeacher(req, res) {
  const { name, username, password, email, phone, joiningDate } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Name, username and password are required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query('SELECT id FROM users WHERE school_id = ? AND username = ?', [req.schoolId, username]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'That username is already taken' });
    }
    const photoPath = req.file ? await uploadFile(req.file.buffer, 'photos', req.file.originalname, req.file.mimetype) : null;
    const hash = await hashPassword(password);
    const [userResult] = await conn.query(
      `INSERT INTO users (school_id, role, name, username, email, phone, photo, password_hash, status, must_change_password)
       VALUES (?, 'teacher', ?, ?, ?, ?, ?, ?, 'active', true)`,
      [req.schoolId, name, username, email || null, phone || null, photoPath, hash]
    );
    const [teacherResult] = await conn.query(
      `INSERT INTO teachers (school_id, user_id, joining_date, status) VALUES (?, ?, ?, 'active')`,
      [req.schoolId, userResult.insertId, joiningDate || null]
    );
    await conn.commit();
    res.status(201).json({ id: teacherResult.insertId, userId: userResult.insertId, initialPassword: password });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateTeacher(req, res) {
  const { name, email, phone, joiningDate } = req.body;
  const [rows] = await db.query('SELECT * FROM teachers WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Teacher not found' });
  const teacher = rows[0];

  const photoPath = req.file ? await uploadFile(req.file.buffer, 'photos', req.file.originalname, req.file.mimetype) : undefined;

  await db.query(
    `UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone)${photoPath ? ', photo = ?' : ''}
     WHERE id = ? AND school_id = ?`,
    photoPath
      ? [name, email, phone, photoPath, teacher.user_id, req.schoolId]
      : [name, email, phone, teacher.user_id, req.schoolId]
  );
  await db.query('UPDATE teachers SET joining_date = COALESCE(?, joining_date) WHERE id = ? AND school_id = ?', [joiningDate || null, req.params.id, req.schoolId]);
  res.json({ ok: true });
}

async function setTeacherStatus(req, res) {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'status must be active or inactive' });
  const [rows] = await db.query('SELECT user_id FROM teachers WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Teacher not found' });
  await db.query('UPDATE teachers SET status = ? WHERE id = ?', [status, req.params.id]);
  await db.query('UPDATE users SET status = ? WHERE id = ?', [status, rows[0].user_id]);
  res.json({ ok: true });
}

// A teacher's own assigned classes/sections (via class_subjects + section class_teacher_id)
async function myClasses(req, res) {
  const [teacherRow] = await db.query('SELECT id FROM teachers WHERE user_id = ? AND school_id = ?', [req.user.id, req.schoolId]);
  if (!teacherRow[0]) return res.json({ classTeacherOf: [], subjectAssignments: [] });
  const teacherId = teacherRow[0].id;

  const [classTeacherOf] = await db.query(
    `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.name AS class_name
     FROM sections s JOIN classes c ON c.id = s.class_id
     WHERE s.class_teacher_id = ? AND s.school_id = ?`,
    [teacherId, req.schoolId]
  );

  const [subjectAssignments] = await db.query(
    `SELECT cs.id, c.id AS class_id, c.name AS class_name, sub.id AS subject_id, sub.name AS subject_name
     FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects sub ON sub.id = cs.subject_id
     WHERE cs.teacher_id = ? AND cs.school_id = ?`,
    [teacherId, req.schoolId]
  );

  res.json({ classTeacherOf, subjectAssignments });
}

module.exports = { listTeachers, createTeacher, updateTeacher, setTeacherStatus, myClasses };
