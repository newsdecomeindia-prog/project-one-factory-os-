"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/departments (Tenant & Plant Isolated)
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('department:read'), async (req, res) => {
    try {
        let departments;
        if (req.user.isSuperAdmin) {
            departments = await prisma_1.prisma.department.findMany({
                include: { plant: { include: { company: true } } },
                orderBy: { createdAt: 'desc' },
            });
        }
        else {
            departments = await prisma_1.prisma.department.findMany({
                where: {
                    plant: {
                        ...(req.user.companyId && { companyId: req.user.companyId }),
                        id: { in: req.user.plantIds },
                    },
                },
                include: { plant: { include: { company: true } } },
                orderBy: { createdAt: 'desc' },
            });
        }
        res.json({ success: true, data: departments });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/departments/:id
router.get('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('department:read'), (0, auth_1.enforceDepartmentAccess)('params', 'id'), async (req, res) => {
    try {
        const departmentId = req.params.id;
        const department = await prisma_1.prisma.department.findUnique({
            where: { id: departmentId },
            include: { plant: { include: { company: true } } },
        });
        if (!department) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }
        if (!req.user.isSuperAdmin && req.user.companyId && department.plant.companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant department access denied.' });
        }
        res.json({ success: true, data: department });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/departments
router.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('department:create'), async (req, res) => {
    try {
        const { departmentCode, plantId, departmentName } = req.body;
        if (!departmentCode || !plantId || !departmentName) {
            return res.status(400).json({ success: false, error: 'departmentCode, plantId, and departmentName are required' });
        }
        const plantExists = await prisma_1.prisma.plant.findUnique({ where: { id: plantId } });
        if (!plantExists) {
            return res.status(400).json({ success: false, error: `Plant ID '${plantId}' does not exist.` });
        }
        if (!req.user.isSuperAdmin) {
            if (req.user.companyId && plantExists.companyId !== req.user.companyId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant plant department creation denied.' });
            }
            if (!req.user.plantIds.includes(plantId)) {
                return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to add departments to this plant' });
            }
        }
        const existingCode = await prisma_1.prisma.department.findUnique({ where: { departmentCode } });
        if (existingCode) {
            return res.status(400).json({ success: false, error: `Department code '${departmentCode}' already exists.` });
        }
        const department = await prisma_1.prisma.department.create({
            data: {
                departmentCode,
                plantId,
                departmentName,
            },
        });
        await prisma_1.prisma.userDepartmentAccess.create({
            data: { userId: req.user.id, departmentId: department.id },
        }).catch(() => { });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: plantExists.companyId,
            plantId: plantId,
            departmentId: department.id,
            entity: 'Department',
            recordId: department.id,
            action: 'CREATE',
            newValues: department,
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.status(201).json({ success: true, data: department });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/departments/:id/deactivate (With Reversal Authorization Check)
router.post('/:id/deactivate', auth_1.requireAuth, (0, auth_1.enforceDepartmentAccess)('params', 'id'), async (req, res) => {
    try {
        const departmentId = req.params.id;
        const { reason, actionType } = req.body;
        const isReversal = actionType === 'REVERSED';
        const requiredPermission = isReversal ? 'department:reverse' : 'department:deactivate';
        if (!req.user.isSuperAdmin && !req.user.permissions.includes(requiredPermission)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Authorized approval requires permission: '${requiredPermission}'`,
            });
        }
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'A mandatory reason is required to deactivate/reverse a Department.' });
        }
        const targetStatus = isReversal ? 'REVERSED' : 'INACTIVE';
        const existing = await prisma_1.prisma.department.findUnique({
            where: { id: departmentId },
            include: { plant: true },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Department not found' });
        }
        if (!req.user.isSuperAdmin && req.user.companyId && existing.plant.companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant department mutation denied.' });
        }
        const updated = await prisma_1.prisma.department.update({
            where: { id: departmentId },
            data: { status: targetStatus },
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: existing.plant.companyId,
            plantId: existing.plantId,
            departmentId: updated.id,
            entity: 'Department',
            recordId: updated.id,
            action: isReversal ? 'REVERSE' : 'DEACTIVATE',
            oldValues: existing,
            newValues: updated,
            reason,
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.json({ success: true, data: updated, message: `Department state set to ${targetStatus}` });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Block hard DELETE
router.delete('/:id', auth_1.requireAuth, (req, res) => {
    res.status(405).json({
        success: false,
        error: 'Destructive DELETE is forbidden. Use POST /departments/:id/deactivate with a mandatory reason instead.',
    });
});
exports.default = router;
