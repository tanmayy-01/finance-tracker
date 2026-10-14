const db = require('../config/db');

const TransactionModel = {
  buildFilterQuery(userId, filters) {
    let whereClauses = ['t.user_id = ?'];
    let params = [userId];

    if (filters.search && filters.search.trim()) {
      whereClauses.push('(t.notes LIKE ? OR c.name LIKE ?)');
      const searchTerm = `%${filters.search.trim()}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.category_id && filters.category_id !== 'all') {
      whereClauses.push('t.category_id = ?');
      params.push(filters.category_id);
    }

    if (filters.type && filters.type !== 'all') {
      whereClauses.push('t.type = ?');
      params.push(filters.type);
    }

    if (filters.startDate) {
      whereClauses.push('t.date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('t.date <= ?');
      params.push(filters.endDate);
    }

    return {
      whereSql: whereClauses.join(' AND '),
      params
    };
  },

  getAll(userId, filters) {
    const { whereSql, params } = this.buildFilterQuery(userId, filters);

    let orderSql = 't.date DESC, t.id DESC';
    if (filters.sort === 'date_asc') orderSql = 't.date ASC, t.id ASC';
    else if (filters.sort === 'date_desc') orderSql = 't.date DESC, t.id DESC';
    else if (filters.sort === 'amount_desc') orderSql = 't.amount DESC';
    else if (filters.sort === 'amount_asc') orderSql = 't.amount ASC';
    else if (filters.sort === 'category_asc') orderSql = 'c.name ASC';

    const limitNum = Math.max(1, parseInt(filters.limit) || 10);
    const pageNum = Math.max(1, parseInt(filters.page) || 1);
    const offset = (pageNum - 1) * limitNum;

    const transactions = db.prepare(`
      SELECT
        t.*,
        c.name AS category_name,
        c.color AS category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${whereSql}
    `).get(...params);

    const total = countRow ? countRow.total : 0;

    return {
      transactions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1
    };
  },

  getExportRows(userId, filters) {
    const { whereSql, params } = this.buildFilterQuery(userId, filters);
    return db.prepare(`
      SELECT
        t.date,
        c.name AS category,
        t.type,
        t.amount,
        t.notes
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${whereSql}
      ORDER BY t.date DESC
    `).all(...params);
  },

  getById(id, userId) {
    return db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ? AND t.user_id = ?
    `).get(id, userId);
  },

  create({ userId, type, category_id, amount, date, notes }) {
    const stmt = db.prepare(`
      INSERT INTO transactions (user_id, type, category_id, amount, date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      type,
      category_id ? parseInt(category_id) : null,
      amount,
      date,
      notes ? notes.trim() : ''
    );
    return this.getById(result.lastInsertRowid, userId);
  },

  update(id, userId, { type, category_id, amount, date, notes }) {
    db.prepare(`
      UPDATE transactions
      SET type = COALESCE(?, type),
          category_id = ?,
          amount = ?,
          date = COALESCE(?, date),
          notes = COALESCE(?, notes)
      WHERE id = ? AND user_id = ?
    `).run(
      type || null,
      category_id ? parseInt(category_id) : null,
      amount,
      date || null,
      notes !== undefined ? notes.trim() : null,
      id,
      userId
    );
    return this.getById(id, userId);
  },

  delete(id, userId) {
    return db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
  },

  getRecent(userId, limit = 5) {
    return db.prepare(`
      SELECT
        t.*,
        c.name AS category_name,
        c.color AS category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.date DESC, t.id DESC
      LIMIT ?
    `).all(userId, limit);
  },

  getTotals(userId, startOfMonth, endOfMonth) {
    return db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
        COALESCE(SUM(CASE WHEN type = 'income' AND date BETWEEN ? AND ? THEN amount ELSE 0 END), 0) AS month_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND date BETWEEN ? AND ? THEN amount ELSE 0 END), 0) AS month_expenses
      FROM transactions
      WHERE user_id = ?
    `).get(startOfMonth, endOfMonth, startOfMonth, endOfMonth, userId);
  },

  getCategoryExpenses(userId) {
    return db.prepare(`
      SELECT
        c.name,
        c.color,
        COALESCE(SUM(t.amount), 0) AS amount
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = 'expense'
      GROUP BY c.id, c.name, c.color
      ORDER BY amount DESC
    `).all(userId);
  },

  getDailyExpenses(userId, startDate, endDate) {
    return db.prepare(`
      SELECT date, COALESCE(SUM(amount), 0) as amount
      FROM transactions
      WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date ASC
    `).all(userId, startDate, endDate);
  },

  getIncomeVsExpenseSummary(userId, startDate, endDate) {
    return db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses
      FROM transactions
      WHERE user_id = ? AND date BETWEEN ? AND ?
    `).get(userId, startDate, endDate);
  },

  getMonthlyBreakdown(userId, startDate, endDate) {
    return db.prepare(`
      SELECT
        substr(date, 1, 7) as month,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
      FROM transactions
      WHERE user_id = ? AND date BETWEEN ? AND ?
      GROUP BY substr(date, 1, 7)
      ORDER BY month ASC
    `).all(userId, startDate, endDate);
  },

  getCategorySpendingReport(userId, startDate, endDate) {
    return db.prepare(`
      SELECT
        c.id,
        c.name,
        c.color,
        COALESCE(SUM(t.amount), 0) as amount,
        COUNT(t.id) as transaction_count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.color
      ORDER BY amount DESC
    `).all(userId, startDate, endDate);
  }
};

module.exports = TransactionModel;
