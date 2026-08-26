"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/foundation/history/:entity/:recordId (Record History Timeline API)
router.get('/history/:entity/:recordId', auth_1.requireAuth, async (req, res) => {
    try {
        const entity = req.params.entity;
        const recordId = req.params.recordId;
        const history = await prisma_1.prisma.auditLog.findMany({
            where: {
                entity,
                recordId,
                ...(!req.user.isSuperAdmin && req.user.companyId && { companyId: req.user.companyId }),
            },
            orderBy: { timestamp: 'desc' },
            include: {
                user: { select: { firstName: true, lastName: true, email: true } },
            },
        });
        res.json({ success: true, data: history });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Transaction Reference API Foundation
router.get('/transactions/references', auth_1.requireAuth, async (req, res) => {
    const references = await prisma_1.prisma.transactionReference.findMany({
        where: {
            ...(!req.user.isSuperAdmin && req.user.companyId && { companyId: req.user.companyId }),
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: references });
});
router.post('/transactions/references', auth_1.requireAuth, async (req, res) => {
    const { sourceEntity, sourceRecordId, targetEntity, targetRecordId, referenceType, referenceNumber, companyId, plantId, departmentId } = req.body;
    const targetCompanyId = req.user.isSuperAdmin ? companyId : req.user.companyId;
    const ref = await prisma_1.prisma.transactionReference.create({
        data: {
            sourceEntity,
            sourceRecordId,
            targetEntity,
            targetRecordId,
            referenceType,
            referenceNumber,
            companyId: targetCompanyId,
            plantId,
            departmentId,
            createdBy: req.user.id,
        },
    });
    await auditService_1.AuditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        companyId: targetCompanyId,
        entity: 'TransactionReference',
        recordId: ref.id,
        action: 'CREATE',
        newValues: ref,
    });
    res.status(201).json({ success: true, data: ref });
});
// Universal Search API Foundation (Tenant Filtered)
router.get('/search', auth_1.requireAuth, async (req, res) => {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
        return res.json({ success: true, data: [] });
    }
    const q = query.trim();
    const tenantCompanyFilter = (!req.user.isSuperAdmin && req.user.companyId) ? { id: req.user.companyId } : {};
    const plantCompanyFilter = (!req.user.isSuperAdmin && req.user.companyId) ? { companyId: req.user.companyId } : {};
    const [companies, plants, departments, users] = await Promise.all([
        prisma_1.prisma.company.findMany({ where: { ...tenantCompanyFilter, OR: [{ companyCode: { contains: q } }, { displayName: { contains: q } }] }, take: 5 }),
        prisma_1.prisma.plant.findMany({ where: { ...plantCompanyFilter, OR: [{ plantCode: { contains: q } }, { plantName: { contains: q } }] }, take: 5 }),
        prisma_1.prisma.department.findMany({ where: { plant: plantCompanyFilter, OR: [{ departmentCode: { contains: q } }, { departmentName: { contains: q } }] }, take: 5 }),
        prisma_1.prisma.user.findMany({ where: { ...plantCompanyFilter, OR: [{ email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }] }, select: { id: true, email: true, firstName: true, lastName: true }, take: 5 }),
    ]);
    res.json({
        success: true,
        data: {
            companies,
            plants,
            departments,
            users,
        },
    });
});
exports.default = router;
