const db = require('../config/db');

// Bulk mark attendance for a class/section on a date: [{studentId, status, remarks}]
async function markAttendance(req, res) {
  const { classId, sectionId, date, records } = req.body;
  if (!date || !Array.isArray(records) || !records.length) {
    return res.status(400).json({ error: 'date and records[] are required' });
  }
  const validStatuses = ['present', 'absent', 'late', 'excused'];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const rec of records) {
      if (!rec.studentId || !validStatuses.includes(rec.status)) continue;
      const [student] = await conn.query('SELECT id FROM students WHERE id = ? AND school_id = ?', [rec.studentId, req.schoolId]);
      if (!student[0]) continue; // silently skip records that don't belong to this tenant
      await conn.query(
        `INSERT INTO attendance (school_id, student_id, class_id, section_id, date, status, marked_by, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, marked_by = EXCLUDED.marked_by`,
        [req.schoolId, rec.studentId, classId || null, sectionId || null, date, rec.status, req.user.id, rec.remarks || null]
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

async function getDailyAttendance(req, res) {
  const { classId, sectionId, date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const where = ['st.school_id = ?'];
  const params = [req.schoolId];
  if (classId) { where.push('st.class_id = ?'); params.push(classId); }
  if (sectionId) { where.push('st.section_id = ?'); params.push(sectionId); }
  where.push(`st.status = 'active'`);

  const [rows] = await db.query(
    `SELECT st.id AS student_id, st.first_name, st.last_name, st.admission_no,
            a.status, a.remarks
     FROM students st
     LEFT JOIN attendance a ON a.student_id = st.id AND a.date = ? AND a.school_id = ?
     WHERE ${where.join(' AND ')}
     ORDER BY st.first_name`,
    [date, req.schoolId, ...params]
  );
  res.json({ date, records: rows });
}

async function getStudentAttendance(req, res) {
  const { studentId } = req.params;
  const { month } = req.query; // YYYY-MM
  const [student] = await db.query('SELECT id FROM students WHERE id = ? AND school_id = ?', [studentId, req.schoolId]);
  if (!student[0]) return res.status(404).json({ error: 'Student not found' });

  const where = ['student_id = ?', 'school_id = ?'];
  const params = [studentId, req.schoolId];
  if (month) { where.push(`TO_CHAR(date, 'YYYY-MM') = ?`); params.push(month); }

  const [rows] = await db.query(
    `SELECT date, status, remarks FROM attendance WHERE ${where.join(' AND ')} ORDER BY date DESC`,
    params
  );
  const total = rows.length;
  const present = rows.filter(r => r.status === 'present').length;
  res.json({ records: rows, percentage: total ? Math.round((present / total) * 1000) / 10 : null });
}

async function monthlyReport(req, res) {
  const { classId, sectionId, month } = req.query;
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) is required' });

  const where = ['st.school_id = ?'];
  const params = [req.schoolId];
  if (classId) { where.push('st.class_id = ?'); params.push(classId); }
  if (sectionId) { where.push('st.section_id = ?'); params.push(sectionId); }

  const [rows] = await db.query(
    `SELECT st.id AS student_id, st.first_name, st.last_name, st.admission_no,
            COUNT(*) FILTER (WHERE a.status = 'present') AS present,
            COUNT(*) FILTER (WHERE a.status = 'absent') AS absent,
            COUNT(*) FILTER (WHERE a.status = 'late') AS late,
            COUNT(*) FILTER (WHERE a.status = 'excused') AS excused,
            COUNT(a.id) AS total
     FROM students st
     LEFT JOIN attendance a ON a.student_id = st.id AND a.school_id = st.school_id AND TO_CHAR(a.date, 'YYYY-MM') = ?
     WHERE ${where.join(' AND ')}
     GROUP BY st.id
     ORDER BY st.first_name`,
    [month, ...params]
  );
  res.json({ month, records: rows });
}

module.exports = { markAttendance, getDailyAttendance, getStudentAttendance, monthlyReport };
