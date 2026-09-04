-- ============================================================
-- School Management System — Multi-Tenant Schema (PostgreSQL / Supabase)
-- Converted from database/schema.sql (MySQL). Every school-owned table
-- carries school_id. Application code NEVER trusts a school_id supplied
-- by the client — it always comes from the authenticated user's session
-- (see middleware/tenant.js).
--
-- Conversions from the MySQL original:
--   AUTO_INCREMENT          -> SERIAL
--   ENUM(...)                -> TEXT + CHECK (col IN (...))
--   TINYINT(1)                -> BOOLEAN
--   TIMESTAMP ... ON UPDATE   -> TIMESTAMPTZ + trigger (set_updated_at)
--   inline UNIQUE KEY name()  -> CONSTRAINT name UNIQUE(...)
--   ENGINE=InnoDB / charset   -> removed (not applicable)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- SCHOOLS (tenants)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS schools CASCADE;
CREATE TABLE schools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  logo VARCHAR(255) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  package TEXT NOT NULL DEFAULT 'basic' CHECK (package IN ('basic','standard','premium')),
  website_enabled BOOLEAN NOT NULL DEFAULT false,
  brand_color VARCHAR(20) DEFAULT '#2563eb',
  currency VARCHAR(10) DEFAULT 'USD',
  academic_year VARCHAR(20) DEFAULT NULL,
  report_card_header TEXT DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- USERS (all roles, incl. platform super admin with school_id = NULL)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  school_id INT DEFAULT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin','school_admin','teacher','student','parent','accountant','staff')),
  name VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  photo VARCHAR(255) DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_username_per_school UNIQUE (school_id, username)
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_users_school_role ON users(school_id, role);

-- ------------------------------------------------------------
-- ACADEMIC STRUCTURE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS classes CASCADE;
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  academic_year VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_classes_school ON classes(school_id);

DROP TABLE IF EXISTS sections CASCADE;
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  class_teacher_id INT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sections_school ON sections(school_id);

DROP TABLE IF EXISTS subjects CASCADE;
CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_subjects_school ON subjects(school_id);

DROP TABLE IF EXISTS class_subjects CASCADE;
CREATE TABLE class_subjects (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INT DEFAULT NULL,
  CONSTRAINT uq_class_subject UNIQUE (class_id, subject_id)
);
CREATE INDEX idx_cs_school ON class_subjects(school_id);

-- ------------------------------------------------------------
-- PEOPLE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS teachers CASCADE;
CREATE TABLE teachers (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joining_date DATE DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
);
CREATE INDEX idx_teachers_school ON teachers(school_id);

ALTER TABLE sections
  ADD CONSTRAINT fk_sections_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE class_subjects
  ADD CONSTRAINT fk_cs_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

DROP TABLE IF EXISTS students CASCADE;
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id INT DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  admission_no VARCHAR(40) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) DEFAULT NULL,
  class_id INT DEFAULT NULL REFERENCES classes(id) ON DELETE SET NULL,
  section_id INT DEFAULT NULL REFERENCES sections(id) ON DELETE SET NULL,
  gender TEXT DEFAULT NULL CHECK (gender IN ('male','female','other')),
  dob DATE DEFAULT NULL,
  admission_date DATE DEFAULT NULL,
  photo VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  guardian_name VARCHAR(150) DEFAULT NULL,
  guardian_phone VARCHAR(30) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_admission_per_school UNIQUE (school_id, admission_no)
);
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(school_id, class_id, section_id);

DROP TABLE IF EXISTS student_guardians CASCADE;
CREATE TABLE student_guardians (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship VARCHAR(50) DEFAULT 'Parent',
  CONSTRAINT uq_student_parent UNIQUE (student_id, parent_user_id)
);
CREATE INDEX idx_sg_school ON student_guardians(school_id);

DROP TABLE IF EXISTS staff CASCADE;
CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  designation TEXT NOT NULL DEFAULT 'other' CHECK (designation IN ('accountant','reception','security','cleaner','driver','other')),
  joining_date DATE DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
);
CREATE INDEX idx_staff_school ON staff(school_id);

-- ------------------------------------------------------------
-- ATTENDANCE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS attendance CASCADE;
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INT DEFAULT NULL,
  section_id INT DEFAULT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_by INT DEFAULT NULL,
  remarks VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_att_student_date UNIQUE (student_id, date)
);
CREATE INDEX idx_att_school_date ON attendance(school_id, date);
CREATE INDEX idx_att_class ON attendance(school_id, class_id, section_id, date);

-- ------------------------------------------------------------
-- FEES / PAYMENTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS fee_types CASCADE;
CREATE TABLE fee_types (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('tuition','registration','transport','exam','other'))
);
CREATE INDEX idx_ft_school ON fee_types(school_id);

