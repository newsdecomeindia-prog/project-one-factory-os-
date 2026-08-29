"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/roles
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('role:read'), async (req, res) => {
    try {
        const roles = await prisma_1.prisma.role.findMany({
            include: {
                rolePermissions: {
                    include: { permission: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const formatted = roles.map((r) => ({
            id: r.id,
            roleName: r.roleName,
            description: r.description,
            status: r.status,
            permissions: r.rolePermissions.map((rp) => ({
                id: rp.permission.id,
                code: rp.permission.permissionCode,
                module: rp.permission.module,
                action: rp.permission.action,
            })),
        }));
        res.json({ success: true, data: formatted });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/permissions
router.get('/permissions', auth_1.requireAuth, (0, auth_1.requirePermission)('role:read'), async (req, res) => {
    try {
        const permissions = await prisma_1.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { action: 'asc' }],
        });
        res.json({ success: true, data: permissions });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/roles
router.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('role:manage'), async (req, res) => {
    try {
        const { roleName, description, permissionIds } = req.body;
        if (!roleName) {
            return res.status(400).json({ success: false, error: 'roleName is required' });
        }
        const existing = await prisma_1.prisma.role.findUnique({ where: { roleName } });
        if (existing) {
            return res.status(400).json({ success: false, error: `Role name '${roleName}' already exists.` });
        }
        const role = await prisma_1.prisma.role.create({
            data: { roleName, description },
        });
        if (Array.isArray(permissionIds) && permissionIds.length > 0) {
            for (const permissionId of permissionIds) {
                if (typeof permissionId === 'string') {
                    await prisma_1.prisma.rolePermission.create({
                        data: { roleId: role.id, permissionId },
                    }).catch(() => { });
                }
            }
        }
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: req.user.companyId || undefined,
            entity: 'Role',
            recordId: role.id,
            action: 'CREATE',
            newValues: { roleName, description, permissionIds },
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.status(201).json({ success: true, data: role });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/v1/roles/:id/permissions
router.put('/:id/permissions', auth_1.requireAuth, (0, auth_1.requirePermission)('role:manage'), async (req, res) => {
    try {
        const roleId = req.params.id;
        const { permissionIds } = req.body;
        const role = await prisma_1.prisma.role.findUnique({ where: { id: roleId } });
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }
        if (!Array.isArray(permissionIds)) {
            return res.status(400).json({ success: false, error: 'permissionIds must be an array' });
        }
        await prisma_1.prisma.rolePermission.deleteMany({ where: { roleId } });
        for (const permissionId of permissionIds) {
            if (typeof permissionId === 'string') {
                await prisma_1.prisma.rolePermission.create({
                    data: { roleId, permissionId },
                }).catch(() => { });
            }
        }
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: req.user.companyId || undefined,
            entity: 'RolePermission',
            recordId: roleId,
            action: 'PERMISSION_CHANGE',
            newValues: { roleId, permissionIds },
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.json({ success: true, message: `Permissions updated for role '${role.roleName}'` });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
