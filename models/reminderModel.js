const db = require('../config/db');

const ReminderModel = {
  getAll(userId) {
    return db.prepare(`
      SELECT
        r.*,
        c.name AS category_name,
        c.color AS category_color
      FROM payment_reminders r
      LEFT JOIN categories c ON r.category_id = c.id
      WHERE r.user_id = ?
      ORDER BY r.is_paid ASC, r.due_date ASC
    `).all(userId);
  },

  getUpcoming(userId, maxDate) {
    return db.prepare(`
      SELECT r.*, c.name AS category_name, c.color AS category_color
      FROM payment_reminders r
      LEFT JOIN categories c ON r.category_id = c.id
      WHERE r.user_id = ? AND r.is_paid = 0 AND r.due_date <= ?
      ORDER BY r.due_date ASC
    `).all(userId, maxDate);
  },

  getById(id, userId) {
    return db.prepare(`
      SELECT r.*, c.name as category_name, c.color as category_color
      FROM payment_reminders r
      LEFT JOIN categories c ON r.category_id = c.id
      WHERE r.id = ? AND r.user_id = ?
    `).get(id, userId);
  },

  create({ userId, title, category_id, amount, due_date, frequency, notification_method }) {
    const stmt = db.prepare(`
      INSERT INTO payment_reminders (user_id, title, category_id, amount, due_date, frequency, notification_method)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      title.trim(),
      category_id ? parseInt(category_id) : null,
      amount ? parseFloat(amount) : 0,
      due_date,
      frequency,
      notification_method || 'in-app'
    );
    return this.getById(result.lastInsertRowid, userId);
  },

  update(id, userId, { title, category_id, amount, due_date, frequency, notification_method }) {
    db.prepare(`
      UPDATE payment_reminders
      SET title = COALESCE(?, title),
          category_id = ?,
          amount = COALESCE(?, amount),
          due_date = COALESCE(?, due_date),
          frequency = COALESCE(?, frequency),
          notification_method = COALESCE(?, notification_method)
      WHERE id = ? AND user_id = ?
    `).run(
      title ? title.trim() : null,
      category_id ? parseInt(category_id) : null,
      amount !== undefined ? parseFloat(amount) : null,
      due_date || null,
      frequency || null,
      notification_method || null,
      id,
      userId
    );
    return this.getById(id, userId);
  },

  togglePaid(id, userId) {
    const current = this.getById(id, userId);
    if (!current) return null;
    const newStatus = current.is_paid ? 0 : 1;
    db.prepare('UPDATE payment_reminders SET is_paid = ? WHERE id = ? AND user_id = ?').run(newStatus, id, userId);
    return newStatus;
  },

  delete(id, userId) {
    return db.prepare('DELETE FROM payment_reminders WHERE id = ? AND user_id = ?').run(id, userId);
  }
};

module.exports = ReminderModel;
