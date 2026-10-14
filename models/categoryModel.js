const db = require('../config/db');

const defaultCategories = [
  // Expenses
  { name: 'Groceries', type: 'expense', color: '#10b981' },
  { name: 'Housing & Rent', type: 'expense', color: '#8b5cf6' },
  { name: 'Utilities', type: 'expense', color: '#3b82f6' },
  { name: 'Dining & Food', type: 'expense', color: '#f59e0b' },
  { name: 'Transportation', type: 'expense', color: '#06b6d4' },
  { name: 'Entertainment', type: 'expense', color: '#ec4899' },
  { name: 'Healthcare', type: 'expense', color: '#ef4444' },
  { name: 'Shopping', type: 'expense', color: '#f97316' },
  { name: 'Education', type: 'expense', color: '#14b8a6' },
  { name: 'Miscellaneous', type: 'expense', color: '#64748b' },
  // Income
  { name: 'Salary', type: 'income', color: '#22c55e' },
  { name: 'Freelance & Projects', type: 'income', color: '#38bdf8' },
  { name: 'Investments', type: 'income', color: '#a855f7' },
  { name: 'Gift / Bonus', type: 'income', color: '#fbbf24' },
  { name: 'Other Income', type: 'income', color: '#94a3b8' }
];

const CategoryModel = {
  getAll(userId) {
    return db.prepare(`
      SELECT * FROM categories
      WHERE user_id = ?
      ORDER BY type ASC, name ASC
    `).all(userId);
  },

  getById(id, userId) {
    return db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  },

  findDuplicate(userId, name, type, excludeId = null) {
    let query = 'SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = ? AND type = ?';
    const params = [userId, name.trim().toLowerCase(), type];
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    return db.prepare(query).get(...params);
  },

  create({ userId, name, type, color }) {
    const stmt = db.prepare(`
      INSERT INTO categories (user_id, name, type, color)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(userId, name.trim(), type, color || '#6366f1');
    return this.getById(result.lastInsertRowid, userId);
  },

  update(id, userId, { name, type, color }) {
    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          color = COALESCE(?, color)
      WHERE id = ? AND user_id = ?
    `).run(name ? name.trim() : null, type || null, color || null, id, userId);
    return this.getById(id, userId);
  },

  delete(id, userId) {
    return db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId);
  },

  seedDefaults(userId) {
    const insert = db.prepare(`
      INSERT INTO categories (user_id, name, type, color)
      VALUES (?, ?, ?, ?)
    `);
    const insertMany = db.transaction((categories) => {
      for (const cat of categories) {
        insert.run(userId, cat.name, cat.type, cat.color);
      }
    });
    insertMany(defaultCategories);
  }
};

module.exports = CategoryModel;
