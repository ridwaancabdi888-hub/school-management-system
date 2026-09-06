# School Management System

A simple, focused, multi-tenant School Management System: one platform,
sold to many schools. A **Platform Super Admin** creates and manages
schools; each school gets its own **School Admin**, who manages only their
own school's data. Tenant isolation is enforced server-side on every
request.

This is deliberately **not** a full school ERP. It covers the daily
operations that make a school say yes: students, teachers, classes,
attendance, fees, payments, exams/results, announcements, reports, and
accounts — kept simple enough to demo in a few minutes and learn in one
sitting. See "Modules kept vs. removed" below for the exact scope.

## Tech stack (production)

- **Frontend:** plain HTML, CSS, JavaScript (no framework/bundler) — one
  lightweight hash-routed "app" per portal, talking to a JSON REST API.
- **Backend:** Node.js + Express.js, deployed as a Vercel serverless function
- **Database:** PostgreSQL, hosted on Supabase
- **File storage:** Supabase Storage (school logos, student/teacher photos,
  public-website gallery images)
- **Auth:** JWT in an httpOnly cookie (no client-side token handling,
  stateless — no server-side session store needed, which is what makes this
  work cleanly on serverless)
- **Code / CI:** GitHub, auto-deployed to Vercel on push

This project was originally built against local MySQL/MariaDB and has been
migrated to Supabase PostgreSQL for production — see "Database migration
notes" below for what changed and why.

## Production architecture

```
Browser ──HTTPS──> Vercel (api/index.js, Express app)
                       │
                       ├──> Supabase PostgreSQL (Transaction pooler, port 6543)
                       │      all application data, tenant-scoped by school_id
                       │
                       └──> Supabase Storage ("uploads" bucket)
                              logos / photos / gallery images
```

There is no separate frontend deployment — Vercel serves both the static
`public/` frontend and the `/api/*` backend from the same Express app (see
`vercel.json`), so there's one URL, one deploy, one set of environment
variables.

## Project structure

```
school-management-system/
  api/
    index.js          # Vercel serverless entry — exports app.js
  app.js               # Express app (routes, middleware, static files)
  server.js            # local-dev entry point only (app.listen) — not used on Vercel
  vercel.json           # routes every request to api/index.js
  config/              # env + Postgres pool (config/db.js)
  controllers/          # one file per resource, all SQL lives here
  middleware/            # auth, tenant scoping, uploads, error handling
  routes/                # Express routers, wired to middleware + controllers
  public/                # the frontend — one folder per role/portal
    login/
    superadmin/
    school-admin/
    teacher/
    student/
    parent/
    accountant/
    website/           # optional public site, driven by ?school=CODE
    css/ js/            # shared design system + fetch/UI helpers
  database/
    schema.sql          # ORIGINAL MySQL schema — kept for reference/local-MySQL-dev, not used in production
    setup.js             # ORIGINAL MySQL seed script — same
    postgres/
      schema.sql          # PRODUCTION schema (PostgreSQL / Supabase)
      setup.js              # PRODUCTION seed script — creates schema + seeds two demo schools
  uploads/                # legacy local-disk upload folder from the MySQL-era
                           # build — no longer written to (see Storage below);
                           # kept only because it isn't this migration's place
                           # to delete pre-existing files
  utils/
    storage.js             # Supabase Storage upload helper
  docs/
    USER_GUIDE.md
    DEMO_SCRIPT.md
  .env.example
  server.js
```

## How multi-tenancy is enforced

Every school-owned table (`students`, `teachers`, `payments`, `results`, ...)
has a `school_id` column. On every authenticated request:

1. `middleware/auth.js` verifies the JWT from the httpOnly cookie and sets
   `req.user = { id, role, schoolId, ... }`.
2. `middleware/tenant.js` sets `req.schoolId = req.user.schoolId` — **from
   the signed token only**.
3. Every controller query filters by `req.schoolId`, never by a `school_id`
   read from the request body, query string, or URL params.

