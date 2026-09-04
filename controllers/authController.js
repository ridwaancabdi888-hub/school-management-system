const db = require('../config/db');
const { comparePassword, hashPassword } = require('../utils/password');
const { signToken } = require('../utils/token');

// Login is intentionally school-agnostic: the user supplies a username
// and password only. Their school (if any) and role come back from the
// users row itself, never from client input.
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const [rows] = await db.query(
    `SELECT u.*, s.status AS school_status, s.name AS school_name
     FROM users u
     LEFT JOIN schools s ON s.id = u.school_id
     WHERE u.username = ? LIMIT 1`,
    [username]
  );

  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  if (user.status !== 'active') return res.status(403).json({ error: 'This account has been deactivated' });
  if (user.role !== 'super_admin' && user.school_status === 'suspended') {
    return res.status(403).json({ error: 'This school has been suspended. Contact the platform administrator.' });
  }

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

  const token = signToken(user);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      schoolId: user.school_id,
      schoolName: user.school_name,
      mustChangePassword: !!user.must_change_password,
      photo: user.photo
    }
  });
}

function logout(req, res) {
  res.clearCookie('token');
  res.json({ ok: true });
}

// Re-reads school name (and could reflect other live changes) rather than
// trusting only what was baked into the JWT at login time.
async function me(req, res) {
  let schoolName = null;
  if (req.user.schoolId) {
    const [rows] = await db.query('SELECT name FROM schools WHERE id = ?', [req.user.schoolId]);
    schoolName = rows[0] ? rows[0].name : null;
  }
  res.json({ user: { ...req.user, schoolName } });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const ok = await comparePassword(currentPassword || '', user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await hashPassword(newPassword);
  await db.query('UPDATE users SET password_hash = ?, must_change_password = false WHERE id = ?', [hash, user.id]);
  res.json({ ok: true });
}

module.exports = { login, logout, me, changePassword };
