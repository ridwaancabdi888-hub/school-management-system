const db = require('../config/db');

// Every endpoint here resolves the caller's own children server-side via
// student_guardians — a parent can never pass a studentId that isn't theirs.
async function myChildren(req, res) {
  const [rows] = await db.query(
    `SELECT st.*, c.name AS class_name, sec.name AS section_name
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     LEFT JOIN classes c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE sg.parent_user_id = ? AND sg.school_id = ?`,
    [req.user.id, req.schoolId]
  );
  res.json({ children: rows });
}

async function assertOwnChild(req) {
  const [rows] = await db.query(
    `SELECT 1 FROM student_guardians WHERE parent_user_id = ? AND student_id = ? AND school_id = ?`,
    [req.user.id, req.params.studentId, req.schoolId]
  );
  return rows.length > 0;
}

async function childProfile(req, res) {
  if (!(await assertOwnChild(req))) return res.status(403).json({ error: 'ACCESS DENIED' });
  const [rows] = await db.query(
    `SELECT st.*, c.name AS class_name, sec.name AS section_name FROM students st
     LEFT JOIN classes c ON c.id = st.class_id LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.id = ? AND st.school_id = ?`,
    [req.params.studentId, req.schoolId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
  res.json({ student: rows[0] });
}

module.exports = { myChildren, assertOwnChild, childProfile };