A School Admin's token can only ever resolve to their own school's id, so
there is no code path that lets School A read or write School B's data —
not even by guessing another school's numeric IDs (IDOR). See "Tenant
isolation test result" below for how this was verified.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (or use an
   existing one). This app's own deployment uses a dedicated project named
   `school-management-system` — see the final report for its ref/URL.
2. **Get the database connection string:** Project Settings → Database →
   Connection string → copy the **Transaction pooler** URI (port `6543`),
   which looks like:
   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
   Use the pooler, not the direct connection (port `5432`) — it's built for
   exactly this app's pattern of many short-lived connections (serverless
   functions in production; a normal connection pool locally).
   If you don't have the database password (e.g. it was never shown to
   you), reset it from the same Database settings page.
3. **Get the Storage service key:** Project Settings → API → copy the
   **service_role** secret key. This is used server-side only (in
   `utils/storage.js`) to upload logos/photos/gallery images to Supabase
   Storage — it bypasses Row Level Security and must never reach the
   frontend or be committed to source control.
4. **Create the schema and Storage bucket.** The schema
   (`database/postgres/schema.sql`) and the `uploads` Storage bucket for
   this deployment were created directly against the Supabase project via
   its management API. To do the same against a fresh project, either:
   - run the SQL in `database/postgres/schema.sql` in the Supabase SQL
     Editor, then create a public Storage bucket named `uploads`; or
   - fill in `DATABASE_URL` in `.env` (step below) and run `npm run
     db:setup`, which applies the schema and seeds demo data in one step
     (you'll still need to create the `uploads` bucket manually — Table
     Editor → Storage → New bucket → name `uploads`, **Public** bucket).

## Local development

### 1. Configure environment

**macOS, Linux, or Git Bash:**

```bash
cd school-management-system
cp .env.example .env
```

**Windows PowerShell:**

```powershell
cd school-management-system
Copy-Item .env.example .env
```

Fill in `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`
from the Supabase setup above.

### 2. Install dependencies

```bash
npm install
```

### 3. Create the schema and load demo data

```bash
npm run db:setup
```

This applies `database/postgres/schema.sql` and seeds:

- 1 Platform Super Admin
- 2 demo schools (**Sunrise Academy** / `SUNA`, **Bright Future School** /
  `BFS`), each with its own School Admin, 2 teachers, 1 accountant, 4
  students with linked parent accounts, classes/sections/subjects,
  attendance, fee assignments + a payment, a published exam with results,
  a timetable, and announcements — fully isolated from each other.

Re-run `npm run db:setup` any time to reset to a clean demo state (it
drops and recreates every table first).

> The **original MySQL** path (`database/schema.sql` +
> `npm run db:setup:mysql-legacy`) is kept for reference/local-MySQL-dev
> only. It needs `mysql2` (`npm install mysql2`) since that dependency was
> removed once Postgres became the one production database layer — the app
> itself (`config/db.js`) only speaks Postgres now.

### 4. Run the server

```bash
npm start
```

Then open **http://localhost:4000** — it redirects to the login page. Every
portal is a static page under `/superadmin/`, `/school-admin/`, `/teacher/`,
`/student/`, `/parent/`, `/accountant/`, each guarded client-side (redirects
to `/login/` if not authenticated) *and* server-side (every API route
re-checks role + tenant on every call — the client-side guard is only a
convenience, not the security boundary).

For development with auto-restart on file changes: `npm run dev`.

## Vercel deployment

1. **Push this repository to GitHub** (see "GitHub repository" below).
2. In Vercel, **import the GitHub repository** as a new project. Vercel
   auto-detects `vercel.json`, which routes every request to
   `api/index.js` (the same Express app `app.js` exports, wrapped as a
   serverless function) — no build command is needed, this is a plain
   Node app, not a static/SSR framework build.
