const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const logger = require('../utils/logger');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || 'securevault_secret', { expiresIn: '7d' });

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    if (phone && phone.length > 10) return res.status(400).json({ success: false, message: 'Phone number must be 10 digits or less' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    const userRole = 'user'; // Public registration is always 'user'. Admin/officer roles are seeded only.
    const upiId = `${email.split('@')[0]}@securevault`;
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const user = await User.create({ name, email, password, role: userRole, phone, upiId, accountNumber });
    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, upiId: user.upiId, balance: user.balance } });
  } catch (error) {
    logger.error(`Register error: ${error.message}`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = signToken(user._id);
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, upiId: user.upiId, balance: user.balance, riskScore: user.riskScore, riskLevel: user.riskLevel, isSuspended: user.isSuspended, suspendedReason: user.suspendedReason } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};