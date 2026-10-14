const db = require('../config/db');

const BudgetModel = {
  getAll(userId) {
    return db.prepare('SELECT * FROM budgets WHERE user_id = ? ORDER BY id DESC').all(userId);
  },

  getById(id, userId) {
    return db.prepare('SELECT * FROM budgets WHERE id = ? AND user_id = ?').get(id, userId);
  },

  create({ userId, name, category_ids, amount, time_frame, start_date, end_date, alert_threshold }) {
    const stmt = db.prepare(`
      INSERT INTO budgets (user_id, name, category_ids, amount, time_frame, start_date, end_date, alert_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      name.trim(),
      category_ids,
      amount,
      time_frame,
      start_date || null,
      end_date || null,
      alert_threshold || 80.0
    );
    return this.getById(result.lastInsertRowid, userId);
  },

  update(id, userId, { name, category_ids, amount, time_frame, start_date, end_date, alert_threshold }) {
    db.prepare(`
      UPDATE budgets
      SET name = COALESCE(?, name),
          category_ids = COALESCE(?, category_ids),
          amount = COALESCE(?, amount),
          time_frame = COALESCE(?, time_frame),
          start_date = ?,
          end_date = ?,
          alert_threshold = COALESCE(?, alert_threshold)
      WHERE id = ? AND user_id = ?
    `).run(
      name ? name.trim() : null,
      category_ids || null,
      amount ? parseFloat(amount) : null,
      time_frame || null,
      start_date || null,
      end_date || null,
      alert_threshold ? parseFloat(alert_threshold) : null,
      id,
      userId
    );
    return this.getById(id, userId);
  },

  delete(id, userId) {
    return db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(id, userId);
  },

  getSpent(userId, catIds, startDate, endDate) {
    let query = `
      SELECT COALESCE(SUM(amount), 0) as spent
      FROM transactions
      WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
    `;
    const params = [userId, startDate, endDate];

    if (catIds.length > 0 && !catIds.includes('all')) {
      const placeholders = catIds.map(() => '?').join(',');
      query += ` AND category_id IN (${placeholders})`;
      params.push(...catIds);
    }

    const row = db.prepare(query).get(...params);
    return row ? row.spent : 0;
  }
};

module.exports = BudgetModel;
