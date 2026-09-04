const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { uploadPhoto } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');

const readRoles = requireRole('school_admin', 'teacher', 'accountant');
const writeRoles = requireRole('school_admin');

router.use(requireAuth, requireSchoolContext);

router.get('/', readRoles, asyncHandler(ctrl.listStudents));
router.post('/', writeRoles, uploadPhoto.single('photo'), asyncHandler(ctrl.createStudent));
router.get('/:id', readRoles, asyncHandler(ctrl.getStudent));
router.put('/:id', writeRoles, uploadPhoto.single('photo'), asyncHandler(ctrl.updateStudent));
router.put('/:id/status', writeRoles, asyncHandler(ctrl.setStudentStatus));

module.exports = router;
