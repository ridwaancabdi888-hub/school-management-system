const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentPortalController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('student'));

router.get('/profile', asyncHandler(ctrl.myProfile));
router.get('/attendance', asyncHandler(ctrl.myAttendance));
router.get('/results', asyncHandler(ctrl.myResults));
router.get('/fees', asyncHandler(ctrl.myFees));
router.get('/timetable', asyncHandler(ctrl.myTimetable));
router.get('/report-card/:examId', asyncHandler(ctrl.myReportCard));
router.get('/report-card/:examId/pdf', asyncHandler(ctrl.myReportCardPdf));
router.get('/announcements', asyncHandler(require('../controllers/announcementController').myAnnouncements));

module.exports = router;
