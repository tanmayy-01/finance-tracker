const TransactionModel = require('../models/transactionModel');

const TransactionController = {
  getAll(req, res) {
    const { search, category_id, type, startDate, endDate, sort, page = 1, limit = 10 } = req.query;
    const result = TransactionModel.getAll(req.user.id, {
      search,
      category_id,
      type,
      startDate,
      endDate,
      sort,
      page,
      limit
    });
    res.json(result);
  },

  create(req, res) {
    const { type, category_id, amount, date, notes } = req.body;

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Valid transaction type (income/expense) is required.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount greater than 0.' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Transaction date is required.' });
    }

    try {
      const transaction = TransactionModel.create({
        userId: req.user.id,
        type,
        category_id,
        amount: numAmount,
        date,
        notes
      });
      res.status(201).json({ message: 'Transaction recorded successfully!', transaction });
    } catch (err) {
      console.error('Add transaction error:', err);
      res.status(500).json({ error: 'Failed to record transaction.' });
    }
  },

  update(req, res) {
    const { type, category_id, amount, date, notes } = req.body;
    const transactionId = req.params.id;

    const existing = TransactionModel.getById(transactionId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount greater than 0 is required.' });
    }

    const updated = TransactionModel.update(transactionId, req.user.id, {
      type,
      category_id,
      amount: numAmount,
      date,
      notes
    });

    res.json({ message: 'Transaction updated successfully!', transaction: updated });
  },

  delete(req, res) {
    const transactionId = req.params.id;
    const existing = TransactionModel.getById(transactionId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    TransactionModel.delete(transactionId, req.user.id);
    res.json({ message: 'Transaction deleted successfully!' });
  },

  exportCSV(req, res) {
    const { search, category_id, type, startDate, endDate } = req.query;
    const rows = TransactionModel.getExportRows(req.user.id, {
      search,
      category_id,
      type,
      startDate,
      endDate
    });

    let csv = 'Date,Category,Transaction Type,Amount,Notes\r\n';
    rows.forEach(r => {
      const date = r.date || '';
      const cat = `"${(r.category || 'Uncategorized').replace(/"/g, '""')}"`;
      const tType = r.type ? r.type.toUpperCase() : '';
      const amt = Number(r.amount).toFixed(2);
      const notes = `"${(r.notes || '').replace(/"/g, '""')}"`;
      csv += `${date},${cat},${tType},${amt},${notes}\r\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
    res.send(csv);
  }
};

module.exports = TransactionController;
