const db = require('../config/db');
const { renderReportCardPdf } = require('../utils/pdf');

function computeGrade(pct) {
  if (pct == null) return null;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  if (pct >= 40) return 'E';
  return 'F';
}

// Marksheet for one class/exam so a teacher can enter marks for every student at once.
async function getMarksheet(req, res) {
  const { examId } = req.params;
  const [exam] = await db.query('SELECT * FROM exams WHERE id = ? AND school_id = ?', [examId, req.schoolId]);
  if (!exam[0]) return res.status(404).json({ error: 'Exam not found' });

  const [subjects] = await db.query(
    `SELECT es.id AS exam_subject_id, sub.name AS subject_name, es.max_marks, es.pass_marks
     FROM exam_subjects es JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.exam_id = ? AND es.school_id = ?`,
    [examId, req.schoolId]
  );

  const [students] = await db.query(
    `SELECT id, first_name, last_name, admission_no FROM students WHERE school_id = ? AND class_id = ? AND status = 'active' ORDER BY first_name`,
    [req.schoolId, exam[0].class_id]
  );

  const [existing] = await db.query(
    `SELECT student_id, exam_subject_id, marks_obtained, teacher_comment FROM results WHERE exam_id = ? AND school_id = ?`,
    [examId, req.schoolId]
  );
  const marksMap = {};
  for (const r of existing) marksMap[`${r.student_id}-${r.exam_subject_id}`] = r;

  res.json({ exam: exam[0], subjects, students, marks: marksMap });
}