DROP TABLE IF EXISTS student_fees CASCADE;
CREATE TABLE student_fees (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_type_id INT NOT NULL REFERENCES fee_types(id) ON DELETE CASCADE,
  academic_year VARCHAR(20) DEFAULT NULL,
  amount_required DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_date DATE DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sf_school ON student_fees(school_id);
CREATE INDEX idx_sf_student ON student_fees(school_id, student_id);

DROP TABLE IF EXISTS payments CASCADE;
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_fee_id INT DEFAULT NULL REFERENCES student_fees(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','card','bank_transfer','mobile_money','other')),
  receipt_no VARCHAR(40) NOT NULL,
  recorded_by INT DEFAULT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_receipt_per_school UNIQUE (school_id, receipt_no)
);
CREATE INDEX idx_pay_school ON payments(school_id);
CREATE INDEX idx_pay_student ON payments(school_id, student_id);
CREATE INDEX idx_pay_date ON payments(school_id, payment_date);

-- ------------------------------------------------------------
-- EXAMS / RESULTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS exams CASCADE;
CREATE TABLE exams (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  term VARCHAR(50) DEFAULT NULL,
  academic_year VARCHAR(20) DEFAULT NULL,
  class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_exams_school ON exams(school_id);

DROP TABLE IF EXISTS exam_subjects CASCADE;
CREATE TABLE exam_subjects (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
  pass_marks DECIMAL(6,2) NOT NULL DEFAULT 40,
  CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)
);
CREATE INDEX idx_es_school ON exam_subjects(school_id);

DROP TABLE IF EXISTS results CASCADE;
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_subject_id INT NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
  marks_obtained DECIMAL(6,2) DEFAULT NULL,
  teacher_comment VARCHAR(255) DEFAULT NULL,
  entered_by INT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_result UNIQUE (exam_id, student_id, exam_subject_id)
);
CREATE TRIGGER trg_results_updated_at BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_res_school ON results(school_id);
CREATE INDEX idx_res_student ON results(school_id, student_id);

-- ------------------------------------------------------------
-- TIMETABLE (kept internally — not part of the simplified UI)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS timetable CASCADE;
CREATE TABLE timetable (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id INT DEFAULT NULL,
  day TEXT NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id INT DEFAULT NULL,
  teacher_id INT DEFAULT NULL
);
CREATE INDEX idx_tt_school ON timetable(school_id);
CREATE INDEX idx_tt_class ON timetable(school_id, class_id, section_id);

-- ------------------------------------------------------------
-- ANNOUNCEMENTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS announcements CASCADE;
CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'everyone' CHECK (target IN ('everyone','teachers','students','parents','class','section')),
  class_id INT DEFAULT NULL,
  section_id INT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ann_school ON announcements(school_id, created_at);

-- ------------------------------------------------------------
-- FINANCE (income / expenses — kept internally, not part of the
-- simplified UI; see docs/USER_GUIDE.md)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS finance_records CASCADE;
CREATE TABLE finance_records (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  record_date DATE NOT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  recorded_by INT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_fin_school ON finance_records(school_id, record_date);

-- ------------------------------------------------------------
-- OPTIONAL PUBLIC WEBSITE (kept internally — not part of the
-- simplified School Admin navigation; see README "Modules kept vs removed")
-- ------------------------------------------------------------
DROP TABLE IF EXISTS website_content CASCADE;
CREATE TABLE website_content (
  school_id INT NOT NULL PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  hero_title VARCHAR(200) DEFAULT NULL,
  hero_text TEXT DEFAULT NULL,
  about_text TEXT DEFAULT NULL,
  academics_text TEXT DEFAULT NULL,
  admissions_text TEXT DEFAULT NULL,
  contact_email VARCHAR(150) DEFAULT NULL,
  contact_phone VARCHAR(30) DEFAULT NULL,
  contact_address VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trg_website_content_updated_at BEFORE UPDATE ON website_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TABLE IF EXISTS website_news CASCADE;
CREATE TABLE website_news (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_wn_school ON website_news(school_id);

DROP TABLE IF EXISTS website_gallery CASCADE;
CREATE TABLE website_gallery (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  image_path VARCHAR(255) NOT NULL,
  caption VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_wg_school ON website_gallery(school_id);

DROP TABLE IF EXISTS admission_applications CASCADE;
CREATE TABLE admission_applications (
  id SERIAL PRIMARY KEY,
  school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  dob DATE DEFAULT NULL,
  gender TEXT DEFAULT NULL CHECK (gender IN ('male','female','other')),
  applying_class VARCHAR(80) DEFAULT NULL,
  parent_name VARCHAR(150) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','accepted','rejected')),
  submitted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_aa_school ON admission_applications(school_id);
