const db = require('../config/db');

// ---- Fee types --------------------------------------------------------------
async function listFeeTypes(req, res) {
  const [rows] = await db.query('SELECT * FROM fee_types WHERE school_id = ? ORDER BY name', [req.schoolId]);
  res.json({ feeTypes: rows });
}

async function createFeeType(req, res) {
  const { name, category } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const validCategories = ['tuition', 'registration', 'transport', 'exam', 'other'];
  const [result] = await db.query(
    'INSERT INTO fee_types (school_id, name, category) VALUES (?, ?, ?)',
    [req.schoolId, name, validCategories.includes(category) ? category : 'other']
  );
  res.status(201).json({ id: result.insertId });
}

// ---- Assign a fee (amount required) to a student --------------------------
async function assignStudentFee(req, res) {
  const { studentId, feeTypeId, amountRequired, academicYear, dueDate } = req.body;
  if (!studentId || !feeTypeId || amountRequired == null) {
    return res.status(400).json({ error: 'studentId, feeTypeId and amountRequired are required' });
  }
  const [student] = await db.query('SELECT id FROM students WHERE id = ? AND school_id = ?', [studentId, req.schoolId]);
  if (!student[0]) return res.status(404).json({ error: 'Student not found' });

  const [result] = await db.query(
    `INSERT INTO student_fees (school_id, student_id, fee_type_id, academic_year, amount_required, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.schoolId, studentId, feeTypeId, academicYear || null, amountRequired, dueDate || null]
  );
  res.status(201).json({ id: result.insertId });
}

// Bulk-assign the same fee to every active student in a class (common workflow: term tuition for a whole class)
async function bulkAssignClassFee(req, res) {
  const { classId, feeTypeId, amountRequired, academicYear, dueDate } = req.body;
  if (!classId || !feeTypeId || amountRequired == null) {
    return res.status(400).json({ error: 'classId, feeTypeId and amountRequired are required' });
  }
  const [students] = await db.query(`SELECT id FROM students WHERE school_id = ? AND class_id = ? AND status = 'active'`, [req.schoolId, classId]);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const s of students) {
      await conn.query(
        `INSERT INTO student_fees (school_id, student_id, fee_type_id, academic_year, amount_required, due_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.schoolId, s.id, feeTypeId, academicYear || null, amountRequired, dueDate || null]
      );
    }
    await conn.commit();
    res.json({ ok: true, assigned: students.length });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---- Outstanding balances ----------------------------------------------------
async function outstanding(req, res) {
  const { classId, sectionId } = req.query;
  const where = ['st.school_id = ?'];
  const params = [req.schoolId];
  if (classId) { where.push('st.class_id = ?'); params.push(classId); }
  if (sectionId) { where.push('st.section_id = ?'); params.push(sectionId); }

  const [rows] = await db.query(
    `SELECT st.id AS student_id, st.first_name, st.last_name, st.admission_no,
            c.name AS class_name, sec.name AS section_name,
            COALESCE(SUM(sf.amount_required), 0) AS required,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = st.id AND p.school_id = st.school_id), 0) AS paid
     FROM students st
     LEFT JOIN classes c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     LEFT JOIN student_fees sf ON sf.student_id = st.id AND sf.school_id = st.school_id
     WHERE ${where.join(' AND ')}
     GROUP BY st.id, c.name, sec.name
     HAVING COALESCE(SUM(sf.amount_required), 0) > COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = st.id AND p.school_id = st.school_id), 0)
     ORDER BY (COALESCE(SUM(sf.amount_required), 0) - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = st.id AND p.school_id = st.school_id), 0)) DESC`,
    params
  );
  res.json({ students: rows.map(r => ({ ...r, outstanding: Number(r.required) - Number(r.paid) })) });
}

module.exports = { listFeeTypes, createFeeType, assignStudentFee, bulkAssignClassFee, outstanding };
