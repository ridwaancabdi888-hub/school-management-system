const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin', 'teacher'));

router.post('/mark', asyncHandler(ctrl.markAttendance));
router.get('/daily', asyncHandler(ctrl.getDailyAttendance));
router.get('/student/:studentId', asyncHandler(ctrl.getStudentAttendance));
router.get('/monthly-report', asyncHandler(ctrl.monthlyReport));

module.exports = router;
