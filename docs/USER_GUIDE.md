# User Guide

All portals live at `http://localhost:4000`. Signing in redirects you
automatically to the right portal for your role — you never need to know
the URL yourself.

This is a deliberately simple system focused on daily school operations —
see the README's "Modules kept vs. removed" for what's in scope.

## Signing in

Go to `http://localhost:4000/login/` and enter your username and password.
The login page also lists clickable demo-account shortcuts that fill the
form for you.

## Full demo credential list

Every account below was created by `npm run db:setup` (see [README.md](../README.md)).

### Platform level

| Role | Username | Password |
|---|---|---|
| Platform Super Admin | `superadmin` | `SuperAdmin@123` |

### Sunrise Academy (`SUNA`)

| Role | Username | Password |
|---|---|---|
| School Admin | `admin.suna` | `SunA-Admin@123` |
| Teacher | `teacher1.suna` | `Teacher@123` |
| Teacher | `teacher2.suna` | `Teacher@123` |
| Accountant | `accountant.suna` | `Accountant@123` |

### Bright Future School (`BFS`)

Same layout, `.bfs` usernames, e.g. `admin.bfs` / `BFS-Admin@123`,
`teacher1.bfs` / `Teacher@123`.

Both schools also have 4 pre-loaded students each — see them under
Students once logged in as that school's admin.

> **Note:** each demo school still has legacy Student and Parent portal
> login accounts from before this product was simplified (e.g.
> `student.emma.suna` / `Student@123`, `parent.emma.suna` / `Parent@123`).
> Those logins still work, but self-service portals are no longer part of
> the primary sales demo or workflow — see "What happened to the Parent
> and Student portals?" below.

---

## Platform Super Admin

Sign in as `superadmin`. You land on a platform-wide **Dashboard**: total /
active / suspended schools, total students, total teachers, and the most
recently added schools. This is intentionally minimal — the Super Admin's
job is just to onboard and manage schools, not to run them.

### Adding a school

**Schools → + Add New School.** Fill in the school details (name, code,
logo, address, contact info, package, start date, notes) and the initial
School Admin account (name, email, username, password) in the same form.
Submitting:

1. creates the school,
2. creates its School Admin account bound to that school's id,
3. shows you the generated credentials **once**, in a dialog — copy them
   now, they cannot be retrieved again (only the bcrypt hash is stored).

### Managing an existing school

**Schools → View** opens a school's detail dialog with three tabs:

- **Details** — edit name/logo/address/contact/notes.
- **School Admins** — see all admin accounts for that school, activate/
  deactivate them, or create an additional admin account.
- **Package** — change the package tier (Basic/Standard/Premium).

**Suspend / Activate** (buttons on the Schools list) — suspending a school
blocks every user of that school from logging in until it's reactivated;
the Super Admin can still see and manage the school while suspended.

---

## School Admin

Sign in as e.g. `admin.suna`. The sidebar is deliberately short — 12 items
covering the daily-operations core:

- **Dashboard** — students/teachers/classes counts, today's attendance,
  this month's fee collections, outstanding fees, recent announcements.
- **Students** — search/filter by class, section, status or free text; add
  a student (name, class, section, gender, DOB, admission date, phone,
  parent/guardian name + phone, address, photo); view a full profile
  (attendance summary, fee balances, payment history, published results);
  edit; deactivate; **Import Excel/CSV** or **Export**.
- **Teachers** — add/edit/deactivate; assignments are made from Classes &
  Subjects.
- **Classes & Subjects** — three tabs: Classes & Sections, Subjects, and
  Subject-Teacher Assignment (pick a class, assign a teacher per subject).
