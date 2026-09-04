const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/resultController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin', 'teacher'));

router.get('/exam/:examId/marksheet', asyncHandler(ctrl.getMarksheet));
router.post('/exam/:examId/marks', asyncHandler(ctrl.saveMarks));
router.get('/exam/:examId/performance', asyncHandler(ctrl.classPerformance));
router.get('/exam/:examId/report-card/:studentId', asyncHandler(ctrl.getReportCard));
router.get('/exam/:examId/report-card/:studentId/pdf', asyncHandler(ctrl.getReportCardPdf));

module.exports = router;
