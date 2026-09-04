const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin', 'accountant'));

router.get('/students', asyncHandler(ctrl.studentsReport));
router.get('/teachers', asyncHandler(ctrl.teachersReport));
router.get('/payments', asyncHandler(ctrl.paymentsReport));

module.exports = router;
