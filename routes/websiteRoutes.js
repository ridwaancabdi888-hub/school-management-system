const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/websiteController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { uploadGallery } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');

// ---- Public, no auth — read-only by school code ----------------------------
router.get('/public/:schoolCode', asyncHandler(ctrl.getPublicSite));
router.post('/public/:schoolCode/apply', asyncHandler(ctrl.submitApplication));

// ---- Admin (school_admin only, scoped to their own school) -----------------
const adminRouter = express.Router();
adminRouter.use(requireAuth, requireSchoolContext, requireRole('school_admin'));
adminRouter.get('/content', asyncHandler(ctrl.getContent));
adminRouter.put('/content', asyncHandler(ctrl.updateContent));
adminRouter.get('/news', asyncHandler(ctrl.listNews));
adminRouter.post('/news', asyncHandler(ctrl.createNews));
adminRouter.delete('/news/:id', asyncHandler(ctrl.deleteNews));
adminRouter.post('/gallery', uploadGallery.single('image'), asyncHandler(ctrl.addGalleryImage));
adminRouter.delete('/gallery/:id', asyncHandler(ctrl.deleteGalleryImage));
adminRouter.get('/applications', asyncHandler(ctrl.listApplications));
adminRouter.put('/applications/:id/status', asyncHandler(ctrl.setApplicationStatus));
router.use('/admin', adminRouter);

module.exports = router;
