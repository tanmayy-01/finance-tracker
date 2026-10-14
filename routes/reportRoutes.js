const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', ReportController.getReports);

module.exports = router;
