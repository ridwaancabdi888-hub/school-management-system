const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/schoolSettingsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { uploadLogo } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin'));

router.get('/', asyncHandler(ctrl.getMySchool));
router.put('/', uploadLogo.single('logo'), asyncHandler(ctrl.updateMySchool));

router.get('/accounts', asyncHandler(ctrl.listAccounts));
router.put('/accounts/:id/password', asyncHandler(ctrl.resetAccountPassword));
router.put('/accounts/:id/status', asyncHandler(ctrl.setAccountStatus));

module.exports = router;
