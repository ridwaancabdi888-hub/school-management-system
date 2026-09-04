const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/examController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin', 'teacher'));

router.get('/', asyncHandler(ctrl.listExams));
router.post('/', requireRole('school_admin'), asyncHandler(ctrl.createExam));
router.get('/:id', asyncHandler(ctrl.getExam));
router.post('/:id/publish', requireRole('school_admin'), asyncHandler(ctrl.publishExamAction));
router.post('/:id/unpublish', requireRole('school_admin'), asyncHandler(ctrl.unpublishExamAction));
router.post('/:id/subjects', requireRole('school_admin'), asyncHandler(ctrl.addExamSubject));

module.exports = router;
