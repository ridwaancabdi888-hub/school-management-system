const XLSX = require('xlsx');
const db = require('../config/db');
const { generateAdmissionNo } = require('./studentController');

const REQUIRED_COLUMNS = ['first_name'];
const KNOWN_COLUMNS = [
  'admission_no', 'first_name', 'last_name', 'class_name', 'section_name',
  'gender', 'dob', 'admission_date', 'phone', 'guardian_name', 'guardian_phone', 'address'
];

function readRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// Step 1: upload + validate + preview (no writes to the database yet).
async function previewStudentImport(req, res) {
  if (!req.file) return res.status(400).json({ error: 'A CSV or Excel file is required' });

  let rawRows;
  try {
    rawRows = readRows(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read the uploaded file. Please upload a valid CSV or Excel file.' });
  }

  if (!rawRows.length) return res.status(400).json({ error: 'The file has no data rows' });

  const fileColumns = Object.keys(rawRows[0]).map(c => c.trim().toLowerCase());
  const missingRequired = REQUIRED_COLUMNS.filter(c => !fileColumns.includes(c));
  if (missingRequired.length) {
    return res.status(400).json({ error: `Missing required column(s): ${missingRequired.join(', ')}` });
  }

  const [classes] = await db.query('SELECT id, name FROM classes WHERE school_id = ?', [req.schoolId]);
  const classByName = new Map(classes.map(c => [c.name.toLowerCase(), c.id]));
  const [sections] = await db.query('SELECT id, name, class_id FROM sections WHERE school_id = ?', [req.schoolId]);

  const [existingAdmissionNos] = await db.query('SELECT admission_no FROM students WHERE school_id = ?', [req.schoolId]);
  const existingSet = new Set(existingAdmissionNos.map(r => r.admission_no.toLowerCase()));
  const seenInFile = new Set();

  const preview = rawRows.map((raw, idx) => {
    const row = {};
    for (const key of KNOWN_COLUMNS) {
      const matchKey = Object.keys(raw).find(k => k.trim().toLowerCase() === key);
      row[key] = matchKey ? String(raw[matchKey]).trim() : '';
    }

    const errors = [];
    if (!row.first_name) errors.push('first_name is required');

    let classId = null;
    if (row.class_name) {
      classId = classByName.get(row.class_name.toLowerCase());
      if (!classId) errors.push(`Unknown class "${row.class_name}"`);
    }
    let sectionId = null;
    if (row.section_name) {
      const sec = sections.find(s => s.name.toLowerCase() === row.section_name.toLowerCase() && (!classId || s.class_id === classId));
      if (!sec) errors.push(`Unknown section "${row.section_name}"`);
      else sectionId = sec.id;
    }

    let duplicate = false;
    if (row.admission_no) {
      const key = row.admission_no.toLowerCase();
      if (existingSet.has(key) || seenInFile.has(key)) duplicate = true;
      seenInFile.add(key);
    }

    return { rowNumber: idx + 2, data: row, classId, sectionId, errors, duplicate, valid: errors.length === 0 && !duplicate };
  });

  res.json({
    totalRows: preview.length,
    validCount: preview.filter(r => r.valid).length,
    errorCount: preview.filter(r => r.errors.length).length,
    duplicateCount: preview.filter(r => r.duplicate).length,
    rows: preview
  });
}

// Step 2: commit only the rows the client marked valid in the preview step.
async function commitStudentImport(req, res) {
  const { rows } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows[] is required' });

  let imported = 0;
  let skipped = 0;
  const errors = [];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const row of rows) {
      if (!row.valid || !row.data || !row.data.first_name) { skipped++; continue; }
      const data = row.data;
      try {
        const admissionNo = data.admission_no || await generateAdmissionNo(req.schoolId, conn);
        const [dupe] = await conn.query('SELECT id FROM students WHERE school_id = ? AND admission_no = ?', [req.schoolId, admissionNo]);
        if (dupe.length) { skipped++; continue; }

        await conn.query(
          `INSERT INTO students (school_id, admission_no, first_name, last_name, class_id, section_id,
             gender, dob, admission_date, phone, guardian_name, guardian_phone, address, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            req.schoolId, admissionNo, data.first_name, data.last_name || null, row.classId || null, row.sectionId || null,
            ['male', 'female', 'other'].includes((data.gender || '').toLowerCase()) ? data.gender.toLowerCase() : null,
            data.dob || null, data.admission_date || null, data.phone || null, data.guardian_name || null, data.guardian_phone || null, data.address || null
          ]
        );
        imported++;
      } catch (err) {
        skipped++;
        errors.push({ row: row.rowNumber, message: err.message });
      }
    }
    await conn.commit();
    res.json({ imported, skipped, errors: errors.length, errorDetails: errors });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function exportStudentsExcel(req, res) {
  const [rows] = await db.query(
    `SELECT st.admission_no, st.first_name, st.last_name, c.name AS class_name, sec.name AS section_name,
            st.gender, st.dob, st.admission_date, st.phone, st.guardian_name, st.guardian_phone, st.address, st.status
     FROM students st LEFT JOIN classes c ON c.id = st.class_id LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.school_id = ? ORDER BY st.first_name`,
    [req.schoolId]
  );
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="students.xlsx"');
  res.send(buffer);
}

module.exports = { previewStudentImport, commitStudentImport, exportStudentsExcel };
