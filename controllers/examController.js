const db = require('../config/db');

async function listExams(req, res) {
  const { classId } = req.query;
  const where = ['e.school_id = ?'];
  const params = [req.schoolId];
  if (classId) { where.push('e.class_id = ?'); params.push(classId); }
  const [rows] = await db.query(
    `SELECT e.*, c.name AS class_name FROM exams e JOIN classes c ON c.id = e.class_id
     WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC`,
    params
  );
  res.json({ exams: rows });
}

async function createExam(req, res) {
  const { name, term, academicYear, classId, subjects } = req.body;
  if (!name || !classId) return res.status(400).json({ error: 'name and classId are required' });
  const [cls] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [classId, req.schoolId]);
  if (!cls[0]) return res.status(404).json({ error: 'Class not found' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO exams (school_id, name, term, academic_year, class_id, status) VALUES (?, ?, ?, ?, ?, 'draft')`,
      [req.schoolId, name, term || null, academicYear || null, classId]
    );
    const examId = result.insertId;
    if (Array.isArray(subjects)) {
      for (const s of subjects) {
        if (!s.subjectId) continue;
        await conn.query(
          `INSERT INTO exam_subjects (school_id, exam_id, subject_id, max_marks, pass_marks) VALUES (?, ?, ?, ?, ?)`,
          [req.schoolId, examId, s.subjectId, s.maxMarks || 100, s.passMarks || 40]
        );
      }
    }
    await conn.commit();
    res.status(201).json({ id: examId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getExam(req, res) {
  const [exam] = await db.query(
    `SELECT e.*, c.name AS class_name FROM exams e JOIN classes c ON c.id = e.class_id WHERE e.id = ? AND e.school_id = ?`,
    [req.params.id, req.schoolId]
  );
  if (!exam[0]) return res.status(404).json({ error: 'Exam not found' });
  const [subjects] = await db.query(
    `SELECT es.*, sub.name AS subject_name FROM exam_subjects es JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.exam_id = ? AND es.school_id = ?`,
    [req.params.id, req.schoolId]
  );
  res.json({ exam: exam[0], subjects });
}

function publishExam(status) {
  return async (req, res) => {
    const [result] = await db.query('UPDATE exams SET status = ? WHERE id = ? AND school_id = ?', [status, req.params.id, req.schoolId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Exam not found' });
    res.json({ ok: true, status });
  };
}

async function addExamSubject(req, res) {
  const { subjectId, maxMarks, passMarks } = req.body;
  const [exam] = await db.query('SELECT id FROM exams WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!exam[0]) return res.status(404).json({ error: 'Exam not found' });
  const [result] = await db.query(
    `INSERT INTO exam_subjects (school_id, exam_id, subject_id, max_marks, pass_marks) VALUES (?, ?, ?, ?, ?)`,
    [req.schoolId, req.params.id, subjectId, maxMarks || 100, passMarks || 40]
  );
  res.status(201).json({ id: result.insertId });
}

module.exports = {
  listExams, createExam, getExam,
  publishExamAction: publishExam('published'),
  unpublishExamAction: publishExam('draft'),
  addExamSubject
};
