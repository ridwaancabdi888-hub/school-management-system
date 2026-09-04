# Demo Script (3–4 minutes)

A sales walkthrough of the simplified platform, in order. Have `npm start`
running and a fresh `npm run db:setup` done beforehand. Open
`http://localhost:4000/login/` in a browser sized to a normal laptop
window, with a phone or narrow browser window ready for the mobile beat.

The pitch: **not** a bloated ERP — the handful of things a school actually
does every day, done well, on any device.

---

### 1. Platform Super Admin (30s)

Log in as `superadmin` / `SuperAdmin@123`.

> "This is the view I get as the platform owner. One dashboard, every
> school I've sold this to." — point at Total Schools, Active/Suspended,
> Total Students, Total Teachers.

Click **Schools**. "Here are the two schools already on the platform —
Sunrise Academy and Bright Future School. Completely separate data, same
platform."

### 2. Create a school live (30s)

Click **+ Add New School**. Fill quickly:

- School Name: `Lincoln Prep`
- School Code: `LPREP`
- Admin Name / Username / Password: `Jane Cole` / `admin.lprep` / `Demo@123`

Submit. "That's it — the school exists, and its admin account was created
in the same step." The credentials dialog appears: "These are shown once,
right here, and never again — only a secure hash is stored."

### 3. Switch to a School Admin (20s)

Log out, log in as `admin.suna` / `SunA-Admin@123`.

> "Now I'm Alice, the admin at Sunrise Academy. Everything here is scoped
> to her school only — and notice the sidebar: twelve items. Nothing to
> get lost in."

Dashboard: students/teachers/classes/today's attendance/collections/
outstanding fees.

### 4. Students (25s)

Click **Students**. Show the roster, search for "Emma", open her profile
— "Full history: attendance, fees, payments, results, all in one place."
Click **+ Add Student** briefly — "name, class, phone, guardian, done. No
extra accounts to configure while you're enrolling a kid" — then close it
without submitting. Point at **Import Excel/CSV** — "and a school moving
off spreadsheets just uploads a CSV instead of retyping four hundred
students."

### 5. Attendance (25s)

Click **Attendance**. Pick Grade 1 / Section A, today's date, **Load
Students**. "One tap per student, Save — that's a whole class marked in
under thirty seconds. This is the thing teachers open every single
morning, so it had to be effortless."

### 6. Payments (25s)

Click **Payments → + Record Payment**. Type "Liam" in the student search,
pick him, enter an amount, **Record Payment**. "Receipt number generated
automatically, downloadable as a PDF for the parent. No accounting
degree required."

### 7. Results (20s)

Click **Exams & Results**. Point at the Mid-Term Exam, already
**Published**. "Enter marks in a grid, publish when ready — unpublished
exams are invisible to anyone outside the staff, so nothing goes out
before it's final."

### 8. Announcements & Reports (15s)

Click **Announcements** — "post to everyone, or just one class." Click
**Reports** — "student list, attendance, payments, unpaid fees, exam
results — the five reports a school actually pulls, as a CSV in one
click."

### 9. Mobile view (25s)

Resize the browser to a phone width (or switch to the phone). Log in
again as `admin.suna` on the narrow view. "Same system, same data, a
hamburger menu instead of a sidebar — nothing was rebuilt for mobile,
it's the same app, and attendance especially is built to be run from a
phone in the classroom."

### 10. Data migration (10s)

Mention: "Existing school data comes in through that same Excel importer
— duplicates and bad rows get caught before anything is written, so
onboarding a school doesn't mean re-keying their old spreadsheet by hand."

---

**Close:** "One codebase, unlimited schools, each one's data completely
walled off from the others, and a sidebar a school admin can learn in five
minutes — that's what you're licensing. If a school later wants a parent
app, a public website, or full accounting, that's a conversation for a
bigger package — it's not baked into the base product, and that's on
purpose."
