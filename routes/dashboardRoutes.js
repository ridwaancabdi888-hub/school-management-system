const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext);

router.get('/school-admin', requireRole('school_admin'), asyncHandler(ctrl.schoolAdminDashboard));
router.get('/teacher', requireRole('teacher'), asyncHandler(ctrl.teacherDashboard));
router.get('/accountant', requireRole('accountant'), asyncHandler(ctrl.accountantDashboard));

module.exports = router;