- **Attendance** — Mark Attendance (pick class/section/date, click each
  student's status, Save — built to be quick on a phone) and Monthly
  Report (per-student present/absent/late/excused counts and percentage
  for a chosen month).
- **Fees** — Fee Types, Assign Fees (to a whole class at once), Outstanding
  Balances.
- **Payments** — record a payment (type-ahead student search), filter by
  date, download a PDF receipt, export CSV.
- **Exams & Results** — create an exam (pick a class, tick subjects, set
  max/pass marks), **Enter Marks** (a grid, one row per student), **Class
  Performance** (ranked table with a report-card PDF link per student),
  and **Publish/Unpublish** (students/parents only ever see a *published*
  exam's results and report card).
- **Announcements** — title/message, targeted to everyone, teachers,
  students, parents, or a specific class/section; add/edit/delete.
- **Reports** — Student list, Attendance, Payments, Unpaid Fees, Exam
  Results — CSV export where applicable.
- **Accounts** — every login in your school in one place: reset a
  password, activate/deactivate any account, and **+ Add Accountant** to
  create a new Accountant login (the one account-creation flow the old
  "Staff" module used to cover that Fees & Payments still depends on).
- **School Settings** — your own school's name, logo, address, phone,
  email, currency, academic year. (Package tier is Super-Admin-controlled,
  shown here read-only.)

## Excel/CSV student import — step by step

1. **Students → Import Excel/CSV.**
2. Upload a `.csv`, `.xlsx`, or `.xls` file. Required column: `first_name`.
   Optional columns: `admission_no`, `last_name`, `class_name`,
   `section_name`, `gender`, `dob`, `admission_date`, `phone`,
   `guardian_name`, `guardian_phone`, `address`. (`class_name`/
   `section_name` must match existing classes/sections in your school
   exactly, or that row is flagged with an error.)
3. The system parses the file and shows a **preview**: total rows, how
   many are valid, how many have errors, how many are duplicates (matched
   by `admission_no` against existing students and other rows in the same
   file).
4. Click **Import N Valid Rows** — only valid, non-duplicate rows are
   written. Rows without an `admission_no` get one generated automatically
   (`SCHOOLCODE-YEAR-NNNN`).
5. You get a summary: *Imported X, Skipped Y, Errors Z*.

## Data migration from an existing system

If a school is moving from spreadsheets or another system, reshape their
existing records into the column layout above (most spreadsheet tools can
export to CSV) and use the importer. This is not a one-click migration of
*every* legacy system — a school with a genuinely different data model may
need a one-time manual mapping pass before their data fits these columns.

---

## Teacher

Sign in as e.g. `teacher1.suna`.

- **Dashboard** — how many classes/subjects you're assigned to, how many
  sections you're the class teacher of, recent announcements.
- **My Classes** — the classes you're the class teacher of, and your
  subject assignments.
- **Attendance** — mark daily attendance for any class/section (same
  simple tap-to-set-status flow as School Admin's).
- **Marks Entry** — pick an exam, enter marks for every student in one
  grid, Save.
- **Announcements** — everything targeted to you (everyone/teachers).

## Accountant

Sign in as e.g. `accountant.suna`. A focused subset of School Admin's
financial tools: Dashboard (collections/outstanding), Fees (assign to a
class, view outstanding, view fee types), Payments (record + receipts),
and Reports (students/payments CSV).

## What happened to the Parent and Student portals, Timetable, Staff, Website?

The product was intentionally simplified to stay easy to demo and sell —
see the README's "Modules kept vs. removed". Those features weren't
deleted (their routes, controllers, and database tables still exist and
still work), they're just no longer created or linked from the School
Admin's day-to-day workflow:

- The Add Student form no longer offers to create a student-portal or
  parent-portal login — just the student record itself.
- The "Staff" module (reception/security/cleaner/driver + Accountant
  logins) is gone from the sidebar; the one piece of it still needed day
  to day — creating an **Accountant** login — now lives as a single button
  on the **Accounts** page.
- Timetable and Income/Expenses accounting are out of the sidebar
  everywhere (School Admin, Teacher, Accountant).
- Website management is out of the School Admin sidebar; a school's public
  site (if it already has one from before this simplification) still
  renders at `/website/?school=CODE`, but isn't editable from here — a
  full website builder is planned as a separate future product, not part
  of this one.

If a school genuinely needs one of these, the underlying code is still in
the repository and can be re-linked into navigation without rebuilding it.
