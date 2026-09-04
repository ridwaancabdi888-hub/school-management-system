const db = require('../config/db');

async function schoolAdminDashboard(req, res) {
  const schoolId = req.schoolId;
  const [[students]] = await db.query(`SELECT COUNT(*) AS total FROM students WHERE school_id = ? AND status = 'active'`, [schoolId]);
  const [[teachers]] = await db.query(`SELECT COUNT(*) AS total FROM teachers WHERE school_id = ? AND status = 'active'`, [schoolId]);
  const [[parents]] = await db.query(`SELECT COUNT(DISTINCT parent_user_id) AS total FROM student_guardians WHERE school_id = ?`, [schoolId]);
  const [[classes]] = await db.query(`SELECT COUNT(*) AS total FROM classes WHERE school_id = ?`, [schoolId]);
  const today = new Date().toISOString().slice(0, 10);
  const [[todayAttendance]] = await db.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'present') AS present, COUNT(*) AS total FROM attendance WHERE school_id = ? AND date = ?`,
    [schoolId, today]
  );
  const [[collections]] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE school_id = ? AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    [schoolId]
  );
  const [[outstanding]] = await db.query(
    `SELECT COALESCE(SUM(sf.amount_required), 0) - COALESCE((SELECT SUM(amount) FROM payments WHERE school_id = ?), 0) AS total
     FROM student_fees sf WHERE sf.school_id = ?`,
    [schoolId, schoolId]
  );
  const [recentAnnouncements] = await db.query(
    `SELECT id, title, created_at FROM announcements WHERE school_id = ? ORDER BY created_at DESC LIMIT 5`,
    [schoolId]
  );

  res.json({
    students: students.total,
    teachers: teachers.total,
    parents: parents.total,
    classes: classes.total,
    todayAttendance: { present: todayAttendance.present || 0, total: todayAttendance.total || 0 },
    monthlyCollections: Number(collections.total),
    outstandingFees: Number(outstanding.total) < 0 ? 0 : Number(outstanding.total),
    recentAnnouncements
  });
}

async function teacherDashboard(req, res) {
  const [teacherRow] = await db.query('SELECT id FROM teachers WHERE user_id = ? AND school_id = ?', [req.user.id, req.schoolId]);
  const teacherId = teacherRow[0] ? teacherRow[0].id : null;

  const [[classCount]] = await db.query(
    `SELECT COUNT(DISTINCT class_id) AS total FROM class_subjects WHERE teacher_id = ? AND school_id = ?`,
    [teacherId, req.schoolId]
  );
  const [[sectionCount]] = await db.query(
    `SELECT COUNT(*) AS total FROM sections WHERE class_teacher_id = ? AND school_id = ?`,
    [teacherId, req.schoolId]
  );
  const [recentAnnouncements] = await db.query(
    `SELECT id, title, created_at FROM announcements WHERE school_id = ? ORDER BY created_at DESC LIMIT 5`,
    [req.schoolId]
  );

  res.json({ assignedClasses: classCount.total, classTeacherSections: sectionCount.total, recentAnnouncements });
}

async function accountantDashboard(req, res) {
  const schoolId = req.schoolId;
  const [[collections]] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE school_id = ? AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    [schoolId]
  );
  const [[outstanding]] = await db.query(
    `SELECT COALESCE(SUM(sf.amount_required), 0) - COALESCE((SELECT SUM(amount) FROM payments WHERE school_id = ?), 0) AS total
     FROM student_fees sf WHERE sf.school_id = ?`,
    [schoolId, schoolId]
  );
  const [[expenses]] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM finance_records WHERE school_id = ? AND type = 'expense' AND EXTRACT(MONTH FROM record_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM record_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    [schoolId]
  );
  const [recentPayments] = await db.query(
    `SELECT p.id, p.amount, p.payment_date, st.first_name, st.last_name FROM payments p JOIN students st ON st.id = p.student_id
     WHERE p.school_id = ? ORDER BY p.created_at DESC LIMIT 8`,
    [schoolId]
  );

  res.json({
    monthlyCollections: Number(collections.total),
    outstandingFees: Number(outstanding.total) < 0 ? 0 : Number(outstanding.total),
    monthlyExpenses: Number(expenses.total),
    recentPayments
  });
}

module.exports = { schoolAdminDashboard, teacherDashboard, accountantDashboard };
