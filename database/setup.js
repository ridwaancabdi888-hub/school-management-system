// Creates the schema and loads demo data for two isolated schools.
// Run with: npm run db:setup:mysql-legacy (needs `npm install mysql2`
// first — that dependency was removed once Postgres became the one
// production database layer; this MySQL path is kept for reference only)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const hash = (plain) => bcrypt.hashSync(plain, 10);

async function run() {
  const admin = await mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
    multipleStatements: true
  });

  console.log('Applying schema...');
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await admin.query(schemaSql);
  await admin.end();

  const db = await mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
    database: env.db.database, multipleStatements: false
  });

  console.log('Seeding platform super admin...');
  await db.query(
    `INSERT INTO users (school_id, role, name, username, email, password_hash, status)
     VALUES (NULL, 'super_admin', ?, ?, ?, ?, 'active')`,
    [env.superAdmin.name, env.superAdmin.username, env.superAdmin.email, hash(env.superAdmin.password)]
  );

  const schoolDefs = [
    {
      name: 'Sunrise Academy', code: 'SUNA', city: 'Springfield', phone: '+1-555-0101', email: 'info@sunriseacademy.example',
      websiteEnabled: true, brandColor: '#2563eb', currency: 'USD',
      admin: { name: 'Alice Morgan', username: 'admin.suna', email: 'alice@sunriseacademy.example', password: 'SunA-Admin@123' }
    },
    {
      name: 'Bright Future School', code: 'BFS', city: 'Rivertown', phone: '+1-555-0202', email: 'info@brightfuture.example',
      websiteEnabled: false, brandColor: '#16a34a', currency: 'USD',
      admin: { name: 'Brian Kelso', username: 'admin.bfs', email: 'brian@brightfuture.example', password: 'BFS-Admin@123' }
    }
  ];

  const credentials = [];

  for (const def of schoolDefs) {
    console.log(`Seeding school: ${def.name}...`);
    const [schoolResult] = await db.query(
      `INSERT INTO schools (name, code, city, phone, email, status, package, website_enabled, brand_color, currency, academic_year, start_date)
       VALUES (?, ?, ?, ?, ?, 'active', 'standard', ?, ?, ?, '2025-2026', CURDATE())`,
      [def.name, def.code, def.city, def.phone, def.email, def.websiteEnabled ? 1 : 0, def.brandColor, def.currency]
    );
    const schoolId = schoolResult.insertId;

    const [adminResult] = await db.query(
      `INSERT INTO users (school_id, role, name, username, email, password_hash, status)
       VALUES (?, 'school_admin', ?, ?, ?, ?, 'active')`,
      [schoolId, def.admin.name, def.admin.username, def.admin.email, hash(def.admin.password)]
    );
    credentials.push({ school: def.name, role: 'School Admin', username: def.admin.username, password: def.admin.password });

    // Classes & sections
    const classIds = {};
    for (const className of ['Grade 1', 'Grade 2']) {
      const [c] = await db.query('INSERT INTO classes (school_id, name, academic_year) VALUES (?, ?, ?)', [schoolId, className, '2025-2026']);
      classIds[className] = c.insertId;
    }
    const sectionIds = {};
    for (const className of Object.keys(classIds)) {
      for (const secName of ['A', 'B']) {
        const [s] = await db.query('INSERT INTO sections (school_id, class_id, name) VALUES (?, ?, ?)', [schoolId, classIds[className], secName]);
        sectionIds[`${className}-${secName}`] = s.insertId;
      }
    }

    // Subjects
    const subjectIds = {};
    for (const subjName of ['Mathematics', 'English', 'Science']) {
      const [s] = await db.query('INSERT INTO subjects (school_id, name) VALUES (?, ?)', [schoolId, subjName]);
      subjectIds[subjName] = s.insertId;
    }

    // Teachers
    const teacherUsers = [
      { name: `${def.code} Teacher One`, username: `teacher1.${def.code.toLowerCase()}` },
      { name: `${def.code} Teacher Two`, username: `teacher2.${def.code.toLowerCase()}` }
    ];
    const teacherIds = [];
    for (const t of teacherUsers) {
      const password = 'Teacher@123';
      const [u] = await db.query(
        `INSERT INTO users (school_id, role, name, username, password_hash, status) VALUES (?, 'teacher', ?, ?, ?, 'active')`,
        [schoolId, t.name, t.username, hash(password)]
      );
      const [te] = await db.query(`INSERT INTO teachers (school_id, user_id, joining_date, status) VALUES (?, ?, CURDATE(), 'active')`, [schoolId, u.insertId]);
      teacherIds.push(te.insertId);
      credentials.push({ school: def.name, role: 'Teacher', username: t.username, password });
    }

    // Class teachers + subject assignments
    await db.query('UPDATE sections SET class_teacher_id = ? WHERE id = ?', [teacherIds[0], sectionIds['Grade 1-A']]);
    await db.query('UPDATE sections SET class_teacher_id = ? WHERE id = ?', [teacherIds[1], sectionIds['Grade 2-A']]);
    for (const className of Object.keys(classIds)) {
      let i = 0;
      for (const subjName of Object.keys(subjectIds)) {
        await db.query(
          `INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id) VALUES (?, ?, ?, ?)`,
          [schoolId, classIds[className], subjectIds[subjName], teacherIds[i % teacherIds.length]]
        );
        i++;
      }
    }

    // Fee types
    const feeTypeIds = {};
    for (const [name, category] of [['Tuition Fee', 'tuition'], ['Registration Fee', 'registration'], ['Transport Fee', 'transport']]) {
      const [f] = await db.query('INSERT INTO fee_types (school_id, name, category) VALUES (?, ?, ?)', [schoolId, name, category]);
      feeTypeIds[name] = f.insertId;
    }

    // Accountant + staff
    {
      const password = 'Accountant@123';
      const [u] = await db.query(
        `INSERT INTO users (school_id, role, name, username, password_hash, status) VALUES (?, 'accountant', ?, ?, ?, 'active')`,
        [schoolId, `${def.code} Accountant`, `accountant.${def.code.toLowerCase()}`, hash(password)]
      );
      await db.query(`INSERT INTO staff (school_id, user_id, designation, joining_date, status) VALUES (?, ?, 'accountant', CURDATE(), 'active')`, [schoolId, u.insertId]);
      credentials.push({ school: def.name, role: 'Accountant', username: `accountant.${def.code.toLowerCase()}`, password });
    }
    {
      const password = 'Staff@123';
      const [u] = await db.query(
        `INSERT INTO users (school_id, role, name, username, password_hash, status) VALUES (?, 'staff', ?, ?, ?, 'active')`,
        [schoolId, `${def.code} Receptionist`, `staff.${def.code.toLowerCase()}`, hash(password)]
      );
      await db.query(`INSERT INTO staff (school_id, user_id, designation, joining_date, status) VALUES (?, ?, 'reception', CURDATE(), 'active')`, [schoolId, u.insertId]);
    }

    // Exam
    const [examResult] = await db.query(
      `INSERT INTO exams (school_id, name, term, academic_year, class_id, status) VALUES (?, 'Mid-Term Exam', 'Term 1', '2025-2026', ?, 'published')`,
      [schoolId, classIds['Grade 1']]
    );
    const examId = examResult.insertId;
    const examSubjectIds = {};
    for (const subjName of Object.keys(subjectIds)) {
      const [es] = await db.query(
        `INSERT INTO exam_subjects (school_id, exam_id, subject_id, max_marks, pass_marks) VALUES (?, ?, ?, 100, 40)`,
        [schoolId, examId, subjectIds[subjName]]
      );
      examSubjectIds[subjName] = es.insertId;
    }

    // Students (+ parents, attendance, fees, payments, results) — all in Grade 1-A
    const studentDefs = [
      { first: 'Emma', last: 'Johnson', gender: 'female' },
      { first: 'Liam', last: 'Smith', gender: 'male' },
      { first: 'Olivia', last: 'Brown', gender: 'female' },
      { first: 'Noah', last: 'Davis', gender: 'male' }
    ];
    let seq = 1;
    for (const s of studentDefs) {
      const admissionNo = `${def.code}-2025-${String(seq).padStart(4, '0')}`;
      seq++;
      const studentUsername = `student.${s.first.toLowerCase()}.${def.code.toLowerCase()}`;
      const studentPassword = 'Student@123';
      const [studentUser] = await db.query(
        `INSERT INTO users (school_id, role, name, username, password_hash, status) VALUES (?, 'student', ?, ?, ?, 'active')`,
        [schoolId, `${s.first} ${s.last}`, studentUsername, hash(studentPassword)]
      );
      const [studentRow] = await db.query(
        `INSERT INTO students (school_id, user_id, admission_no, first_name, last_name, class_id, section_id, gender, dob, admission_date, phone, guardian_name, guardian_phone, address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2017-04-12', CURDATE(), ?, ?, '+1-555-0999', '123 Main St', 'active')`,
        [schoolId, studentUser.insertId, admissionNo, s.first, s.last, classIds['Grade 1'], sectionIds['Grade 1-A'], s.gender, `+1-555-01${String(seq).padStart(2, '0')}`, `${s.first} Guardian`]
      );
      const studentId = studentRow.insertId;
      credentials.push({ school: def.name, role: 'Student', username: studentUsername, password: studentPassword });

      // Parent account
      const parentUsername = `parent.${s.first.toLowerCase()}.${def.code.toLowerCase()}`;
      const parentPassword = 'Parent@123';
      const [parentUser] = await db.query(
        `INSERT INTO users (school_id, role, name, username, password_hash, status) VALUES (?, 'parent', ?, ?, ?, 'active')`,
        [schoolId, `${s.first} Guardian`, parentUsername, hash(parentPassword)]
      );
      await db.query(`INSERT INTO student_guardians (school_id, student_id, parent_user_id, relationship) VALUES (?, ?, ?, 'Parent')`, [schoolId, studentId, parentUser.insertId]);
      credentials.push({ school: def.name, role: 'Parent', username: parentUsername, password: parentPassword });

      // Attendance — last 5 school days
      for (let d = 0; d < 5; d++) {
        const status = d === 1 && s.first === 'Noah' ? 'absent' : 'present';
        await db.query(
          `INSERT INTO attendance (school_id, student_id, class_id, section_id, date, status, marked_by)
           VALUES (?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?)`,
          [schoolId, studentId, classIds['Grade 1'], sectionIds['Grade 1-A'], d, status, adminResult.insertId]
        );
      }

      // Fees + a partial payment
      const [sf] = await db.query(
        `INSERT INTO student_fees (school_id, student_id, fee_type_id, academic_year, amount_required, due_date)
         VALUES (?, ?, ?, '2025-2026', 500.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
        [schoolId, studentId, feeTypeIds['Tuition Fee']]
      );
      await db.query(
        `INSERT INTO payments (school_id, student_id, student_fee_id, amount, payment_date, method, receipt_no, recorded_by)
         VALUES (?, ?, ?, 300.00, CURDATE(), 'cash', ?, ?)`,
        [schoolId, studentId, sf.insertId, `RCPT-${def.code}-${studentId}`, adminResult.insertId]
      );

      // Results for the published exam
      let markBase = 60 + seq * 5;
      for (const subjName of Object.keys(subjectIds)) {
        await db.query(
          `INSERT INTO results (school_id, exam_id, student_id, exam_subject_id, marks_obtained, entered_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [schoolId, examId, studentId, examSubjectIds[subjName], Math.min(markBase, 98), teacherIds[0]]
        );
        markBase += 3;
      }
    }

    // Timetable
    const days = ['Monday', 'Tuesday', 'Wednesday'];
    let ti = 0;
    for (const day of days) {
      for (const subjName of Object.keys(subjectIds)) {
        const startHour = 8 + ti % 3;
        await db.query(
          `INSERT INTO timetable (school_id, class_id, section_id, day, start_time, end_time, subject_id, teacher_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [schoolId, classIds['Grade 1'], sectionIds['Grade 1-A'], day, `${startHour}:00:00`, `${startHour + 1}:00:00`, subjectIds[subjName], teacherIds[ti % teacherIds.length]]
        );
        ti++;
      }
    }

    // Announcements
    await db.query(
      `INSERT INTO announcements (school_id, title, body, target, created_by) VALUES (?, ?, ?, 'everyone', ?)`,
      [schoolId, 'Welcome to the new term', `Welcome back to ${def.name}! We wish all students a great academic year.`, adminResult.insertId]
    );
    await db.query(
      `INSERT INTO announcements (school_id, title, body, target, created_by) VALUES (?, ?, ?, 'parents', ?)`,
      [schoolId, 'Parent-Teacher Meeting', 'A parent-teacher meeting is scheduled for next Friday at 4 PM.', adminResult.insertId]
    );

    // Finance
    await db.query(`INSERT INTO finance_records (school_id, type, category, amount, record_date, recorded_by) VALUES (?, 'expense', 'Utilities', 250.00, CURDATE(), ?)`, [schoolId, adminResult.insertId]);
    await db.query(`INSERT INTO finance_records (school_id, type, category, amount, record_date, recorded_by) VALUES (?, 'income', 'Donation', 1000.00, CURDATE(), ?)`, [schoolId, adminResult.insertId]);

    // Website content (only meaningfully used when website_enabled = 1)
    await db.query(
      `INSERT INTO website_content (school_id, hero_title, hero_text, about_text, contact_email, contact_phone, contact_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, def.name, 'Nurturing tomorrow\'s leaders, today.', `${def.name} is committed to academic excellence and character development.`, def.email, def.phone, `${def.city}`]
    );
    if (def.websiteEnabled) {
      await db.query(`INSERT INTO website_news (school_id, title, body) VALUES (?, 'Admissions Open for 2026', 'We are now accepting applications for the upcoming academic year.')`, [schoolId]);
      await db.query(
        `INSERT INTO admission_applications (school_id, student_name, dob, gender, applying_class, parent_name, phone, email, address)
         VALUES (?, 'Sample Applicant', '2018-01-01', 'female', 'Grade 1', 'Sample Parent', '+1-555-0303', 'sample@example.com', '99 Elm St')`,
        [schoolId]
      );
    }
  }

  await db.end();

  console.log('\n=== Seed complete ===');
  console.log(`Super Admin: username="${env.superAdmin.username}" password="${env.superAdmin.password}"`);
  console.log('\nPer-school demo accounts:');
  for (const c of credentials) {
    console.log(`  [${c.school}] ${c.role}: username="${c.username}" password="${c.password}"`);
  }
  console.log('\nSee docs/USER_GUIDE.md and README.md for the full credential table.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
