-- ============================================================
-- School Management System — Multi-Tenant Schema
-- Every school-owned table carries school_id. Application code
-- NEVER trusts a school_id supplied by the client — it always
-- comes from the authenticated user's session (see middleware/tenant.js).
-- ============================================================

CREATE DATABASE IF NOT EXISTS school_management_system
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE school_management_system;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- SCHOOLS (tenants)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS schools;
CREATE TABLE schools (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  logo VARCHAR(255) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  package ENUM('basic','standard','premium') NOT NULL DEFAULT 'basic',
  website_enabled TINYINT(1) NOT NULL DEFAULT 0,
  brand_color VARCHAR(20) DEFAULT '#2563eb',
  currency VARCHAR(10) DEFAULT 'USD',
  academic_year VARCHAR(20) DEFAULT NULL,
  report_card_header TEXT DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- USERS (all roles, incl. platform super admin with school_id = NULL)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT DEFAULT NULL,
  role ENUM('super_admin','school_admin','teacher','student','parent','accountant','staff') NOT NULL,
  name VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  photo VARCHAR(255) DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  UNIQUE KEY uq_username_per_school (school_id, username)
) ENGINE=InnoDB;

CREATE INDEX idx_users_school_role ON users(school_id, role);

-- ------------------------------------------------------------
-- ACADEMIC STRUCTURE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS classes;
CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  academic_year VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_classes_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_classes_school ON classes(school_id);

DROP TABLE IF EXISTS sections;
CREATE TABLE sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  class_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  class_teacher_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sections_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_sections_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_sections_school ON sections(school_id);

DROP TABLE IF EXISTS subjects;
CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subjects_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_subjects_school ON subjects(school_id);

DROP TABLE IF EXISTS class_subjects;
CREATE TABLE class_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  class_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT DEFAULT NULL,
  CONSTRAINT fk_cs_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_class_subject (class_id, subject_id)
) ENGINE=InnoDB;
CREATE INDEX idx_cs_school ON class_subjects(school_id);

-- ------------------------------------------------------------
-- PEOPLE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS teachers;
CREATE TABLE teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  user_id INT NOT NULL,
  joining_date DATE DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_teachers_school ON teachers(school_id);

ALTER TABLE sections
  ADD CONSTRAINT fk_sections_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE class_subjects
  ADD CONSTRAINT fk_cs_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

DROP TABLE IF EXISTS students;
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  admission_no VARCHAR(40) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) DEFAULT NULL,
  class_id INT DEFAULT NULL,
  section_id INT DEFAULT NULL,
  gender ENUM('male','female','other') DEFAULT NULL,
  dob DATE DEFAULT NULL,
  admission_date DATE DEFAULT NULL,
  photo VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  guardian_name VARCHAR(150) DEFAULT NULL,
  guardian_phone VARCHAR(30) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  CONSTRAINT fk_students_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
  UNIQUE KEY uq_admission_per_school (school_id, admission_no)
) ENGINE=InnoDB;
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(school_id, class_id, section_id);

DROP TABLE IF EXISTS student_guardians;
CREATE TABLE student_guardians (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  student_id INT NOT NULL,
  parent_user_id INT NOT NULL,
  relationship VARCHAR(50) DEFAULT 'Parent',
  CONSTRAINT fk_sg_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_sg_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_sg_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_student_parent (student_id, parent_user_id)
) ENGINE=InnoDB;
CREATE INDEX idx_sg_school ON student_guardians(school_id);

DROP TABLE IF EXISTS staff;
CREATE TABLE staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  user_id INT NOT NULL,
  designation ENUM('accountant','reception','security','cleaner','driver','other') NOT NULL DEFAULT 'other',
  joining_date DATE DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_staff_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_staff_school ON staff(school_id);

-- ------------------------------------------------------------
-- ATTENDANCE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS attendance;
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  student_id INT NOT NULL,
  class_id INT DEFAULT NULL,
  section_id INT DEFAULT NULL,
  date DATE NOT NULL,
  status ENUM('present','absent','late','excused') NOT NULL,
  marked_by INT DEFAULT NULL,
  remarks VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uq_att_student_date (student_id, date)
) ENGINE=InnoDB;
CREATE INDEX idx_att_school_date ON attendance(school_id, date);
CREATE INDEX idx_att_class ON attendance(school_id, class_id, section_id, date);

-- ------------------------------------------------------------
-- FEES / PAYMENTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS fee_types;
CREATE TABLE fee_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  category ENUM('tuition','registration','transport','exam','other') NOT NULL DEFAULT 'other',
  CONSTRAINT fk_ft_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_ft_school ON fee_types(school_id);

