const Joi = require('joi');

// ── Register ────────────────────────────────────────────────────────────────────
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required()
    .messages({ 'string.min': 'Name must be at least 2 characters', 'any.required': 'Name is required' }),

  email: Joi.string().email().lowercase().required()
    .messages({ 'string.email': 'Please provide a valid email', 'any.required': 'Email is required' }),

  password: Joi.string().min(6).max(128).required()
    .messages({ 'string.min': 'Password must be at least 6 characters', 'any.required': 'Password is required' }),

  phone: Joi.string().pattern(/^\d{10}$/).optional().allow('')
    .messages({ 'string.pattern.base': 'Phone number must be exactly 10 digits' }),
});

// ── Login ───────────────────────────────────────────────────────────────────────
const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required()
    .messages({ 'string.email': 'Please provide a valid email', 'any.required': 'Email is required' }),

  password: Joi.string().required()
    .messages({ 'any.required': 'Password is required' }),
});

module.exports = { registerSchema, loginSchema };
