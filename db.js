// Re-export from config/db.js for backwards compatibility
const db = require('./config/db');
const CategoryModel = require('./models/categoryModel');

module.exports = {
  db,
  seedUserDefaultCategories: (userId) => CategoryModel.seedDefaults(userId)
};
