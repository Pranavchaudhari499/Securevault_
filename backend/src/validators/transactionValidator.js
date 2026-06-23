const Joi = require('joi');

const TRANSACTION_TYPES = ['upi_payment', 'bank_transfer', 'bill_payment', 'withdrawal', 'top_up'];

// ── Create Transaction ──────────────────────────────────────────────────────────
const createTransactionSchema = Joi.object({
  type: Joi.string().valid(...TRANSACTION_TYPES).required()
    .messages({ 'any.only': `Transaction type must be one of: ${TRANSACTION_TYPES.join(', ')}`, 'any.required': 'Transaction type is required' }),

  amount: Joi.number().positive().max(1000000).required()
    .messages({ 'number.positive': 'Amount must be positive', 'number.max': 'Amount cannot exceed Rs.10,00,000', 'any.required': 'Amount is required' }),

  recipientUpi: Joi.when('type', {
    is: 'upi_payment',
    then: Joi.string().pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/).required()
      .messages({ 'string.pattern.base': 'Invalid UPI ID format', 'any.required': 'Recipient UPI ID is required for UPI payments' }),
    otherwise: Joi.string().optional().allow('', null),
  }),

  recipientAccount: Joi.when('type', {
    is: 'bank_transfer',
    then: Joi.string().pattern(/^\d{9,18}$/).required()
      .messages({ 'string.pattern.base': 'Account number must be 9–18 digits', 'any.required': 'Account number is required for bank transfers' }),
    otherwise: Joi.string().optional().allow('', null),
  }),

  description: Joi.string().trim().max(200).optional().allow('', null),

  biometrics: Joi.object().optional().allow(null),
});

// ── Top Up ──────────────────────────────────────────────────────────────────────
const topUpSchema = Joi.object({
  amount: Joi.number().positive().min(1).max(100000).required()
    .messages({ 'number.positive': 'Top-up amount must be positive', 'number.min': 'Minimum top-up is Rs.1', 'number.max': 'Maximum top-up is Rs.1,00,000', 'any.required': 'Amount is required' }),
});

module.exports = { createTransactionSchema, topUpSchema };
