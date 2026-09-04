const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { uploadFile } = require('../utils/storage');

// Accepts an optional transaction connection (`executor`) so callers that
// generate several admission numbers inside one transaction see their own
// uncommitted inserts and don't hand out the same number twice.
async function generateAdmissionNo(schoolId, executor = db) {
  const [[{ code }]] = await executor.query('SELECT code FROM schools WHERE id = ?', [schoolId]);
  const [[{ cnt }]] = await executor.query('SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?', [schoolId]);
  const year = new Date().getFullYear();
  return `${code}-${year}-${String(cnt + 1).padStart(4, '0')}`;
}

// ---- List / search / filter -----------------------------------------------
async function listStudents(req, res) {
  const { search, classId, sectionId, status, page = 1, pageSize = 25 } = req.query;
  const where = ['st.school_id = ?'];
  const params = [req.schoolId];

  if (search) {
    where.push('(st.first_name LIKE ? OR st.last_name LIKE ? OR st.admission_no LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (classId) { where.push('st.class_id = ?'); params.push(classId); }
  if (sectionId) { where.push('st.section_id = ?'); params.push(sectionId); }
  if (status) { where.push('st.status = ?'); params.push(status); }

  const whereSql = where.join(' AND ');
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM students st WHERE ${whereSql}`, params);

  const limit = Math.min(Number(pageSize) || 25, 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [rows] = await db.query(
    `SELECT st.*, c.name AS class_name, sec.name AS section_name
     FROM students st
     LEFT JOIN classes c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE ${whereSql}
     ORDER BY st.first_name, st.last_name
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({ students: rows, total, page: Number(page), pageSize: limit });
}

// ---- Create -----------------------------------------------------------------
async function createStudent(req, res) {
  const {
    firstName, lastName, classId, sectionId, gender, dob, admissionDate,
    phone, guardianName, guardianPhone, address, admissionNo,
    createLogin, username, password,
    guardianEmail, guardianUsername, guardianPassword, linkExistingParentId
  } = req.body;

  if (!firstName) return res.status(400).json({ error: 'First name is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const finalAdmissionNo = admissionNo || await generateAdmissionNo(req.schoolId, conn);
    const [dupe] = await conn.query('SELECT id FROM students WHERE school_id = ? AND admission_no = ?', [req.schoolId, finalAdmissionNo]);
    if (dupe.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'A student with this admission number already exists' });
    }

    let userId = null;
    if (createLogin && username && password) {
      const [existingUser] = await conn.query('SELECT id FROM users WHERE school_id = ? AND username = ?', [req.schoolId, username]);
      if (existingUser.length) {
        await conn.rollback();
        return res.status(409).json({ error: 'That student username is already taken' });
      }
      const hash = await hashPassword(password);
      const [userResult] = await conn.query(
        `INSERT INTO users (school_id, role, name, username, password_hash, status, must_change_password)
         VALUES (?, 'student', ?, ?, ?, 'active', true)`,
        [req.schoolId, `${firstName} ${lastName || ''}`.trim(), username, hash]
      );
      userId = userResult.insertId;
    }

    const photoPath = req.file ? await uploadFile(req.file.buffer, 'photos', req.file.originalname, req.file.mimetype) : null;

    const [result] = await conn.query(
      `INSERT INTO students (school_id, user_id, admission_no, first_name, last_name, class_id, section_id,
         gender, dob, admission_date, photo, phone, guardian_name, guardian_phone, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [req.schoolId, userId, finalAdmissionNo, firstName, lastName || null, classId || null, sectionId || null,
        gender || null, dob || null, admissionDate || null, photoPath, phone || null, guardianName || null, guardianPhone || null, address || null]
    );
    const studentId = result.insertId;

    let parentUserId = null;
    if (linkExistingParentId) {
      const [parentRow] = await conn.query(`SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'parent'`, [linkExistingParentId, req.schoolId]);
      if (parentRow[0]) parentUserId = parentRow[0].id;
    } else if (guardianUsername && guardianPassword) {
      const [existingParent] = await conn.query('SELECT id FROM users WHERE school_id = ? AND username = ?', [req.schoolId, guardianUsername]);
      if (existingParent.length) {
        parentUserId = existingParent[0].id;
      } else {
        const hash = await hashPassword(guardianPassword);
        const [parentResult] = await conn.query(
          `INSERT INTO users (school_id, role, name, username, email, password_hash, status, must_change_password)
           VALUES (?, 'parent', ?, ?, ?, ?, 'active', true)`,
          [req.schoolId, guardianName || 'Parent/Guardian', guardianUsername, guardianEmail || null, hash]
        );
        parentUserId = parentResult.insertId;
      }
    }
    if (parentUserId) {
      await conn.query(
        `INSERT INTO student_guardians (school_id, student_id, parent_user_id, relationship)
         VALUES (?, ?, ?, 'Parent') ON CONFLICT (student_id, parent_user_id) DO NOTHING`,
        [req.schoolId, studentId, parentUserId]
      );
    }

    await conn.commit();
    res.status(201).json({ id: studentId, admissionNo: finalAdmissionNo, parentUserId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---- Full profile ------------------------------------------------------------
async function getStudent(req, res) {
  const [rows] = await db.query(
    `SELECT st.*, c.name AS class_name, sec.name AS section_name
     FROM students st
     LEFT JOIN classes c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.id = ? AND st.school_id = ?`,
    [req.params.id, req.schoolId]
  );
  const student = rows[0];
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const [guardians] = await db.query(
    `SELECT u.id, u.name, u.username, u.email, u.phone, sg.relationship
     FROM student_guardians sg JOIN users u ON u.id = sg.parent_user_id
     WHERE sg.student_id = ? AND sg.school_id = ?`,
    [req.params.id, req.schoolId]
  );

  const [[attendanceSummary]] = await db.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'present') AS present,
            COUNT(*) FILTER (WHERE status = 'absent') AS absent,
            COUNT(*) FILTER (WHERE status = 'late') AS late,
            COUNT(*) FILTER (WHERE status = 'excused') AS excused
     FROM attendance WHERE student_id = ? AND school_id = ?`,
    [req.params.id, req.schoolId]
  );

  const [feeSummary] = await db.query(
    `SELECT sf.id, ft.name AS fee_type, sf.amount_required, sf.due_date,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_fee_id = sf.id), 0) AS amount_paid
     FROM student_fees sf JOIN fee_types ft ON ft.id = sf.fee_type_id
     WHERE sf.student_id = ? AND sf.school_id = ?`,
    [req.params.id, req.schoolId]
  );

  const [payments] = await db.query(
    `SELECT * FROM payments WHERE student_id = ? AND school_id = ? ORDER BY payment_date DESC`,
    [req.params.id, req.schoolId]
  );

  const [results] = await db.query(
    `SELECT e.id AS exam_id, e.name AS exam_name, e.term, e.status AS exam_status,
            sub.name AS subject_name, r.marks_obtained, es.max_marks, es.pass_marks, r.teacher_comment
     FROM results r
     JOIN exam_subjects es ON es.id = r.exam_subject_id
     JOIN exams e ON e.id = r.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE r.student_id = ? AND r.school_id = ? AND e.status = 'published'
     ORDER BY e.created_at DESC`,
    [req.params.id, req.schoolId]
  );

  res.json({ student, guardians, attendanceSummary, feeSummary, payments, results });
}

async function updateStudent(req, res) {
  const {
    firstName, lastName, classId, sectionId, gender, dob, admissionDate,
    phone, guardianName, guardianPhone, address
  } = req.body;

  const [existing] = await db.query('SELECT * FROM students WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!existing[0]) return res.status(404).json({ error: 'Student not found' });
  const cur = existing[0];
  const photoPath = req.file ? await uploadFile(req.file.buffer, 'photos', req.file.originalname, req.file.mimetype) : cur.photo;

  await db.query(
    `UPDATE students SET first_name = ?, last_name = ?, class_id = ?, section_id = ?, gender = ?, dob = ?,
       admission_date = ?, phone = ?, guardian_name = ?, guardian_phone = ?, address = ?, photo = ?
     WHERE id = ? AND school_id = ?`,
    [
      firstName ?? cur.first_name, lastName ?? cur.last_name, classId ?? cur.class_id, sectionId ?? cur.section_id,
      gender ?? cur.gender, dob ?? cur.dob, admissionDate ?? cur.admission_date,
      phone ?? cur.phone, guardianName ?? cur.guardian_name, guardianPhone ?? cur.guardian_phone, address ?? cur.address,
      photoPath, req.params.id, req.schoolId
    ]
  );
  res.json({ ok: true });
}

async function setStudentStatus(req, res) {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'status must be active or inactive' });
  const [result] = await db.query('UPDATE students SET status = ? WHERE id = ? AND school_id = ?', [status, req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Student not found' });
  res.json({ ok: true });
}

module.exports = { listStudents, createStudent, getStudent, updateStudent, setStudentStatus, generateAdmissionNo };
