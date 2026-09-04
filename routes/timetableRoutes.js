const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/timetableController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext);

router.get('/', requireRole('school_admin', 'teacher', 'accountant', 'staff'), asyncHandler(ctrl.listTimetable));

const adminOnly = requireRole('school_admin');
router.post('/', adminOnly, asyncHandler(ctrl.createSlot));
router.put('/:id', adminOnly, asyncHandler(ctrl.updateSlot));
router.delete('/:id', adminOnly, asyncHandler(ctrl.deleteSlot));

module.exports = router;
