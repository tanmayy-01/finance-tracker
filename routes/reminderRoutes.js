const express = require('express');
const router = express.Router();
const ReminderController = require('../controllers/reminderController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', ReminderController.getAll);
router.post('/', ReminderController.create);
router.put('/:id', ReminderController.update);
router.patch('/:id/toggle-paid', ReminderController.togglePaid);
router.delete('/:id', ReminderController.delete);

module.exports = router;
