const db = require('../config/db');

async function listAnnouncements(req, res) {
  const [rows] = await db.query(
    `SELECT a.*, u.name AS author_name, c.name AS class_name, sec.name AS section_name
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     LEFT JOIN classes c ON c.id = a.class_id
     LEFT JOIN sections sec ON sec.id = a.section_id
     WHERE a.school_id = ? ORDER BY a.created_at DESC`,
    [req.schoolId]
  );
  res.json({ announcements: rows });
}

// Announcements relevant to the logged-in user, based on their role
// (and, for students/parents, their class/section).
async function myAnnouncements(req, res) {
  const role = req.user.role;
  let targets = ['everyone'];
  let classId = null;
  let sectionId = null;

  if (role === 'teacher') targets.push('teachers');
  if (role === 'student') {
    targets.push('students');
    const [s] = await db.query('SELECT class_id, section_id FROM students WHERE user_id = ? AND school_id = ?', [req.user.id, req.schoolId]);
    if (s[0]) { classId = s[0].class_id; sectionId = s[0].section_id; }
  }
  if (role === 'parent') {
    targets.push('parents');
  }

  const [rows] = await db.query(
    `SELECT a.* FROM announcements a
     WHERE a.school_id = ? AND (
       a.target IN (${targets.map(() => '?').join(',')})
       ${classId ? 'OR (a.target = "class" AND a.class_id = ?)' : ''}
       ${sectionId ? 'OR (a.target = "section" AND a.section_id = ?)' : ''}
     )
     ORDER BY a.created_at DESC`,
    [req.schoolId, ...targets, ...(classId ? [classId] : []), ...(sectionId ? [sectionId] : [])]
  );
  res.json({ announcements: rows });
}

async function createAnnouncement(req, res) {
  const { title, body, target, classId, sectionId } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const validTargets = ['everyone', 'teachers', 'students', 'parents', 'class', 'section'];
  const [result] = await db.query(
    `INSERT INTO announcements (school_id, title, body, target, class_id, section_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.schoolId, title, body, validTargets.includes(target) ? target : 'everyone', classId || null, sectionId || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
}

async function deleteAnnouncement(req, res) {
  const [result] = await db.query('DELETE FROM announcements WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Announcement not found' });
  res.json({ ok: true });
}

module.exports = { listAnnouncements, myAnnouncements, createAnnouncement, deleteAnnouncement };
