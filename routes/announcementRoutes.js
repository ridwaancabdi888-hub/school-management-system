const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/announcementController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext);

router.get('/', requireRole('school_admin'), asyncHandler(ctrl.listAnnouncements));
router.get('/mine', asyncHandler(ctrl.myAnnouncements));
router.post('/', requireRole('school_admin'), asyncHandler(ctrl.createAnnouncement));
router.delete('/:id', requireRole('school_admin'), asyncHandler(ctrl.deleteAnnouncement));

module.exports = router;
