const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/parentController');
const studentPortal = require('../controllers/studentPortalController');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('parent'));

router.get('/children', asyncHandler(ctrl.myChildren));
router.get('/children/:studentId', asyncHandler(ctrl.childProfile));

async function guardOwnChild(req, res, next) {
  if (!(await ctrl.assertOwnChild(req))) return res.status(403).json({ error: 'ACCESS DENIED' });
  next();
}

router.get('/children/:studentId/attendance', guardOwnChild, asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT date, status, remarks FROM attendance WHERE student_id = ? AND school_id = ? ORDER BY date DESC', [req.params.studentId, req.schoolId]);
  const present = rows.filter(r => r.status === 'present').length;
  res.json({ records: rows, percentage: rows.length ? Math.round((present / rows.length) * 1000) / 10 : null });
}));

router.get('/children/:studentId/results', guardOwnChild, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT e.id AS exam_id, e.name AS exam_name, e.term, sub.name AS subject_name, r.marks_obtained, es.max_marks, es.pass_marks
     FROM results r JOIN exam_subjects es ON es.id = r.exam_subject_id JOIN exams e ON e.id = r.exam_id JOIN subjects sub ON sub.id = es.subject_id
     WHERE r.student_id = ? AND r.school_id = ? AND e.status = 'published' ORDER BY e.created_at DESC`,
    [req.params.studentId, req.schoolId]
  );
  res.json({ results: rows });
}));

router.get('/children/:studentId/fees', guardOwnChild, asyncHandler(async (req, res) => {
  const [feeSummary] = await db.query(
    `SELECT sf.id, ft.name AS fee_type, sf.amount_required, sf.due_date,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_fee_id = sf.id), 0) AS amount_paid
     FROM student_fees sf JOIN fee_types ft ON ft.id = sf.fee_type_id WHERE sf.student_id = ? AND sf.school_id = ?`,
    [req.params.studentId, req.schoolId]
  );
  const [payments] = await db.query('SELECT * FROM payments WHERE student_id = ? AND school_id = ? ORDER BY payment_date DESC', [req.params.studentId, req.schoolId]);
  res.json({ feeSummary, payments });
}));

router.get('/children/:studentId/timetable', guardOwnChild, asyncHandler(async (req, res) => {
  const [[student]] = await db.query('SELECT class_id, section_id FROM students WHERE id = ?', [req.params.studentId]);
  const [rows] = await db.query(
    `SELECT t.*, sub.name AS subject_name, u.name AS teacher_name
     FROM timetable t LEFT JOIN subjects sub ON sub.id = t.subject_id
     LEFT JOIN teachers te ON te.id = t.teacher_id LEFT JOIN users u ON u.id = te.user_id
     WHERE t.school_id = ? AND t.class_id = ? AND (t.section_id = ? OR t.section_id IS NULL)
     ORDER BY array_position(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], t.day), t.start_time`,
    [req.schoolId, student.class_id, student.section_id]
  );
  res.json({ timetable: rows });
}));

router.get('/children/:studentId/report-card/:examId', guardOwnChild, asyncHandler(async (req, res) => {
  const { buildReportCard } = require('../controllers/resultController');
  const [[exam]] = await db.query('SELECT status FROM exams WHERE id = ? AND school_id = ?', [req.params.examId, req.schoolId]);
  if (!exam || exam.status !== 'published') return res.status(404).json({ error: 'Report card not available' });
  const data = await buildReportCard(req.schoolId, req.params.examId, req.params.studentId);
  if (!data) return res.status(404).json({ error: 'Report card not found' });
  res.json(data);
}));

router.get('/announcements', asyncHandler(require('../controllers/announcementController').myAnnouncements));

module.exports = router;
