const ReminderModel = require('../models/reminderModel');

const ReminderController = {
  getAll(req, res) {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const reminders = ReminderModel.getAll(userId);
    const enriched = reminders.map(r => ({
      ...r,
      is_overdue: !r.is_paid && r.due_date < today,
      is_due_today: !r.is_paid && r.due_date === today
    }));

    res.json({ reminders: enriched });
  },

  create(req, res) {
    const { title, category_id, amount, due_date, frequency, notification_method } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Reminder title is required.' });
    }

    if (!due_date) {
      return res.status(400).json({ error: 'Due date is required.' });
    }

    if (!frequency || !['once', 'monthly', 'quarterly', 'yearly'].includes(frequency)) {
      return res.status(400).json({ error: 'Valid frequency (once, monthly, quarterly, yearly) is required.' });
    }

    try {
      const reminder = ReminderModel.create({
        userId: req.user.id,
        title,
        category_id,
        amount,
        due_date,
        frequency,
        notification_method
      });

      res.status(201).json({ message: 'Payment reminder scheduled successfully!', reminder });
    } catch (err) {
      console.error('Create reminder error:', err);
      res.status(500).json({ error: 'Failed to create payment reminder.' });
    }
  },

  update(req, res) {
    const { title, category_id, amount, due_date, frequency, notification_method } = req.body;
    const reminderId = req.params.id;

    const existing = ReminderModel.getById(reminderId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }

    const updated = ReminderModel.update(reminderId, req.user.id, {
      title,
      category_id,
      amount,
      due_date,
      frequency,
      notification_method
    });

    res.json({ message: 'Reminder updated successfully!', reminder: updated });
  },

  togglePaid(req, res) {
    const reminderId = req.params.id;
    const newStatus = ReminderModel.togglePaid(reminderId, req.user.id);

    if (newStatus === null) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }

    res.json({
      message: newStatus ? 'Reminder marked as paid!' : 'Reminder marked as pending!',
      is_paid: newStatus
    });
  },

  delete(req, res) {
    const reminderId = req.params.id;
    const existing = ReminderModel.getById(reminderId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }

    ReminderModel.delete(reminderId, req.user.id);
    res.json({ message: 'Payment reminder deleted successfully!' });
  }
};

module.exports = ReminderController;
