// Postgres (Supabase) connection layer.
//
// The rest of the codebase was written against mysql2/promise's calling
// convention: `const [rows] = await db.query(sql, params)` with `?`
// placeholders, and `const conn = await db.getConnection()` for
// transactions (conn.beginTransaction/commit/rollback/release). Rather
// than rewrite every call site's plumbing, this module adapts the `pg`
// driver to the same shape — callers are unchanged; only the SQL dialect
// differences that `?` → `$1` can't paper over (ON DUPLICATE KEY UPDATE,
// MySQL date functions, SUM(bool), etc.) were fixed at the call sites.
const { Pool, types } = require('pg');
const env = require('./env');

// mysql2 (with dateStrings:true) returned DATE/TIMESTAMP columns as plain
// strings, and the app's fmtDate()/slice(0,10) frontend helpers and
// `?? cur.value` fallbacks assume that shape. `pg` defaults to parsing
// these into JS Date objects — override back to raw strings so behavior
// (and JSON serialization) stays identical to the MySQL-backed version.
types.setTypeParser(types.builtins.DATE, (val) => val);
types.setTypeParser(types.builtins.TIMESTAMP, (val) => val);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => val);
types.setTypeParser(types.builtins.TIME, (val) => val);
// COUNT(*)/SUM(int) come back as BIGINT (OID 20), which `pg` returns as a
// string to avoid unsafe-integer loss. mysql2 returned these as plain JS
// numbers; this app's counts/sums never approach Number.MAX_SAFE_INTEGER.
types.setTypeParser(20, (val) => parseInt(val, 10));

const pool = new Pool({
  connectionString: env.db.url,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
  max: env.db.poolMax,
});

// Tables whose primary key isn't a plain `id` column — INSERTs into these
// must not get an automatic `RETURNING id` appended (see query() below).
const NO_ID_RETURNING = new Set(['website_content']);

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function insertTargetTable(sql) {
  const m = /^\s*insert\s+into\s+["']?(\w+)["']?/i.exec(sql);
  return m ? m[1].toLowerCase() : null;
}

function withReturningId(sql) {
  const table = insertTargetTable(sql);
  if (!table || NO_ID_RETURNING.has(table)) return sql;
  if (/returning/i.test(sql)) return sql;
  return `${sql.replace(/;\s*$/, '')} RETURNING id`;
}

// Shapes a pg QueryResult into the `[rows]` tuple + insertId/affectedRows
// fields that every controller already destructures, mirroring mysql2's
// `[rows, fields]` return and `result.insertId` / `result.affectedRows`.
function shape(originalSql, pgResult) {
  const isInsert = /^\s*insert/i.test(originalSql);
  const rows = pgResult.rows || [];
  rows.insertId = isInsert && rows[0] ? rows[0].id : undefined;
  rows.affectedRows = pgResult.rowCount;
  return [rows, pgResult.fields];
}

async function runQuery(executor, sql, params) {
  const finalSql = withReturningId(toPgPlaceholders(sql));
  const res = await executor.query(finalSql, params);
  return shape(sql, res);
}

async function query(sql, params = []) {
  return runQuery(pool, sql, params);
}

async function getConnection() {
  const client = await pool.connect();
  return {
    query: (sql, params = []) => runQuery(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

module.exports = { query, getConnection, pool };
