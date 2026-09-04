const db = require('../config/db');

// ---- Classes ----------------------------------------------------------
async function listClasses(req, res) {
  const [rows] = await db.query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.school_id = c.school_id) AS student_count
     FROM classes c WHERE c.school_id = ? ORDER BY c.name`,
    [req.schoolId]
  );
  res.json({ classes: rows });
}

async function createClass(req, res) {
  const { name, academicYear } = req.body;
  if (!name) return res.status(400).json({ error: 'Class name is required' });
  const [result] = await db.query(
    'INSERT INTO classes (school_id, name, academic_year) VALUES (?, ?, ?)',
    [req.schoolId, name, academicYear || null]
  );
  res.status(201).json({ id: result.insertId });
}

async function updateClass(req, res) {
  const { name, academicYear } = req.body;
  const [result] = await db.query(
    'UPDATE classes SET name = ?, academic_year = ? WHERE id = ? AND school_id = ?',
    [name, academicYear || null, req.params.id, req.schoolId]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Class not found' });
  res.json({ ok: true });
}

async function deleteClass(req, res) {
  const [result] = await db.query('DELETE FROM classes WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Class not found' });
  res.json({ ok: true });
}

// ---- Sections -----------------------------------------------------------
async function listSections(req, res) {
  const classFilter = req.query.classId ? 'AND s.class_id = ?' : '';
  const params = [req.schoolId];
  if (req.query.classId) params.push(req.query.classId);
  const [rows] = await db.query(
    `SELECT s.*, c.name AS class_name, u.name AS class_teacher_name
     FROM sections s
     JOIN classes c ON c.id = s.class_id
     LEFT JOIN teachers t ON t.id = s.class_teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE s.school_id = ? ${classFilter}
     ORDER BY c.name, s.name`,
    params
  );
  res.json({ sections: rows });
}

async function createSection(req, res) {
  const { classId, name, classTeacherId } = req.body;
  if (!classId || !name) return res.status(400).json({ error: 'classId and name are required' });
  const [cls] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [classId, req.schoolId]);
  if (!cls[0]) return res.status(404).json({ error: 'Class not found' });
  const [result] = await db.query(
    'INSERT INTO sections (school_id, class_id, name, class_teacher_id) VALUES (?, ?, ?, ?)',
    [req.schoolId, classId, name, classTeacherId || null]
  );
  res.status(201).json({ id: result.insertId });
}

async function updateSection(req, res) {
  const { name, classTeacherId } = req.body;
  const [result] = await db.query(
    'UPDATE sections SET name = ?, class_teacher_id = ? WHERE id = ? AND school_id = ?',
    [name, classTeacherId || null, req.params.id, req.schoolId]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Section not found' });
  res.json({ ok: true });
}

async function deleteSection(req, res) {
  const [result] = await db.query('DELETE FROM sections WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Section not found' });
  res.json({ ok: true });
}

// ---- Subjects -------------------------------------------------------------
async function listSubjects(req, res) {
  const [rows] = await db.query('SELECT * FROM subjects WHERE school_id = ? ORDER BY name', [req.schoolId]);
  res.json({ subjects: rows });
}

async function createSubject(req, res) {
  const { name, code } = req.body;
  if (!name) return res.status(400).json({ error: 'Subject name is required' });
  const [result] = await db.query('INSERT INTO subjects (school_id, name, code) VALUES (?, ?, ?)', [req.schoolId, name, code || null]);
  res.status(201).json({ id: result.insertId });
}

async function updateSubject(req, res) {
  const { name, code } = req.body;
  const [result] = await db.query(
    'UPDATE subjects SET name = ?, code = ? WHERE id = ? AND school_id = ?',
    [name, code || null, req.params.id, req.schoolId]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Subject not found' });
  res.json({ ok: true });
}

async function deleteSubject(req, res) {
  const [result] = await db.query('DELETE FROM subjects WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Subject not found' });
  res.json({ ok: true });
}

// ---- Class <-> Subject <-> Teacher assignment -----------------------------
async function listClassSubjects(req, res) {
  const [rows] = await db.query(
    `SELECT cs.*, sub.name AS subject_name, u.name AS teacher_name
     FROM class_subjects cs
     JOIN subjects sub ON sub.id = cs.subject_id
     LEFT JOIN teachers t ON t.id = cs.teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE cs.school_id = ? AND cs.class_id = ?`,
    [req.schoolId, req.params.classId]
  );
  res.json({ assignments: rows });
}

async function assignClassSubject(req, res) {
  const { classId, subjectId, teacherId } = req.body;
  if (!classId || !subjectId) return res.status(400).json({ error: 'classId and subjectId are required' });
  await db.query(
    `INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (class_id, subject_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id`,
    [req.schoolId, classId, subjectId, teacherId || null]
  );
  res.json({ ok: true });
}

async function removeClassSubject(req, res) {
  const [result] = await db.query('DELETE FROM class_subjects WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ ok: true });
}

module.exports = {
  listClasses, createClass, updateClass, deleteClass,
  listSections, createSection, updateSection, deleteSection,
  listSubjects, createSubject, updateSubject, deleteSubject,
  listClassSubjects, assignClassSubject, removeClassSubject
};
