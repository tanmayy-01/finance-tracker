const CategoryModel = require('../models/categoryModel');

const CategoryController = {
  getAll(req, res) {
    const categories = CategoryModel.getAll(req.user.id);
    res.json({ categories });
  },

  create(req, res) {
    const { name, type, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "income" or "expense".' });
    }

    const existing = CategoryModel.findDuplicate(req.user.id, name, type);
    if (existing) {
      return res.status(400).json({ error: `A category named "${name.trim()}" already exists for ${type}.` });
    }

    const category = CategoryModel.create({
      userId: req.user.id,
      name,
      type,
      color
    });

    res.status(201).json({ message: 'Category added successfully!', category });
  },

  update(req, res) {
    const { name, type, color } = req.body;
    const categoryId = req.params.id;

    const cat = CategoryModel.getById(categoryId, req.user.id);
    if (!cat) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    if (name && name.trim()) {
      const existing = CategoryModel.findDuplicate(req.user.id, name, type || cat.type, categoryId);
      if (existing) {
        return res.status(400).json({ error: `Another category named "${name.trim()}" already exists.` });
      }
    }

    const updated = CategoryModel.update(categoryId, req.user.id, { name, type, color });
    res.json({ message: 'Category updated successfully!', category: updated });
  },

  delete(req, res) {
    const categoryId = req.params.id;
    const cat = CategoryModel.getById(categoryId, req.user.id);
    if (!cat) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    CategoryModel.delete(categoryId, req.user.id);
    res.json({ message: 'Category deleted successfully!' });
  }
};

module.exports = CategoryController;
