const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'securevault_secret');
    
    // Check Redis cache first
    const { redis, isReady } = require('../config/redis');
    let user = null;
    const cacheKey = `user:session:${decoded.id}`;
    
    if (isReady()) {
      const cached = await redis.get(cacheKey);
      if (cached) user = JSON.parse(cached);
    }
    
    // Fallback to MongoDB if not cached
    if (!user) {
      user = await User.findById(decoded.id).select('-password').lean();
      if (user && isReady()) {
        await redis.set(cacheKey, JSON.stringify(user), 'EX', 300); // 5 min TTL
      }
    }
    
    req.user = user;
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Role ${req.user.role} is not authorized` });
  }
  next();
};
