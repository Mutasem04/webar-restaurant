/**
 * Joi Validation Schemas
 */
const Joi = require('joi');

const signupSchema = Joi.object({
    email: Joi.string().email().required().messages({ 'string.email': 'Invalid email', 'any.required': 'Email is required' }),
    password: Joi.string().min(8).required().messages({ 'string.min': 'Password must be 8+ characters', 'any.required': 'Password is required' }),
    businessName: Joi.string().max(100).optional()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const menuItemSchema = Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).optional()
});

const brandingSchema = Joi.object({
    brandColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    customCSS: Joi.string().max(5000).optional(),
    headerText: Joi.string().max(200).optional(),
    footerText: Joi.string().max(200).optional()
});

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, error: 'Validation failed', details: error.details.map(d => d.message) });
    next();
};

module.exports = { signupSchema, loginSchema, menuItemSchema, brandingSchema, validate };