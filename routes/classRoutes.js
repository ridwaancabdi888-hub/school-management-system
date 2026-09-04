const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/classController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

const readRoles = requireRole('school_admin', 'teacher', 'accountant', 'staff', 'student', 'parent');
const writeRoles = requireRole('school_admin');

router.use(requireAuth, requireSchoolContext);

router.get('/classes', readRoles, asyncHandler(ctrl.listClasses));
router.post('/classes', writeRoles, asyncHandler(ctrl.createClass));
router.put('/classes/:id', writeRoles, asyncHandler(ctrl.updateClass));
router.delete('/classes/:id', writeRoles, asyncHandler(ctrl.deleteClass));

router.get('/sections', readRoles, asyncHandler(ctrl.listSections));
router.post('/sections', writeRoles, asyncHandler(ctrl.createSection));
router.put('/sections/:id', writeRoles, asyncHandler(ctrl.updateSection));
router.delete('/sections/:id', writeRoles, asyncHandler(ctrl.deleteSection));

router.get('/subjects', readRoles, asyncHandler(ctrl.listSubjects));
router.post('/subjects', writeRoles, asyncHandler(ctrl.createSubject));
router.put('/subjects/:id', writeRoles, asyncHandler(ctrl.updateSubject));
router.delete('/subjects/:id', writeRoles, asyncHandler(ctrl.deleteSubject));

router.get('/class-subjects/:classId', readRoles, asyncHandler(ctrl.listClassSubjects));
router.post('/class-subjects', writeRoles, asyncHandler(ctrl.assignClassSubject));
router.delete('/class-subjects/:id', writeRoles, asyncHandler(ctrl.removeClassSubject));

module.exports = router;
