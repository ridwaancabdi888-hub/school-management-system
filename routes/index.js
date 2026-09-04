const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/super-admin', require('./superAdminRoutes'));
router.use('/school', require('./schoolSettingsRoutes'));
router.use('/students', require('./studentRoutes'));
router.use('/teachers', require('./teacherRoutes'));
router.use('/staff', require('./staffRoutes'));
router.use('/academics', require('./classRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/fees', require('./feeRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/exams', require('./examRoutes'));
router.use('/results', require('./resultRoutes'));
router.use('/timetable', require('./timetableRoutes'));
router.use('/announcements', require('./announcementRoutes'));
router.use('/finance', require('./financeRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/import-export', require('./importExportRoutes'));
router.use('/website', require('./websiteRoutes'));
router.use('/parent', require('./parentRoutes'));
router.use('/student-portal', require('./studentPortalRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));

module.exports = router;
