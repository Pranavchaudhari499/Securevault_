const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/authValidator');

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login',    loginLimiter,    validate(loginSchema),    login);

module.exports = router;