// Every school-scoped route uses this AFTER requireAuth. It pins
// req.schoolId to the value embedded in the caller's signed JWT and
// nothing else. Controllers must use req.schoolId (never
// req.body.school_id / req.query.school_id / req.params.school_id) when
// building SQL — this is what makes cross-tenant access (IDOR) impossible:
// a School A admin's token can only ever resolve to School A's id.
function requireSchoolContext(req, res, next) {
  if (!req.user || !req.user.schoolId) {
    return res.status(403).json({ error: 'ACCESS DENIED' });
  }
  req.schoolId = req.user.schoolId;
  next();
}

module.exports = { requireSchoolContext };
