const db = require('../config/db');
const { renderReceiptPdf } = require('../utils/pdf');

function generateReceiptNo() {
  return `RCPT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}

async function recordPayment(req, res) {
  const { studentId, studentFeeId, amount, paymentDate, method, notes } = req.body;
  if (!studentId || !amount || !paymentDate) {
    return res.status(400).json({ error: 'studentId, amount and paymentDate are required' });
  }
  const [student] = await db.query('SELECT id FROM students WHERE id = ? AND school_id = ?', [studentId, req.schoolId]);
  if (!student[0]) return res.status(404).json({ error: 'Student not found' });

  const validMethods = ['cash', 'card', 'bank_transfer', 'mobile_money', 'other'];
  const receiptNo = generateReceiptNo();

  const [result] = await db.query(
    `INSERT INTO payments (school_id, student_id, student_fee_id, amount, payment_date, method, receipt_no, recorded_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.schoolId, studentId, studentFeeId || null, amount, paymentDate, validMethods.includes(method) ? method : 'cash', receiptNo, req.user.id, notes || null]
  );
  res.status(201).json({ id: result.insertId, receiptNo });
}

async function listPayments(req, res) {
  const { studentId, from, to, method, page = 1, pageSize = 25 } = req.query;
  const where = ['p.school_id = ?'];
  const params = [req.schoolId];
  if (studentId) { where.push('p.student_id = ?'); params.push(studentId); }
  if (from) { where.push('p.payment_date >= ?'); params.push(from); }
  if (to) { where.push('p.payment_date <= ?'); params.push(to); }
  if (method) { where.push('p.method = ?'); params.push(method); }

  const whereSql = where.join(' AND ');
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM payments p WHERE ${whereSql}`, params);
  const limit = Math.min(Number(pageSize) || 25, 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [rows] = await db.query(
    `SELECT p.*, st.first_name, st.last_name, st.admission_no
     FROM payments p JOIN students st ON st.id = p.student_id
     WHERE ${whereSql} ORDER BY p.payment_date DESC, p.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  res.json({ payments: rows, total, page: Number(page), pageSize: limit });
}

async function getReceipt(req, res) {
  const [rows] = await db.query(
    `SELECT p.*, st.first_name, st.last_name, st.admission_no, s.name AS school_name, s.logo, s.currency, s.address
     FROM payments p
     JOIN students st ON st.id = p.student_id
     JOIN schools s ON s.id = p.school_id
     WHERE p.id = ? AND p.school_id = ?`,
    [req.params.id, req.schoolId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found' });
  res.json({ receipt: rows[0] });
}

async function getReceiptPdf(req, res) {
  const [rows] = await db.query(
    `SELECT p.*, st.first_name, st.last_name, st.admission_no, s.name AS school_name, s.currency, s.address
     FROM payments p JOIN students st ON st.id = p.student_id JOIN schools s ON s.id = p.school_id
     WHERE p.id = ? AND p.school_id = ?`,
    [req.params.id, req.schoolId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found' });
  renderReceiptPdf(res, rows[0]);
}

async function monthlyCollections(req, res) {
  const { year } = req.query;
  const y = year || new Date().getFullYear();
  const [rows] = await db.query(
    `SELECT TO_CHAR(payment_date, 'YYYY-MM') AS month, SUM(amount) AS total
     FROM payments WHERE school_id = ? AND EXTRACT(YEAR FROM payment_date) = ?
     GROUP BY month ORDER BY month`,
    [req.schoolId, y]
  );
  res.json({ year: y, collections: rows });
}

module.exports = { recordPayment, listPayments, getReceipt, getReceiptPdf, monthlyCollections };
