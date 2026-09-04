const db = require('../config/db');

async function listRecords(req, res) {
  const { type, from, to } = req.query;
  const where = ['school_id = ?'];
  const params = [req.schoolId];
  if (type) { where.push('type = ?'); params.push(type); }
  if (from) { where.push('record_date >= ?'); params.push(from); }
  if (to) { where.push('record_date <= ?'); params.push(to); }

  const [rows] = await db.query(
    `SELECT * FROM finance_records WHERE ${where.join(' AND ')} ORDER BY record_date DESC, id DESC`,
    params
  );
  res.json({ records: rows });
}

async function createRecord(req, res) {
  const { type, category, amount, recordDate, notes } = req.body;
  if (!['income', 'expense'].includes(type) || !category || !amount || !recordDate) {
    return res.status(400).json({ error: 'type, category, amount and recordDate are required' });
  }
  const [result] = await db.query(
    `INSERT INTO finance_records (school_id, type, category, amount, record_date, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.schoolId, type, category, amount, recordDate, notes || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
}

async function deleteRecord(req, res) {
  const [result] = await db.query('DELETE FROM finance_records WHERE id = ? AND school_id = ?', [req.params.id, req.schoolId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Record not found' });
  res.json({ ok: true });
}

async function monthlySummary(req, res) {
  const { year } = req.query;
  const y = year || new Date().getFullYear();

  const [expenseRows] = await db.query(
    `SELECT TO_CHAR(record_date, 'YYYY-MM') AS month, SUM(amount) AS total
     FROM finance_records WHERE school_id = ? AND type = 'expense' AND EXTRACT(YEAR FROM record_date) = ? GROUP BY month`,
    [req.schoolId, y]
  );
  const [manualIncomeRows] = await db.query(
    `SELECT TO_CHAR(record_date, 'YYYY-MM') AS month, SUM(amount) AS total
     FROM finance_records WHERE school_id = ? AND type = 'income' AND EXTRACT(YEAR FROM record_date) = ? GROUP BY month`,
    [req.schoolId, y]
  );
  const [feePaymentRows] = await db.query(
    `SELECT TO_CHAR(payment_date, 'YYYY-MM') AS month, SUM(amount) AS total
     FROM payments WHERE school_id = ? AND EXTRACT(YEAR FROM payment_date) = ? GROUP BY month`,
    [req.schoolId, y]
  );

  const months = {};
  for (const r of manualIncomeRows) months[r.month] = { month: r.month, income: Number(r.total), feeCollections: 0, expenses: 0 };
  for (const r of feePaymentRows) {
    months[r.month] = months[r.month] || { month: r.month, income: 0, feeCollections: 0, expenses: 0 };
    months[r.month].feeCollections = Number(r.total);
  }
  for (const r of expenseRows) {
    months[r.month] = months[r.month] || { month: r.month, income: 0, feeCollections: 0, expenses: 0 };
    months[r.month].expenses = Number(r.total);
  }
  const summary = Object.values(months)
    .map(m => ({ ...m, balance: m.income + m.feeCollections - m.expenses }))
    .sort((a, b) => a.month.localeCompare(b.month));

  res.json({ year: y, summary });
}

module.exports = { listRecords, createRecord, deleteRecord, monthlySummary };
