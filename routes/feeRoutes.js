const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feeController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin', 'accountant'));

router.get('/types', asyncHandler(ctrl.listFeeTypes));
router.post('/types', asyncHandler(ctrl.createFeeType));
router.post('/assign', asyncHandler(ctrl.assignStudentFee));
router.post('/assign-class', asyncHandler(ctrl.bulkAssignClassFee));
router.get('/outstanding', asyncHandler(ctrl.outstanding));

module.exports = router;
