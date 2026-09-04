const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/importExportController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { uploadImport } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin'));

router.post('/students/preview', uploadImport.single('file'), asyncHandler(ctrl.previewStudentImport));
router.post('/students/commit', asyncHandler(ctrl.commitStudentImport));
router.get('/students/export', asyncHandler(ctrl.exportStudentsExcel));

module.exports = router;
