"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/companies
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('company:read'), async (req, res) => {
    try {
        const companies = await prisma_1.prisma.company.findMany({
            where: {
                ...(!req.user.isSuperAdmin && req.user.companyId && { id: req.user.companyId }),
            },
            orderBy: { createdAt: 'desc' },
            include: { plants: true },
        });
        res.json({ success: true, data: companies });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/companies/:id
router.get('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('company:read'), async (req, res) => {
    try {
        const companyId = req.params.id;
        if (!req.user.isSuperAdmin && req.user.companyId && companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant company access denied.' });
        }
        const company = await prisma_1.prisma.company.findUnique({
            where: { id: companyId },
            include: { plants: true },
        });
        if (!company) {
            return res.status(404).json({ success: false, error: 'Company not found' });
        }
        res.json({ success: true, data: company });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/companies
router.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('company:create'), async (req, res) => {
    try {
        const { companyCode, legalName, displayName, legalDetails } = req.body;
        if (!companyCode || !legalName || !displayName) {
            return res.status(400).json({ success: false, error: 'companyCode, legalName, and displayName are required' });
        }
        const existingCode = await prisma_1.prisma.company.findUnique({ where: { companyCode } });
        if (existingCode) {
            return res.status(400).json({ success: false, error: `Company code '${companyCode}' already exists.` });
        }
        const company = await prisma_1.prisma.company.create({
            data: {
                companyCode,
                legalName,
                displayName,
                legalDetails,
                createdBy: req.user.id,
            },
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: company.id,
            entity: 'Company',
            recordId: company.id,
            action: 'CREATE',
            newValues: company,
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.status(201).json({ success: true, data: company });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/v1/companies/:id
router.put('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('company:update'), async (req, res) => {
    try {
        const { legalName, displayName, legalDetails } = req.body;
        const companyId = req.params.id;
        if (!req.user.isSuperAdmin && req.user.companyId && companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant company mutation denied.' });
        }
        const existing = await prisma_1.prisma.company.findUnique({ where: { id: companyId } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Company not found' });
        }
        const updated = await prisma_1.prisma.company.update({
            where: { id: companyId },
            data: {
                legalName: legalName !== undefined ? legalName : existing.legalName,
                displayName: displayName !== undefined ? displayName : existing.displayName,
                legalDetails: legalDetails !== undefined ? legalDetails : existing.legalDetails,
                updatedBy: req.user.id,
            },
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: updated.id,
            entity: 'Company',
            recordId: updated.id,
            action: 'UPDATE',
            oldValues: existing,
            newValues: updated,
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/companies/:id/deactivate (With Reversal Authorization Check)
router.post('/:id/deactivate', auth_1.requireAuth, async (req, res) => {
    try {
        const companyId = req.params.id;
        const { reason, actionType } = req.body;
        const isReversal = actionType === 'REVERSED';
        const requiredPermission = isReversal ? 'company:reverse' : 'company:deactivate';
        if (!req.user.isSuperAdmin && !req.user.permissions.includes(requiredPermission)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Authorized approval requires permission: '${requiredPermission}'`,
            });
        }
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'A mandatory reason is required to deactivate/reverse a Company.' });
        }
        const targetStatus = isReversal ? 'REVERSED' : 'INACTIVE';
        if (!req.user.isSuperAdmin && req.user.companyId && companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant company mutation denied.' });
        }
        const existing = await prisma_1.prisma.company.findUnique({ where: { id: companyId } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Company not found' });
        }
        const updated = await prisma_1.prisma.company.update({
            where: { id: companyId },
            data: {
                status: targetStatus,
                updatedBy: req.user.id,
            },
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: updated.id,
            entity: 'Company',
            recordId: updated.id,
            action: isReversal ? 'REVERSE' : 'DEACTIVATE',
            oldValues: existing,
            newValues: updated,
            reason,
            ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
            correlationId: req.correlationId,
        });
        res.json({ success: true, data: updated, message: `Company state set to ${targetStatus}` });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Block hard DELETE
router.delete('/:id', auth_1.requireAuth, (req, res) => {
    res.status(405).json({
        success: false,
        error: 'Destructive DELETE is forbidden. Use POST /companies/:id/deactivate with a mandatory reason instead.',
    });
});
exports.default = router;
