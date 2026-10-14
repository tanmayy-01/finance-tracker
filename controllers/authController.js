const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');
const CategoryModel = require('../models/categoryModel');
const { generateToken } = require('../middleware/auth');

const AuthController = {
  // Register: only takes username, full_name, and password
  register(req, res) {
    const { username, full_name, password } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check duplicate username
    const existing = UserModel.findByUsername(cleanUsername);
    if (existing) {
      return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      const user = UserModel.create({
        username: cleanUsername,
        full_name: full_name.trim(),
        password_hash: passwordHash
      });

      // Seed default categories
      CategoryModel.seedDefaults(user.id);

      const token = generateToken(user);
      res.status(201).json({
        message: 'Registration successful!',
        token,
        user
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Failed to create user account.' });
    }
  },

  // Login
  login(req, res) {
    const { username, identifier, password } = req.body;
    const userIdentifier = (username || identifier || '').trim().toLowerCase();

    if (!userIdentifier || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = UserModel.findByUsernameOrEmail(userIdentifier);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      date_of_birth: user.date_of_birth,
      address: user.address,
      profile_pic: user.profile_pic
    };

    const token = generateToken(safeUser);
    res.json({
      message: 'Login successful!',
      token,
      user: safeUser
    });
  },

  // Get current user profile
  getMe(req, res) {
    res.json({ user: req.user });
  },

  // Update profile
  updateProfile(req, res) {
    const { full_name, username, phone, date_of_birth, address, profile_pic } = req.body;
    const userId = req.user.id;

    if (username && username.trim()) {
      const cleanUsername = username.trim().toLowerCase();
      const existing = UserModel.findByUsername(cleanUsername);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'This username is already taken by another user.' });
      }
    }

    try {
      const updatedUser = UserModel.updateProfile(userId, req.user, {
        full_name,
        username,
        phone,
        date_of_birth,
        address,
        profile_pic
      });

      res.json({ message: 'Profile updated successfully!', user: updatedUser });
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  },

  // Change password
  changePassword(req, res) {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const userWithHash = UserModel.findByUsernameOrEmail(req.user.username);
    const isMatch = bcrypt.compareSync(current_password, userWithHash.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    UserModel.updatePassword(req.user.id, newHash);

    res.json({ message: 'Password changed successfully!' });
  }
};

module.exports = AuthController;
