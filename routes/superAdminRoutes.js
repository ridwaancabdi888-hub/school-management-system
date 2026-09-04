const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/superAdminController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadLogo } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireRole('super_admin'));

router.get('/stats', asyncHandler(ctrl.stats));

router.get('/schools', asyncHandler(ctrl.listSchools));
router.get('/schools/:id', asyncHandler(ctrl.getSchool));
router.post('/schools', uploadLogo.single('logo'), asyncHandler(ctrl.createSchool));
router.put('/schools/:id', uploadLogo.single('logo'), asyncHandler(ctrl.updateSchool));
router.post('/schools/:id/activate', asyncHandler(ctrl.activateSchool));
router.post('/schools/:id/suspend', asyncHandler(ctrl.suspendSchool));

router.post('/schools/:schoolId/admins', asyncHandler(ctrl.createSchoolAdmin));
router.put('/schools/:schoolId/admins/:adminId/status', asyncHandler(ctrl.setAdminStatus));

module.exports = router;
