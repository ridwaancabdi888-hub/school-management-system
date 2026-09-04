const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financeController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin', 'accountant'));

router.get('/', asyncHandler(ctrl.listRecords));
router.post('/', asyncHandler(ctrl.createRecord));
router.delete('/:id', asyncHandler(ctrl.deleteRecord));
router.get('/monthly-summary', asyncHandler(ctrl.monthlySummary));

module.exports = router;
