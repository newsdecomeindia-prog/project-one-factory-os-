"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] [${req.correlationId || 'NO-ID'}] ${req.method} ${req.url}:`, err);
    const statusCode = err.statusCode || err.status || 500;
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'An internal server error occurred'
        : err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        error: message,
        correlationId: req.correlationId,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
