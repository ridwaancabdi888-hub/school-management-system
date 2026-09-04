const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/staffController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin'));

router.get('/', asyncHandler(ctrl.listStaff));
router.post('/', asyncHandler(ctrl.createStaff));
router.put('/:id', asyncHandler(ctrl.updateStaff));
router.put('/:id/status', asyncHandler(ctrl.setStaffStatus));

module.exports = router;
