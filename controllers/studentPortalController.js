const db = require('../config/db');
const { buildReportCard } = require('./resultController');
const { renderReportCardPdf } = require('../utils/pdf');

// Resolves the logged-in student's own row — every other method in this
// file scopes off this id, so a student can never reach another student's
// record no matter what they pass on the URL.
async function myStudentRow(req) {
  const [rows] = await db.query('SELECT * FROM students WHERE user_id = ? AND school_id = ?', [req.user.id, req.schoolId]);
  return rows[0] || null;
}

async function myProfile(req, res) {
  const student = await myStudentRow(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });
  const [[classRow]] = await db.query(
    `SELECT c.name AS class_name, sec.name AS section_name FROM students st
     LEFT JOIN classes c ON c.id = st.class_id LEFT JOIN sections sec ON sec.id = st.section_id WHERE st.id = ?`,
    [student.id]
  );
  res.json({ student: { ...student, ...classRow } });
}

async function myAttendance(req, res) {
  const student = await myStudentRow(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });
  const [rows] = await db.query('SELECT date, status, remarks FROM attendance WHERE student_id = ? AND school_id = ? ORDER BY date DESC', [student.id, req.schoolId]);
  const present = rows.filter(r => r.status === 'present').length;
  res.json({ records: rows, percentage: rows.length ? Math.round((present / rows.length) * 1000) / 10 : null });
}

async function myResults(req, res) {
  const student = await myStudentRow(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });
  const [rows] = await db.query(
    `SELECT e.id AS exam_id, e.name AS exam_name, e.term, sub.name AS subject_name, r.marks_obtained, es.max_marks, es.pass_marks
     FROM results r JOIN exam_subjects es ON es.id = r.exam_subject_id JOIN exams e ON e.id = r.exam_id JOIN subjects sub ON sub.id = es.subject_id
     WHERE r.student_id = ? AND r.school_id = ? AND e.status = 'published' ORDER BY e.created_at DESC`,
    [student.id, req.schoolId]
  );
  res.json({ results: rows });
}

async function myFees(req, res) {
  const student = await myStudentRow(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });
  const [feeSummary] = await db.query(
    `SELECT sf.id, ft.name AS fee_type, sf.amount_required, sf.due_date,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_fee_id = sf.id), 0) AS amount_paid
     FROM student_fees sf JOIN fee_types ft ON ft.id = sf.fee_type_id WHERE sf.student_id = ? AND sf.school_id = ?`,
    [student.id, req.schoolId]
  );
  const [payments] = await db.query('SELECT * FROM payments WHERE student_id = ? AND school_id = ? ORDER BY payment_date DESC', [student.id, req.schoolId]);
  res.json({ feeSummary, payments });
}

async function myTimetable(req, res) {
  const student = await myStudentRow(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });
  const [rows] = await db.query(
    `SELECT t.*, sub.name AS subject_name, u.name AS teacher_name
     FROM timetable t LEFT JOIN subjects sub ON sub.id = t.subject_id
     LEFT JOIN teachers te ON te.id = t.teacher_id LEFT JOIN users u ON u.id = te.user_id
     WHERE t.school_id = ? AND t.class_id = ? AND (t.section_id = ? OR t.section_id IS NULL)
     ORDER BY array_position(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], t.day), t.start_time`,
    [req.schoolId, student.class_id, student.section_id]
  );
  res.json({ timetable: rows });
}

// Students/parents may only ever see a PUBLISHED exam's report card.
async function myReportCard(req, res) {
  const student = await myStudentRow(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });
  const [[exam]] = await db.query('SELECT status FROM exams WHERE id = ? AND school_id = ?', [req.params.examId, req.schoolId]);
  if (!exam || exam.status !== 'published') return res.status(404).json({ error: 'Report card not available' });
  const data = await buildReportCard(req.schoolId, req.params.examId, student.id);
  if (!data) return res.status(404).json({ error: 'Report card not found' });
  res.json(data);
}

async function myReportCardPdf(req, res) {
  const student = await myStudentRow(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });
  const [[exam]] = await db.query('SELECT status FROM exams WHERE id = ? AND school_id = ?', [req.params.examId, req.schoolId]);
  if (!exam || exam.status !== 'published') return res.status(404).json({ error: 'Report card not available' });
  const data = await buildReportCard(req.schoolId, req.params.examId, student.id);
  if (!data) return res.status(404).json({ error: 'Report card not found' });
  renderReportCardPdf(res, data);
}

module.exports = { myProfile, myAttendance, myResults, myFees, myTimetable, myStudentRow, myReportCard, myReportCardPdf };
