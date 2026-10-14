const express = require('express');
const router = express.Router();
const BudgetController = require('../controllers/budgetController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', BudgetController.getAll);
router.post('/', BudgetController.create);
router.put('/:id', BudgetController.update);
router.delete('/:id', BudgetController.delete);

module.exports = router;
