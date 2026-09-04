const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

router.post('/login', asyncHandler(ctrl.login));
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
router.post('/change-password', requireAuth, asyncHandler(ctrl.changePassword));

module.exports = router;
