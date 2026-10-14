const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transactionController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', TransactionController.getAll);
router.get('/export/csv', TransactionController.exportCSV);
router.post('/', TransactionController.create);
router.put('/:id', TransactionController.update);
router.delete('/:id', TransactionController.delete);

module.exports = router;
