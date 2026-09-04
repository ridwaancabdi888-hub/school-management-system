const { verifyToken } = require('../utils/token');

// Reads the httpOnly JWT cookie set at login. This is the ONLY source of
// truth for who the caller is and which school they belong to — nothing
// from the request body, query string, or route params is ever trusted
// for identity or tenant scoping.
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const payload = verifyToken(token);
    req.user = payload; // { id, role, schoolId, name, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ACCESS DENIED' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