3. **Set environment variables** in Vercel (Project Settings →
   Environment Variables), for the Production environment at minimum:
   - `DATABASE_URL` — the Supabase **Transaction pooler** connection
     string (see Supabase setup above)
   - `DB_SSL` = `true`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` = `uploads`
   - `JWT_SECRET` — a long random string, **different from** the one in
     any local `.env` (generate with
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `JWT_EXPIRES_IN` = `8h`
   - `NODE_ENV` = `production`
   - `SUPER_ADMIN_*` — only needed if you (re-)run `npm run db:setup`
     against production, which you normally would not do after go-live
     (it drops and recreates every table)
4. Deploy. Vercel sets its own `VERCEL=1` env var automatically —
   `config/env.js` uses that to size the Postgres pool to 1 connection per
   serverless invocation (see "Database connection" below for why).
5. **Uploads work out of the box** once `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` are set — no extra Vercel configuration
   needed, since files go straight to Supabase Storage rather than the
   function's local (ephemeral) filesystem.

### Why the connection pooler, and why pool size 1 in production

Vercel serverless functions are short-lived and can run many instances
concurrently; each one opening a handful of direct Postgres connections
would quickly exhaust Supabase's direct-connection limit. The Transaction
pooler (PgBouncer, port 6543) is designed for exactly this — many clients,
each holding a connection only briefly. `config/db.js` also caps the
in-process pool to 1 connection when running on Vercel (`env.db.poolMax`),
so a single function invocation never tries to hold more than it needs;
locally (or on a traditional always-on host) it defaults to 10, sized for
normal connection reuse.

## Demo credentials

**These are demo/seed accounts only** — created by `npm run db:setup` for
testing and the sales demo, not real customer accounts. Rotate or remove
them before onboarding a real school.

Full list also in [docs/USER_GUIDE.md](docs/USER_GUIDE.md). Highlights:

| Role | Username | Password | Scope |
|---|---|---|---|
| Platform Super Admin | `superadmin` | `SuperAdmin@123` | All schools |
| School Admin | `admin.suna` | `SunA-Admin@123` | Sunrise Academy only |
| School Admin | `admin.bfs` | `BFS-Admin@123` | Bright Future School only |
| Teacher | `teacher1.suna` | `Teacher@123` | Sunrise Academy |
| Student | `student.emma.suna` | `Student@123` | Sunrise Academy |
| Parent | `parent.emma.suna` | `Parent@123` | Sunrise Academy (Emma only) |
| Accountant | `accountant.suna` | `Accountant@123` | Sunrise Academy |

Passwords are never stored in plaintext — only bcrypt hashes are persisted.
The values above are what `database/postgres/setup.js` sets at seed time,
shown here purely for demo convenience.

## Modules kept vs. removed

The product was deliberately trimmed down from an earlier, larger build to
keep it simple, fast, and easy to sell/demo. Nothing was deleted outright —
anything marked "removed from navigation" still has working backend code
(routes + controllers + database tables), it's just not linked from any
portal's UI anymore, so it doesn't add surface area to learn or demo.

**Kept, in the School Admin sidebar:** Dashboard, Students, Teachers,
Classes & Subjects, Attendance, Fees, Payments, Exams & Results,
Announcements, Reports, Accounts, School Settings. Platform Super Admin
(multi-school management) is kept in full, also intentionally minimal.

**Removed from navigation and daily workflow** (code kept internally):
Timetable, Staff Management (the general reception/security/cleaner/driver
module — the Accounts page still has a focused "+ Add Accountant" action
so School Admins can still create the Accountant login Fees & Payments
depends on), Income/Expenses accounting, the Parent Portal and Student
Portal self-service login flows (no longer created from the Add Student
form; existing portal accounts/routes still work if used directly), the
Website management UI in School Admin, and the online-admission module.
The public marketing website itself (`/website/?school=CODE`) still renders
for schools that had it enabled before this simplification — it's just no
longer editable from School Admin, since a full website builder isn't part
of this product; see the original README history if that's needed later.

## Completed features

- **Platform Super Admin:** add/edit school, activate/suspend, create
  School Admin accounts, view all schools, simple platform stats
  (total/active/suspended schools, total students/teachers, recent
  schools), one-time credential reveal on school creation.
- **Multi-tenant security:** JWT + server-side tenant scoping on every
  route; verified with live IDOR tests (see below).
- **Students:** add/edit/view/deactivate, search & filter (class, section,
  status, text), simple field set (class, phone, parent/guardian name +
  phone, gender, DOB, admission date, status, photo), full profile
  (attendance/fees/payments/results tabs).
- **Teachers:** add/edit/deactivate, subject/class assignment, teacher
  dashboard (assigned classes, attendance entry, marks entry,
  announcements).
- **Classes/Sections/Subjects:** full CRUD, class-teacher assignment,
  subject-teacher assignment per class.
- **Attendance:** present/absent/late/excused, daily entry by class/section/
  date, per-student history + percentage, monthly class reports. Built to
  be fast on a phone — a couple of taps per student.
- **Fees & Payments:** fee types, per-student or whole-class fee assignment,
  payment recording with auto receipt numbers, outstanding-balance report,
  monthly collections, PDF receipts.
- **Exams & Results:** exam + subject (max/pass marks) setup, bulk marks
  entry grid, publish/unpublish gate (unpublished results are invisible to
  students/parents), auto grade + rank, PDF report cards, class performance
  ranking.
- **Announcements:** title/message/date; targeted to everyone/teachers/
  students/parents/a specific class/section; add/edit/delete.
- **Reports:** student list, attendance, payments, unpaid fees, exam
  results — CSV export where applicable.
- **Excel/CSV import:** upload → column validation → preview with per-row
  errors and duplicate detection → commit only valid rows → import summary
  (imported/skipped/errors).
- **Responsive UI:** single shared design system tested at desktop, tablet
  (820px) and mobile (390px) widths, with a collapsible sidebar on narrow
  screens.

## Known limitations

- Timetable, general Staff Management, Income/Expenses accounting, Parent/
  Student self-service portals, and Website management are not part of the
  simplified workflow — see "Modules kept vs. removed" above. Their code
  and database tables still exist and still work if called directly; they
  just aren't linked from any navigation.
- No automated backup scheduler is built, and the Supabase free tier this
  deployment uses doesn't include Point-in-Time Recovery — see the
  "Backup" section below for the manual `pg_dump` workflow.
- Application tables require Row Level Security and no grants for the
  `anon` or `authenticated` Data API roles. Apply `database/postgres/security.sql`
  after any manual schema installation. The setup script applies it automatically.
  Express must still enforce school isolation on its privileged database connection.
- No email/SMS delivery of credentials — the "show once" credential dialog
  is the hand-off mechanism; sending it onward is a manual/administrative
  step.
- No payment gateway integration — payments are recorded manually by
  Accountant/School Admin (as scoped: "System should record payments a
  human took", not process card transactions itself).
- Report card grading uses a fixed percentage scale (A+/A/B/C/D/E/F); a
  school-specific scale is not configurable in this version.
- No automated data-migration tool beyond the CSV/Excel student importer —
  larger legacy systems still need their data reshaped into the expected
  columns first (see "Data Migration" in the User Guide).
- Rate limiting / brute-force login protection is not implemented.

## Tenant isolation test result

Verified live (both via direct API calls and clicking through the actual
UI in a browser), most recently by scripting a brand-new school through
Super Admin → School Admin → students/attendance/fees/payments/exam+
results/announcements, then cross-checking against the pre-seeded Sunrise
Academy tenant:

| Test | Expected | Result |
|---|---|---|
| New school's admin requests Sunrise Academy's student by ID | 404 (not found, not "forbidden" — doesn't leak existence) | **PASS** |
| Sunrise Academy admin searches the new school's admission-number prefix | 0 results | **PASS** |
| New school's admin searches Sunrise Academy's student name | 0 results | **PASS** |
| School A admin passes `?school_id=<B>` on a list endpoint | Ignored — still only School A's data returned | **PASS** |
| School Admin calls a Super Admin-only route | 403 ACCESS DENIED | **PASS** |
| Parent requests another family's child's attendance | 403 ACCESS DENIED | **PASS** |
| Unauthenticated request to any protected API route | 401 | **PASS** |

Root cause of why this holds: `req.schoolId` is derived only from the
signed JWT (see "How multi-tenancy is enforced" above) — there is no code
path in any controller that reads a tenant id from client-supplied input.

## Mobile test result

Driven with a headless-Chromium script (Playwright) against the running
app, not just visual inspection of static CSS:

| Viewport | Screens tested | Result |
|---|---|---|
| Mobile (390×844) | Login, School Admin dashboard (simplified stat cards), sidebar open/close (confirmed only the 12 kept modules appear), attendance entry | **PASS** — sidebar collapses behind a hamburger menu, stat cards stack to one column, tables scroll horizontally inside their own container |
| Tablet (820×1180) | Student portal profile, results | **PASS** |
| Desktop (1400×900) | Super Admin, School Admin, Teacher, Accountant, Parent portals | **PASS** |

No layout overflow, no console errors, all interactive elements reachable
at every tested width.

## Bugs found and fixed during this simplification pass

While scripting the new "create a school end-to-end" test above, two
pre-existing bugs surfaced (unrelated to the simplification itself, but
caught because this pass exercised every workflow live):

- **Publish/Unpublish Exam was completely broken.** `publishExam(status)`
  in `controllers/examController.js` was declared `async`, so calling it
  (`publishExam('published')`) returned a `Promise` instead of the actual
  request handler — every publish/unpublish click threw `fn is not a
  function` (HTTP 500). Fixed by removing the stray `async`.
- **Suspend/Activate School had the identical bug** in
  `setSchoolStatus(status)` in `controllers/superAdminController.js` — same
  fix. Both are now covered by the smoke test and pass.

## Documentation paths

- [README.md](README.md) — this file
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — how to use every role's portal
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — a 3–5 minute sales walkthrough

## Database migration notes (MySQL → PostgreSQL)

The app was originally built against local MySQL/MariaDB
(`database/schema.sql`, kept for reference). Moving to Supabase Postgres
required more than swapping a driver — MySQL and Postgres disagree on
several things this schema and its queries relied on:

| MySQL | PostgreSQL equivalent used | Where |
|---|---|---|
| `AUTO_INCREMENT` | `SERIAL` | every table's `id` |
| `ENUM(...)` column | `TEXT` + `CHECK (col IN (...))` | `status`, `role`, `gender`, etc. |
| `TINYINT(1)` boolean | `BOOLEAN`, with call sites writing `true`/`false` instead of `1`/`0` (Postgres has no implicit int→boolean cast) | `website_enabled`, `must_change_password` |
| `TIMESTAMP ... ON UPDATE CURRENT_TIMESTAMP` | `TIMESTAMPTZ` + a `set_updated_at()` trigger | every `updated_at` column |
| `INSERT ... ON DUPLICATE KEY UPDATE ... VALUES(col)` | `INSERT ... ON CONFLICT (unique_cols) DO UPDATE SET col = EXCLUDED.col` | attendance upsert, results upsert, class-subject assignment, website content, student-guardian link |
| `SUM(status = 'present')` (MySQL treats a boolean expression as 0/1) | `COUNT(*) FILTER (WHERE status = 'present')` | attendance summaries (dashboard, student profile, report card, monthly report) |
| `MONTH(x)`, `YEAR(x)` | `EXTRACT(MONTH FROM x)`, `EXTRACT(YEAR FROM x)` | "this month's collections/expenses" dashboard queries |
| `DATE_FORMAT(x, '%Y-%m')` | `TO_CHAR(x, 'YYYY-MM')` | monthly collections / income-expense summaries |
| `GROUP BY <table>.id` while selecting other tables' columns | Postgres only infers functional dependency within the *same* table's primary key — joined tables' columns (e.g. class/section name) had to be added to `GROUP BY` explicitly | outstanding-fees report |
| Aliases in `HAVING` or inside an `ORDER BY` expression | `HAVING` cannot use SELECT aliases; `ORDER BY` can use a bare alias but cannot combine aliases in an expression such as `(required - paid)` — the aggregate expressions had to be repeated | outstanding-fees report |
| `?` placeholders, `result.insertId`, `[rows, fields]` return shape | Preserved via an adapter in `config/db.js` that rewrites `?` → `$1, $2, ...`, auto-appends `RETURNING id` to `INSERT`s, and shapes the `pg` result back into the same tuple every controller already destructures — so controller call sites didn't need a full rewrite, only the genuine dialect differences above | all 20 controllers |
| `LIMIT ? OFFSET ?` | unchanged — Postgres uses identical syntax | student list pagination |

Application-level tenant isolation (`req.schoolId` from the JWT, never
from client input — see "How multi-tenancy is enforced") is pure
JavaScript/Express logic with no database-specific code, so it needed no
changes and was re-verified after migration (see "Tenant isolation test
result").

**Security note — Row Level Security (RLS):** `database/postgres/security.sql`
enables RLS on all 24 application tables and revokes Data API client grants.
The frontend accesses data through Express, so no client-facing policies are
needed. The server's `postgres` connection retains access and must enforce
tenant isolation itself. This protection was applied to the existing school
Supabase project on 2026-09-05 without recreating tables or seeding accounts.
Run this security script after applying the schema manually. Never run the
destructive demo setup against a database containing data to preserve.

## Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Used for | Set in |
|---|---|---|
| `DATABASE_URL` | Postgres connection (Supabase Transaction pooler URI) | `.env` locally, Vercel env vars in production |
| `DB_SSL` | Force TLS on the Postgres connection | both |
| `SUPABASE_URL` | Supabase Storage API base URL | both |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Storage uploads (bypasses RLS — **secret**) | both |
| `SUPABASE_STORAGE_BUCKET` | Bucket name for uploads (`uploads`) | both |
| `JWT_SECRET` | Signs/verifies session cookies (**secret** — use a different value in production than local dev) | both |
| `JWT_EXPIRES_IN` | Session length | both |
| `PORT` | Local dev server port only — unused on Vercel | `.env` |
| `NODE_ENV` | `development` locally, `production` on Vercel | both |
| `SUPER_ADMIN_*` | Bootstrap super-admin credentials for `npm run db:setup` | `.env` (or Vercel, only if re-seeding production) |

None of these are committed — `.env` is git-ignored (see `.gitignore`), and
`.env.example` contains no real values.

## GitHub repository

Code lives at the repository named in the final deployment report (created
under the connected GitHub account). `.gitignore` excludes `node_modules/`,
`.env` (and `.env.*.local`), `.vercel/`, build logs, and the legacy local
`uploads/` contents — see `.gitignore` for the full list. Pushing to the
default branch is what Vercel's GitHub integration watches for
auto-deploys, once the two are connected (see "Vercel deployment" above).

## Backup

**Manual backup** (Supabase Postgres, run any time — needs the Postgres
client tools, `psql`/`pg_dump`, and the **direct** connection string, not
the pooler, for `pg_dump`):

```bash
pg_dump "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" > backup.sql
```

**Restore** (to a new/empty Supabase project):

```bash
psql "postgresql://postgres:<password>@db.<new-project-ref>.supabase.co:5432/postgres" < backup.sql
```

Supabase also takes **automatic daily backups** on paid plans (Point-in-
Time Recovery on Pro+), restorable from the dashboard — check current plan
before relying on this for a real deployment; the free tier this project
uses does not include it, so the manual `pg_dump` above is the only backup
path today (see Known Limitations).

Uploaded files (logos, photos, gallery) live in Supabase Storage, not the
database — back up the `uploads` bucket separately (Storage → download, or
script it with the Storage API) if you need a complete restore point.
