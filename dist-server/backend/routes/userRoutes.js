"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/users (Tenant Isolated)
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('user:read'), async (req, res) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
            where: {
                ...(!req.user.isSuperAdmin && req.user.companyId && { companyId: req.user.companyId }),
            },
            include: {
                company: true,
                userRoles: { include: { role: true } },
                userPlantAccess: { include: { plant: true } },
                userDepartmentAccess: { include: { department: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const formatted = users.map((u) => ({
            id: u.id,
            email: u.email,
            companyId: u.companyId,
            companyName: u.company?.displayName || 'N/A',
            firstName: u.firstName,
            lastName: u.lastName,
            phone: u.phone,
            status: u.status,
            createdAt: u.createdAt,
            roles: u.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.roleName })),
            plants: u.userPlantAccess.map((pa) => ({ id: pa.plant.id, code: pa.plant.plantCode, name: pa.plant.plantName })),
            departments: u.userDepartmentAccess.map((da) => ({ id: da.department.id, code: da.department.departmentCode, name: da.department.departmentName })),
        }));
        res.json({ success: true, data: formatted });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/users
router.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('user:create'), async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, companyId, roleIds, plantIds, departmentIds } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ success: false, error: 'email, password, firstName, and lastName are required' });
        }
        const targetCompanyId = req.user.isSuperAdmin ? companyId : req.user.companyId;
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, error: `User with email '${email}' already exists.` });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                companyId: targetCompanyId,
                passwordHash,
                firstName,
                lastName,
                phone,
            },
        });
        if (Array.isArray(roleIds) && roleIds.length > 0) {
            for (const roleId of roleIds) {
                if (typeof roleId === 'string') {
                    await prisma_1.prisma.userRole.create({ data: { userId: user.id, roleId } }).catch(() => { });
                }
            }
        }
        if (Array.isArray(plantIds) && plantIds.length > 0) {
            for (const plantId of plantIds) {
                if (typeof plantId === 'string') {
                    await prisma_1.prisma.userPlantAccess.create({ data: { userId: user.id, plantId } }).catch(() => { });
                }
            }
        }
        if (Array.isArray(departmentIds) && departmentIds.length > 0) {
            for (const departmentId of departmentIds) {
                if (typeof departmentId === 'string') {
                    await prisma_1.prisma.userDepartmentAccess.create({ data: { userId: user.id, departmentId } }).catch(() => { });
                }
            }
        }
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: targetCompanyId,
            entity: 'User',
            recordId: user.id,
            action: 'CREATE',
            newValues: { id: user.id, email: user.email, firstName, lastName, roleIds, plantIds, departmentIds },
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.status(201).json({ success: true, data: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/v1/users/:id/access
router.put('/:id/access', auth_1.requireAuth, (0, auth_1.requirePermission)('user:manage'), async (req, res) => {
    try {
        const userId = req.params.id;
        const { roleIds, plantIds, departmentIds } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (!req.user.isSuperAdmin && req.user.companyId && user.companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant access modification denied.' });
        }
        if (Array.isArray(roleIds)) {
            await prisma_1.prisma.userRole.deleteMany({ where: { userId } });
            for (const roleId of roleIds) {
                if (typeof roleId === 'string') {
                    await prisma_1.prisma.userRole.create({ data: { userId, roleId } }).catch(() => { });
                }
            }
        }
        if (Array.isArray(plantIds)) {
            await prisma_1.prisma.userPlantAccess.deleteMany({ where: { userId } });
            for (const plantId of plantIds) {
                if (typeof plantId === 'string') {
                    await prisma_1.prisma.userPlantAccess.create({ data: { userId, plantId } }).catch(() => { });
                }
            }
        }
        if (Array.isArray(departmentIds)) {
            await prisma_1.prisma.userDepartmentAccess.deleteMany({ where: { userId } });
            for (const departmentId of departmentIds) {
                if (typeof departmentId === 'string') {
                    await prisma_1.prisma.userDepartmentAccess.create({ data: { userId, departmentId } }).catch(() => { });
                }
            }
        }
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: user.companyId || undefined,
            entity: 'UserAccess',
            recordId: userId,
            action: 'PERMISSION_CHANGE',
            newValues: { roleIds, plantIds, departmentIds },
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.json({ success: true, message: 'User authorization boundaries updated successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/users/:id/deactivate
router.post('/:id/deactivate', auth_1.requireAuth, (0, auth_1.requirePermission)('user:update'), async (req, res) => {
    try {
        const userId = req.params.id;
        const { reason, actionType } = req.body;
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'A mandatory reason is required to deactivate/reverse a User.' });
        }
        const targetStatus = actionType === 'REVERSED' ? 'REVERSED' : 'INACTIVE';
        const existing = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (!req.user.isSuperAdmin && req.user.companyId && existing.companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant mutation denied.' });
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { status: targetStatus },
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: existing.companyId || undefined,
            entity: 'User',
            recordId: userId,
            action: targetStatus === 'REVERSED' ? 'REVERSE' : 'DEACTIVATE',
            oldValues: existing,
            newValues: updated,
            reason,
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.json({ success: true, data: updated, message: `User status set to ${targetStatus}` });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Block hard DELETE
router.delete('/:id', auth_1.requireAuth, (req, res) => {
    res.status(405).json({
        success: false,
        error: 'Destructive DELETE is forbidden. Use POST /users/:id/deactivate with a mandatory reason instead.',
    });
});
exports.default = router;
