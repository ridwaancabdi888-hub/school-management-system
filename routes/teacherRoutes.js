const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/teacherController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { uploadPhoto } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext);

router.get('/my-classes', requireRole('teacher'), asyncHandler(ctrl.myClasses));

const adminOnly = requireRole('school_admin');
router.get('/', adminOnly, asyncHandler(ctrl.listTeachers));
router.post('/', adminOnly, uploadPhoto.single('photo'), asyncHandler(ctrl.createTeacher));
router.put('/:id', adminOnly, uploadPhoto.single('photo'), asyncHandler(ctrl.updateTeacher));
router.put('/:id/status', adminOnly, asyncHandler(ctrl.setTeacherStatus));

module.exports = router;
