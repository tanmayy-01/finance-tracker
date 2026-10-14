const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'finance.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    date_of_birth TEXT,
    address TEXT,
    profile_pic TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category_id INTEGER,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category_ids TEXT NOT NULL,
    amount REAL NOT NULL,
    time_frame TEXT NOT NULL CHECK(time_frame IN ('monthly', 'yearly', 'custom')),
    start_date TEXT,
    end_date TEXT,
    alert_threshold REAL DEFAULT 80.0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payment_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category_id INTEGER,
    amount REAL DEFAULT 0,
    due_date TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('once', 'monthly', 'quarterly', 'yearly')),
    notification_method TEXT DEFAULT 'in-app',
    is_paid INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );
`);

// Seed default categories for newly registered users
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

function seedUserDefaultCategories(userId) {
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

module.exports = {
  db,
  seedUserDefaultCategories
};
