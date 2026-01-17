/**
 * API Response Helpers
 */
const success = (res, data, statusCode = 200) => res.status(statusCode).json({ success: true, ...data });
const error = (res, message, statusCode = 400) => res.status(statusCode).json({ success: false, error: message });
const created = (res, data) => success(res, data, 201);
const notFound = (res, message = 'Resource not found') => error(res, message, 404);
const unauthorized = (res, message = 'Unauthorized') => error(res, message, 401);
const forbidden = (res, message = 'Forbidden') => error(res, message, 403);
const serverError = (res, message = 'Internal server error') => error(res, message, 500);

module.exports = { success, error, created, notFound, unauthorized, forbidden, serverError };