// Bulk save marks: [{studentId, examSubjectId, marks, comment}]
async function saveMarks(req, res) {
  const { examId } = req.params;
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries[] is required' });

  const [exam] = await db.query('SELECT id FROM exams WHERE id = ? AND school_id = ?', [examId, req.schoolId]);
  if (!exam[0]) return res.status(404).json({ error: 'Exam not found' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      if (!e.studentId || !e.examSubjectId) continue;
      const [student] = await conn.query('SELECT id FROM students WHERE id = ? AND school_id = ?', [e.studentId, req.schoolId]);
      if (!student[0]) continue;
      await conn.query(
        `INSERT INTO results (school_id, exam_id, student_id, exam_subject_id, marks_obtained, teacher_comment, entered_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (exam_id, student_id, exam_subject_id) DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, teacher_comment = EXCLUDED.teacher_comment, entered_by = EXCLUDED.entered_by`,
        [req.schoolId, examId, e.studentId, e.examSubjectId, e.marks === '' || e.marks == null ? null : e.marks, e.comment || null, req.user.id]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Report card for one student's exam — used by admin/teacher and by the
// student/parent portals (only when the exam is published, enforced in routes).
async function getReportCard(req, res) {
  const { examId, studentId } = req.params;

  const [exam] = await db.query(
    `SELECT e.*, c.name AS class_name FROM exams e JOIN classes c ON c.id = e.class_id WHERE e.id = ? AND e.school_id = ?`,
    [examId, req.schoolId]
  );
  if (!exam[0]) return res.status(404).json({ error: 'Exam not found' });

  const [student] = await db.query(
    `SELECT st.*, sec.name AS section_name FROM students st LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.id = ? AND st.school_id = ?`,
    [studentId, req.schoolId]
  );
  if (!student[0]) return res.status(404).json({ error: 'Student not found' });

  const [rows] = await db.query(
    `SELECT sub.name AS subject_name, es.max_marks, es.pass_marks, r.marks_obtained, r.teacher_comment
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN results r ON r.exam_subject_id = es.id AND r.student_id = ? AND r.school_id = es.school_id
     WHERE es.exam_id = ? AND es.school_id = ?`,
    [studentId, examId, req.schoolId]
  );

  const totalMax = rows.reduce((sum, r) => sum + Number(r.max_marks), 0);
  const totalObtained = rows.reduce((sum, r) => sum + (r.marks_obtained == null ? 0 : Number(r.marks_obtained)), 0);
  const pct = totalMax ? (totalObtained / totalMax) * 100 : null;

  const [[attendance]] = await db.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'present') AS present FROM attendance WHERE student_id = ? AND school_id = ?`,
    [studentId, req.schoolId]
  );

  const [[school]] = await db.query('SELECT name, logo, report_card_header, currency FROM schools WHERE id = ?', [req.schoolId]);

  res.json({
    school,
    exam: exam[0],
    student: student[0],
    subjects: rows.map(r => ({ ...r, grade: computeGrade(r.max_marks ? (r.marks_obtained / r.max_marks) * 100 : null) })),
    totalMax,
    totalObtained,
    average: pct == null ? null : Math.round(pct * 100) / 100,
    grade: computeGrade(pct),
    attendancePercentage: attendance.total ? Math.round((attendance.present / attendance.total) * 1000) / 10 : null
  });
}

// Builds the same payload as getReportCard but returns the object instead of
// writing a response, so it can be reused by the JSON route, the PDF route,
// and the student/parent portal routes (each applying their own access checks).
async function buildReportCard(schoolId, examId, studentId) {
  const [exam] = await db.query(
    `SELECT e.*, c.name AS class_name FROM exams e JOIN classes c ON c.id = e.class_id WHERE e.id = ? AND e.school_id = ?`,
    [examId, schoolId]
  );
  if (!exam[0]) return null;

  const [student] = await db.query(
    `SELECT st.*, sec.name AS section_name FROM students st LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.id = ? AND st.school_id = ?`,
    [studentId, schoolId]
  );
  if (!student[0]) return null;

  const [rows] = await db.query(
    `SELECT sub.name AS subject_name, es.max_marks, es.pass_marks, r.marks_obtained, r.teacher_comment
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN results r ON r.exam_subject_id = es.id AND r.student_id = ? AND r.school_id = es.school_id
     WHERE es.exam_id = ? AND es.school_id = ?`,
    [studentId, examId, schoolId]
  );

  const totalMax = rows.reduce((sum, r) => sum + Number(r.max_marks), 0);
  const totalObtained = rows.reduce((sum, r) => sum + (r.marks_obtained == null ? 0 : Number(r.marks_obtained)), 0);
  const pct = totalMax ? (totalObtained / totalMax) * 100 : null;

  const [[attendance]] = await db.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'present') AS present FROM attendance WHERE student_id = ? AND school_id = ?`,
    [studentId, schoolId]
  );
  const [[school]] = await db.query('SELECT name, logo, report_card_header, currency FROM schools WHERE id = ?', [schoolId]);

  return {
    school,
    exam: exam[0],
    student: student[0],
    subjects: rows.map(r => ({ ...r, grade: computeGrade(r.max_marks ? (r.marks_obtained / r.max_marks) * 100 : null) })),
    totalMax,
    totalObtained,
    average: pct == null ? null : Math.round(pct * 100) / 100,
    grade: computeGrade(pct),
    attendancePercentage: attendance.total ? Math.round((attendance.present / attendance.total) * 1000) / 10 : null
  };
}

async function getReportCardPdf(req, res) {
  const data = await buildReportCard(req.schoolId, req.params.examId, req.params.studentId);
  if (!data) return res.status(404).json({ error: 'Report card not found' });
  renderReportCardPdf(res, data);
}

// Class performance: ranked list of students for a published/draft exam.
async function classPerformance(req, res) {
  const { examId } = req.params;
  const [exam] = await db.query('SELECT * FROM exams WHERE id = ? AND school_id = ?', [examId, req.schoolId]);
  if (!exam[0]) return res.status(404).json({ error: 'Exam not found' });

  const [students] = await db.query(
    `SELECT id, first_name, last_name, admission_no FROM students WHERE school_id = ? AND class_id = ? AND status = 'active'`,
    [req.schoolId, exam[0].class_id]
  );
  const [subjects] = await db.query('SELECT id, max_marks FROM exam_subjects WHERE exam_id = ? AND school_id = ?', [examId, req.schoolId]);
  const totalMax = subjects.reduce((sum, s) => sum + Number(s.max_marks), 0);

  const [results] = await db.query(
    `SELECT student_id, SUM(marks_obtained) AS total FROM results WHERE exam_id = ? AND school_id = ? GROUP BY student_id`,
    [examId, req.schoolId]
  );
  const totalsMap = {};
  for (const r of results) totalsMap[r.student_id] = Number(r.total || 0);

  const ranked = students
    .map(s => {
      const total = totalsMap[s.id] || 0;
      const pct = totalMax ? (total / totalMax) * 100 : null;
      return { ...s, total, average: pct == null ? null : Math.round(pct * 100) / 100, grade: computeGrade(pct) };
    })
    .sort((a, b) => b.total - a.total)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  res.json({ exam: exam[0], totalMax, ranking: ranked });
}

module.exports = { getMarksheet, saveMarks, getReportCard, getReportCardPdf, classPerformance, buildReportCard };
