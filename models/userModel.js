const db = require('../config/db');

const UserModel = {
  findById(id) {
    return db.prepare(`
      SELECT id, username, full_name, email, phone, date_of_birth, address, profile_pic
      FROM users
      WHERE id = ?
    `).get(id);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(username.trim().toLowerCase());
  },

  findByUsernameOrEmail(identifier) {
    const cleaned = identifier.trim().toLowerCase();
    return db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(cleaned, cleaned);
  },

  create({ username, full_name, password_hash }) {
    const stmt = db.prepare(`
      INSERT INTO users (username, full_name, password_hash)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(username.trim().toLowerCase(), full_name.trim(), password_hash);
    return this.findById(result.lastInsertRowid);
  },

  updateProfile(id, current, { full_name, username, phone, date_of_birth, address, profile_pic }) {
    db.prepare(`
      UPDATE users
      SET full_name = ?,
          username = ?,
          phone = ?,
          date_of_birth = ?,
          address = ?,
          profile_pic = COALESCE(?, profile_pic)
      WHERE id = ?
    `).run(
      full_name !== undefined ? full_name.trim() : current.full_name,
      username && username.trim() ? username.trim().toLowerCase() : current.username,
      phone !== undefined ? phone.trim() : current.phone,
      date_of_birth !== undefined ? date_of_birth : current.date_of_birth,
      address !== undefined ? address.trim() : current.address,
      profile_pic !== undefined ? profile_pic : null,
      id
    );
    return this.findById(id);
  },

  updatePassword(id, password_hash) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);
  }
};

module.exports = UserModel;
