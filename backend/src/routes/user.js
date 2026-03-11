const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/notifications', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notifications');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Only return suspension/blocked notifications (not flagged/review)
    const filtered = (user.notifications || [])
      .filter(n => n.type === 'blocked' || n.type === 'verify' || n.type === 'info')
      .reverse();
    res.json({ success: true, notifications: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/notifications/read', protect, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $set: { 'notifications.$[].read': true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;