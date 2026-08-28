"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/v1/production-reports/dashboard - Real-Time Production & Stock Dashboard Analytics
router.get('/dashboard', auth_1.requireAuth, (0, auth_1.requirePermission)('stock:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const tenantFilter = {
            ...(companyId && { companyId }),
            ...(plantId && { plantId }),
        };
        const [workOrderStats, stockBalances, totalIssued, totalExecuted, totalReceipts] = await Promise.all([
            prisma_1.prisma.workOrder.groupBy({
                by: ['status'],
                where: tenantFilter,
                _count: { _all: true },
            }),
            prisma_1.prisma.stockBalance.findMany({
                where: tenantFilter,
                include: {
                    material: { select: { materialCode: true, description: true, materialType: true } },
                    warehouse: { select: { warehouseCode: true, name: true } },
                    bin: { select: { binCode: true } },
                },
            }),
            prisma_1.prisma.materialIssue.aggregate({
                where: tenantFilter,
                _sum: { issuedQuantity: true },
                _count: { _all: true },
            }),
            prisma_1.prisma.productionExecution.aggregate({
                where: tenantFilter,
                _sum: { executedQuantity: true, goodQuantity: true, rejectedQuantity: true, holdQuantity: true },
                _count: { _all: true },
            }),
            prisma_1.prisma.productionReceipt.aggregate({
                where: tenantFilter,
                _sum: { receivedQuantity: true, rejectedQuantity: true },
                _count: { _all: true },
            }),
        ]);
        res.json({
            success: true,
            data: {
                workOrderStats,
                stockBalances,
                totalIssued: {
                    quantity: totalIssued._sum.issuedQuantity || 0,
                    count: totalIssued._count._all,
                },
                totalExecuted: {
                    executed: totalExecuted._sum.executedQuantity || 0,
                    good: totalExecuted._sum.goodQuantity || 0,
                    rejected: totalExecuted._sum.rejectedQuantity || 0,
                    hold: totalExecuted._sum.holdQuantity || 0,
                    count: totalExecuted._count._all,
                },
                totalReceipts: {
                    receivedFG: totalReceipts._sum.receivedQuantity || 0,
                    count: totalReceipts._count._all,
                },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/production-reports/stock-ledger - Full Production Stock Transaction Ledger
router.get('/stock-ledger', auth_1.requireAuth, (0, auth_1.requirePermission)('stock:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const ledger = await prisma_1.prisma.stockTransaction.findMany({
            where: {
                ...(companyId && { companyId }),
                ...(plantId && { plantId }),
            },
            include: {
                material: { select: { materialCode: true, description: true, materialType: true } },
                uom: { select: { uomCode: true } },
                warehouse: { select: { warehouseCode: true, name: true } },
                bin: { select: { binCode: true } },
                user: { select: { firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json({ success: true, data: ledger });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
