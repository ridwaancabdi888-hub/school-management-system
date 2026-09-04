const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireSchoolContext } = require('../middleware/tenant');
const { asyncHandler } = require('../utils/asyncHandler');

router.use(requireAuth, requireSchoolContext, requireRole('school_admin', 'accountant'));

router.get('/', asyncHandler(ctrl.listPayments));
router.post('/', asyncHandler(ctrl.recordPayment));
router.get('/monthly-collections', asyncHandler(ctrl.monthlyCollections));
router.get('/:id/receipt', asyncHandler(ctrl.getReceipt));
router.get('/:id/receipt/pdf', asyncHandler(ctrl.getReceiptPdf));

module.exports = router;
