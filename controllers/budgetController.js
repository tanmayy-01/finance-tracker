const BudgetModel = require('../models/budgetModel');
const CategoryModel = require('../models/categoryModel');
const { getDateRangeForTimeFrame } = require('../utils/dateHelpers');

const BudgetController = {
  getAll(req, res) {
    const userId = req.user.id;
    const budgets = BudgetModel.getAll(userId);

    const enriched = budgets.map(b => {
      const range = getDateRangeForTimeFrame(b.time_frame, b.start_date, b.end_date);
      const catIds = b.category_ids ? b.category_ids.split(',').map(id => id.trim()).filter(Boolean) : [];

      const spent = BudgetModel.getSpent(userId, catIds, range.startDate, range.endDate);
      const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const remaining = Math.max(0, b.amount - spent);

      let status = 'on_track';
      if (spent > b.amount) {
        status = 'exceeded';
      } else if (percent >= (b.alert_threshold || 80)) {
        status = 'nearing_limit';
      }

      let categoryNames = ['All Categories'];
      if (catIds.length > 0 && !catIds.includes('all')) {
        const userCats = CategoryModel.getAll(userId);
        const catMap = new Map(userCats.map(c => [c.id.toString(), c.name]));
        categoryNames = catIds.map(id => catMap.get(id)).filter(Boolean);
      }

      return {
        ...b,
        spent,
        percent: Math.round(percent * 10) / 10,
        remaining,
        status,
        categoryNames,
        range
      };
    });

    res.json({ budgets: enriched });
  },

  create(req, res) {
    const { name, category_ids, amount, time_frame, start_date, end_date, alert_threshold } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Budget name is required.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid budget amount greater than 0 is required.' });
    }

    if (!time_frame || !['monthly', 'yearly', 'custom'].includes(time_frame)) {
      return res.status(400).json({ error: 'Valid time frame (monthly, yearly, custom) is required.' });
    }

    if (time_frame === 'custom' && (!start_date || !end_date)) {
      return res.status(400).json({ error: 'Start date and end date are required for custom time frame.' });
    }

    const catStr = Array.isArray(category_ids) ? category_ids.join(',') : (category_ids || 'all');

    try {
      const budget = BudgetModel.create({
        userId: req.user.id,
        name: name.trim(),
        category_ids: catStr,
        amount: numAmount,
        time_frame,
        start_date,
        end_date,
        alert_threshold: parseFloat(alert_threshold) || 80.0
      });

      res.status(201).json({ message: 'Budget created successfully!', budget });
    } catch (err) {
      console.error('Create budget error:', err);
      res.status(500).json({ error: 'Failed to create budget.' });
    }
  },

  update(req, res) {
    const { name, category_ids, amount, time_frame, start_date, end_date, alert_threshold } = req.body;
    const budgetId = req.params.id;

    const existing = BudgetModel.getById(budgetId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found.' });
    }

    const catStr = Array.isArray(category_ids) ? category_ids.join(',') : category_ids;

    const updated = BudgetModel.update(budgetId, req.user.id, {
      name,
      category_ids: catStr,
      amount,
      time_frame,
      start_date,
      end_date,
      alert_threshold
    });

    res.json({ message: 'Budget updated successfully!', budget: updated });
  },

  delete(req, res) {
    const budgetId = req.params.id;
    const existing = BudgetModel.getById(budgetId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found.' });
    }

    BudgetModel.delete(budgetId, req.user.id);
    res.json({ message: 'Budget deleted successfully!' });
  }
};

module.exports = BudgetController;
