"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceDepartmentAccess = exports.enforcePlantAccess = exports.requirePermission = exports.requireAuth = exports.correlationMiddleware = exports.rateLimiter = exports.extractStringParam = exports.JWT_SECRET = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../database/prisma");
exports.JWT_SECRET = process.env.JWT_SECRET || 'project_one_super_secret_jwt_key_2026';
// Helper to extract param/query/body as string
const extractStringParam = (req, source, key) => {
    const val = req[source]?.[key];
    if (typeof val === 'string')
        return val;
    if (Array.isArray(val) && typeof val[0] === 'string')
        return val[0];
    return undefined;
};
exports.extractStringParam = extractStringParam;
// Simple In-Memory Rate Limiter Foundation
const rateLimitMap = new Map();
const rateLimiter = (maxRequests = 100, windowMs = 60 * 1000) => {
    return (req, res, next) => {
        const ip = (typeof req.ip === 'string' ? req.ip : '127.0.0.1');
        const now = Date.now();
        const record = rateLimitMap.get(ip);
        if (!record || now > record.resetAt) {
            rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (record.count >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Rate limit exceeded.',
            });
        }
        record.count++;
        next();
    };
};
exports.rateLimiter = rateLimiter;
// Attach Request Correlation ID middleware
const correlationMiddleware = (req, res, next) => {
    const headerVal = req.headers['x-correlation-id'];
    const correlationId = typeof headerVal === 'string' ? headerVal : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
};
exports.correlationMiddleware = correlationMiddleware;
// Require JWT Authentication Middleware
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Authentication token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
                userPlantAccess: true,
                userDepartmentAccess: true,
            },
        });
        if (!user || user.status !== 'ACTIVE') {
            return res.status(401).json({ success: false, error: 'User account is inactive or invalid' });
        }
        const roles = user.userRoles.map((ur) => ur.role.roleName);
        const isSuperAdmin = roles.includes('Super Admin');
        const permissionSet = new Set();
        user.userRoles.forEach((ur) => {
            ur.role.rolePermissions.forEach((rp) => {
                permissionSet.add(rp.permission.permissionCode);
            });
        });
        const plantIds = user.userPlantAccess.map((pa) => pa.plantId);
        const departmentIds = user.userDepartmentAccess.map((da) => da.departmentId);
        req.user = {
            id: user.id,
            email: user.email,
            companyId: user.companyId,
            firstName: user.firstName,
            lastName: user.lastName,
            roles,
            permissions: Array.from(permissionSet),
            plantIds,
            departmentIds,
            isSuperAdmin,
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
};
exports.requireAuth = requireAuth;
// RBAC Middleware: Require specific permission
const requirePermission = (permissionCode) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (req.user.isSuperAdmin || req.user.permissions.includes(permissionCode)) {
            return next();
        }
        return res.status(403).json({
            success: false,
            error: `Access denied. Required permission: '${permissionCode}'`,
        });
    };
};
exports.requirePermission = requirePermission;
// Plant Access Isolation Middleware
const enforcePlantAccess = (plantIdSource = 'params', paramKey = 'plantId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (req.user.isSuperAdmin) {
            return next();
        }
        const targetPlantId = (0, exports.extractStringParam)(req, plantIdSource, paramKey);
        if (!targetPlantId) {
            return next();
        }
        if (!req.user.plantIds.includes(targetPlantId)) {
            return res.status(403).json({
                success: false,
                error: `Forbidden: You do not have access authorization for Plant ID '${targetPlantId}'`,
            });
        }
        next();
    };
};
exports.enforcePlantAccess = enforcePlantAccess;
// Department Access Isolation Middleware
const enforceDepartmentAccess = (deptIdSource = 'params', paramKey = 'departmentId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (req.user.isSuperAdmin) {
            return next();
        }
        const targetDeptId = (0, exports.extractStringParam)(req, deptIdSource, paramKey);
        if (!targetDeptId) {
            return next();
        }
        if (!req.user.departmentIds.includes(targetDeptId)) {
            return res.status(403).json({
                success: false,
                error: `Forbidden: You do not have access authorization for Department ID '${targetDeptId}'`,
            });
        }
        next();
    };
};
exports.enforceDepartmentAccess = enforceDepartmentAccess;
