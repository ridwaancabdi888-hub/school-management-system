const db = require('../config/db');

async function listTimetable(req, res) {
  const { classId, sectionId, teacherUserId } = req.query;
  const where = ['t.school_id = ?'];
  const params = [req.schoolId];
  if (classId) { where.push('t.class_id = ?'); params.push(classId); }
  if (sectionId) { where.push('t.section_id = ?'); params.push(sectionId); }
  if (teacherUserId) { where.push('u.id = ?'); params.push(teacherUserId); }

  const [rows] = await db.query(
    `SELECT t.*, c.name AS class_name, sec.name AS section_name, sub.name AS subject_name, u.name AS teacher_name
     FROM timetable t
     JOIN classes c ON c.id = t.class_id
     LEFT JOIN sections sec ON sec.id = t.section_id
     LEFT JOIN subjects sub ON sub.id = t.subject_id
     LEFT JOIN teachers te ON te.id = t.teacher_id
     LEFT JOIN users u ON u.id = te.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY array_position(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], t.day), t.start_time`,
    params
  );
  res.json({ timetable: rows });
}

async function createSlot(req, res) {
  const { classId, sectionId, day, startTime, endTime, subjectId, teacherId } = req.body;
  if (!classId || !day || !startTime || !endTime) {
    return res.status(400).json({ error: 'classId, day, startTime and endTime are required' });
  }
  const [result] = await db.query(
    `INSERT INTO timetable (school_id, class_id, section_id, day, start_time, end_time, subject_id, teacher_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.schoolId, classId, sectionId || null, day, startTime, endTime, subjectId || null, teacherId || null]
  );
  res.status(201).json({ id: result.insertId });
}

async function updateSlot(req, res) {
  const { day, startTime, endTime, subjectId, teacherId, sectionId } = req.body;
  const [result] = await db.query(
    `UPDATE timetable SET day = COALESCE(?, day), start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time),
       subject_id = ?, teacher_id = ?, section_id = ?
     WHERE id = ? AND school_id = ?`,
    [day, startTime, endTime, subjectId || null, teacherId || null, sectionId || null, req.params.id, req.schoolId]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Timetable slot not found' });
  res.json({ ok: true });
}

async function deleteSlot(req, res) {
  const [result] = await db.query('DELETE FROM timetable WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Timetable slot not found' });
  res.json({ ok: true });
}

module.exports = { listTimetable, createSlot, updateSlot, deleteSlot };
