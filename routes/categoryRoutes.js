const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', CategoryController.getAll);
router.post('/', CategoryController.create);
router.put('/:id', CategoryController.update);
router.delete('/:id', CategoryController.delete);

module.exports = router;
