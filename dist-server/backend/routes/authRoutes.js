"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            include: {
                company: true,
                userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
                userPlantAccess: { include: { plant: true } },
                userDepartmentAccess: { include: { department: true } },
            },
        });
        if (!user || user.status !== 'ACTIVE') {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, auth_1.JWT_SECRET, { expiresIn: '24h' });
        await prisma_1.prisma.userSession.create({
            data: {
                userId: user.id,
                tokenHash: jsonwebtoken_1.default.sign({ userId: user.id, ts: Date.now() }, auth_1.JWT_SECRET),
                ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
                userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        }).catch(() => { });
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        }).catch(() => { });
        const roles = user.userRoles.map((ur) => ur.role.roleName);
        const permissionSet = new Set();
        user.userRoles.forEach((ur) => {
            ur.role.rolePermissions.forEach((rp) => {
                permissionSet.add(rp.permission.permissionCode);
            });
        });
        await auditService_1.AuditService.log({
            userId: user.id,
            userEmail: user.email,
            companyId: user.companyId || undefined,
            entity: 'User',
            recordId: user.id,
            action: 'LOGIN',
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
            correlationId: req.correlationId,
        });
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    companyId: user.companyId,
                    companyName: user.company?.displayName || 'System Wide',
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    roles,
                    permissions: Array.from(permissionSet),
                    plants: user.userPlantAccess.map((pa) => ({ id: pa.plant.id, code: pa.plant.plantCode, name: pa.plant.plantName })),
                    departments: user.userDepartmentAccess.map((da) => ({ id: da.department.id, code: da.department.departmentCode, name: da.department.departmentName })),
                },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/auth/logout
router.post('/logout', auth_1.requireAuth, async (req, res) => {
    if (req.user) {
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: req.user.companyId || undefined,
            entity: 'User',
            recordId: req.user.id,
            action: 'LOGOUT',
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
            correlationId: req.correlationId,
        });
    }
    res.json({ success: true, message: 'Logged out successfully' });
});
// POST /api/v1/auth/revoke-session
router.post('/revoke-session', auth_1.requireAuth, async (req, res) => {
    const { targetUserId } = req.body;
    const targetId = targetUserId || req.user.id;
    await prisma_1.prisma.userSession.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    await auditService_1.AuditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        companyId: req.user.companyId || undefined,
        entity: 'UserSession',
        recordId: targetId,
        action: 'DEACTIVATE',
        reason: 'Session revoked via security controller',
        correlationId: req.correlationId,
    });
    res.json({ success: true, message: `Active sessions revoked for user ${targetId}` });
});
// GET /api/v1/auth/me
router.get('/me', auth_1.requireAuth, async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                company: true,
                userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
                userPlantAccess: { include: { plant: true } },
                userDepartmentAccess: { include: { department: true } },
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const roles = user.userRoles.map((ur) => ur.role.roleName);
        const permissionSet = new Set();
        user.userRoles.forEach((ur) => {
            ur.role.rolePermissions.forEach((rp) => {
                permissionSet.add(rp.permission.permissionCode);
            });
        });
        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                companyId: user.companyId,
                companyName: user.company?.displayName || 'System Wide',
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                roles,
                permissions: Array.from(permissionSet),
                plants: user.userPlantAccess.map((pa) => ({ id: pa.plant.id, code: pa.plant.plantCode, name: pa.plant.plantName })),
                departments: user.userDepartmentAccess.map((da) => ({ id: da.department.id, code: da.department.departmentCode, name: da.department.departmentName })),
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
