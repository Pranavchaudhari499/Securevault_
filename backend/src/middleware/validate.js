/**
 * validate.js
 * Generic Joi validation middleware.
 * Usage: router.post('/route', validate(schema), controller)
 */

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,      // Collect ALL errors, not just first
    stripUnknown: true,     // Remove fields not in schema (e.g. injected 'role')
    convert: true,          // Auto-coerce types (e.g. "123" -> 123)
  });

  if (error) {
    const errors = error.details.map((d) => d.message.replace(/['"]/g, ''));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = value; // Replace body with sanitised, validated value
  next();
};

module.exports = validate;
