const db = require('../config/db');
const { sendCsv } = require('../utils/csv');

async function studentsReport(req, res) {
  const [rows] = await db.query(
    `SELECT st.admission_no, st.first_name, st.last_name, c.name AS class_name, sec.name AS section_name,
            st.gender, st.dob, st.status, st.guardian_name, st.guardian_phone
     FROM students st LEFT JOIN classes c ON c.id = st.class_id LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.school_id = ? ORDER BY st.first_name`,
    [req.schoolId]
  );
  if (req.query.format === 'csv') {
    return sendCsv(res, 'students.csv', rows, [
      { key: 'admission_no', label: 'Admission No' }, { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' }, { key: 'class_name', label: 'Class' },
      { key: 'section_name', label: 'Section' }, { key: 'gender', label: 'Gender' },
      { key: 'dob', label: 'DOB' }, { key: 'status', label: 'Status' },
      { key: 'guardian_name', label: 'Guardian' }, { key: 'guardian_phone', label: 'Guardian Phone' }
    ]);
  }
  res.json({ students: rows });
}

async function teachersReport(req, res) {
  const [rows] = await db.query(
    `SELECT u.name, u.username, u.email, u.phone, t.joining_date, t.status
     FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.school_id = ? ORDER BY u.name`,
    [req.schoolId]
  );
  if (req.query.format === 'csv') {
    return sendCsv(res, 'teachers.csv', rows, [
      { key: 'name', label: 'Name' }, { key: 'username', label: 'Username' }, { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' }, { key: 'joining_date', label: 'Joining Date' }, { key: 'status', label: 'Status' }
    ]);
  }
  res.json({ teachers: rows });
}

async function paymentsReport(req, res) {
  const { from, to } = req.query;
  const where = ['p.school_id = ?'];
  const params = [req.schoolId];
  if (from) { where.push('p.payment_date >= ?'); params.push(from); }
  if (to) { where.push('p.payment_date <= ?'); params.push(to); }
  const [rows] = await db.query(
    `SELECT p.receipt_no, st.admission_no, st.first_name, st.last_name, p.amount, p.payment_date, p.method
     FROM payments p JOIN students st ON st.id = p.student_id WHERE ${where.join(' AND ')} ORDER BY p.payment_date DESC`,
    params
  );
  if (req.query.format === 'csv') {
    return sendCsv(res, 'payments.csv', rows, [
      { key: 'receipt_no', label: 'Receipt No' }, { key: 'admission_no', label: 'Admission No' },
      { key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' },
      { key: 'amount', label: 'Amount' }, { key: 'payment_date', label: 'Date' }, { key: 'method', label: 'Method' }
    ]);
  }
  res.json({ payments: rows });
}

module.exports = { studentsReport, teachersReport, paymentsReport };