DROP TABLE IF EXISTS student_fees;
CREATE TABLE student_fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  student_id INT NOT NULL,
  fee_type_id INT NOT NULL,
  academic_year VARCHAR(20) DEFAULT NULL,
  amount_required DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sf_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_sf_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_sf_type FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_sf_school ON student_fees(school_id);
CREATE INDEX idx_sf_student ON student_fees(school_id, student_id);

DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  student_id INT NOT NULL,
  student_fee_id INT DEFAULT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  method ENUM('cash','card','bank_transfer','mobile_money','other') NOT NULL DEFAULT 'cash',
  receipt_no VARCHAR(40) NOT NULL,
  recorded_by INT DEFAULT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_fee FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE SET NULL,
  UNIQUE KEY uq_receipt_per_school (school_id, receipt_no)
) ENGINE=InnoDB;
CREATE INDEX idx_pay_school ON payments(school_id);
CREATE INDEX idx_pay_student ON payments(school_id, student_id);
CREATE INDEX idx_pay_date ON payments(school_id, payment_date);

-- ------------------------------------------------------------
-- EXAMS / RESULTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS exams;
CREATE TABLE exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  term VARCHAR(50) DEFAULT NULL,
  academic_year VARCHAR(20) DEFAULT NULL,
  class_id INT NOT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exams_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_exams_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_exams_school ON exams(school_id);

DROP TABLE IF EXISTS exam_subjects;
CREATE TABLE exam_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  exam_id INT NOT NULL,
  subject_id INT NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
  pass_marks DECIMAL(6,2) NOT NULL DEFAULT 40,
  CONSTRAINT fk_es_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_es_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT fk_es_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_exam_subject (exam_id, subject_id)
) ENGINE=InnoDB;
CREATE INDEX idx_es_school ON exam_subjects(school_id);

DROP TABLE IF EXISTS results;
CREATE TABLE results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  exam_subject_id INT NOT NULL,
  marks_obtained DECIMAL(6,2) DEFAULT NULL,
  teacher_comment VARCHAR(255) DEFAULT NULL,
  entered_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_examsubject FOREIGN KEY (exam_subject_id) REFERENCES exam_subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_result (exam_id, student_id, exam_subject_id)
) ENGINE=InnoDB;
CREATE INDEX idx_res_school ON results(school_id);
CREATE INDEX idx_res_student ON results(school_id, student_id);

-- ------------------------------------------------------------
-- TIMETABLE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS timetable;
CREATE TABLE timetable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  class_id INT NOT NULL,
  section_id INT DEFAULT NULL,
  day ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id INT DEFAULT NULL,
  teacher_id INT DEFAULT NULL,
  CONSTRAINT fk_tt_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_tt_school ON timetable(school_id);
CREATE INDEX idx_tt_class ON timetable(school_id, class_id, section_id);

-- ------------------------------------------------------------
-- ANNOUNCEMENTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS announcements;
CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  target ENUM('everyone','teachers','students','parents','class','section') NOT NULL DEFAULT 'everyone',
  class_id INT DEFAULT NULL,
  section_id INT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ann_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_ann_school ON announcements(school_id, created_at);

-- ------------------------------------------------------------
-- FINANCE (income / expenses, separate from fee payments)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS finance_records;
CREATE TABLE finance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  type ENUM('income','expense') NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  record_date DATE NOT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  recorded_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fin_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_fin_school ON finance_records(school_id, record_date);

-- ------------------------------------------------------------
-- OPTIONAL PUBLIC WEBSITE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS website_content;
CREATE TABLE website_content (
  school_id INT NOT NULL PRIMARY KEY,
  hero_title VARCHAR(200) DEFAULT NULL,
  hero_text TEXT DEFAULT NULL,
  about_text TEXT DEFAULT NULL,
  academics_text TEXT DEFAULT NULL,
  admissions_text TEXT DEFAULT NULL,
  contact_email VARCHAR(150) DEFAULT NULL,
  contact_phone VARCHAR(30) DEFAULT NULL,
  contact_address VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wc_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS website_news;
CREATE TABLE website_news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wn_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_wn_school ON website_news(school_id);

DROP TABLE IF EXISTS website_gallery;
CREATE TABLE website_gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  caption VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wg_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_wg_school ON website_gallery(school_id);

DROP TABLE IF EXISTS admission_applications;
CREATE TABLE admission_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_id INT NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  dob DATE DEFAULT NULL,
  gender ENUM('male','female','other') DEFAULT NULL,
  applying_class VARCHAR(80) DEFAULT NULL,
  parent_name VARCHAR(150) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  status ENUM('new','reviewed','accepted','rejected') NOT NULL DEFAULT 'new',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aa_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_aa_school ON admission_applications(school_id);

SET FOREIGN_KEY_CHECKS = 1;
