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
// GET /api/v1/production-reports/ipqc - IPQC Quality Report Analytics
router.get('/ipqc', auth_1.requireAuth, (0, auth_1.requirePermission)('ipqc:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const tenantFilter = {
            ...(companyId && { companyId }),
            ...(plantId && { plantId }),
        };
        const [stats, records] = await Promise.all([
            prisma_1.prisma.inProcessQaInspection.aggregate({
                where: tenantFilter,
                _sum: { inspectedQuantity: true, passedQuantity: true, failedQuantity: true },
                _count: { _all: true },
            }),
            prisma_1.prisma.inProcessQaInspection.findMany({
                where: tenantFilter,
                include: {
                    material: { select: { materialCode: true, description: true } },
                    uom: { select: { uomCode: true } },
                    workOrder: { select: { woNumber: true } },
                    inspector: { select: { firstName: true, lastName: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        res.json({
            success: true,
            data: {
                summary: {
                    totalInspected: stats._sum.inspectedQuantity || 0,
                    totalPassed: stats._sum.passedQuantity || 0,
                    totalFailed: stats._sum.failedQuantity || 0,
                    passRate: stats._sum.inspectedQuantity ? ((stats._sum.passedQuantity || 0) / stats._sum.inspectedQuantity) * 100 : 100,
                    inspectionCount: stats._count._all,
                },
                records,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/production-reports/ncr - Non-Conformance & CAPA Summary Report
router.get('/ncr', auth_1.requireAuth, (0, auth_1.requirePermission)('ncr:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const tenantFilter = {
            ...(companyId && { companyId }),
            ...(plantId && { plantId }),
        };
        const [statusStats, dispositionStats, records] = await Promise.all([
            prisma_1.prisma.nonConformanceReport.groupBy({
                by: ['status'],
                where: tenantFilter,
                _count: { _all: true },
            }),
            prisma_1.prisma.nonConformanceReport.groupBy({
                by: ['disposition'],
                where: tenantFilter,
                _count: { _all: true },
                _sum: { defectQuantity: true },
            }),
            prisma_1.prisma.nonConformanceReport.findMany({
                where: tenantFilter,
                include: {
                    material: { select: { materialCode: true, description: true } },
                    assignedTo: { select: { firstName: true, lastName: true, email: true } },
                    approver: { select: { firstName: true, lastName: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        res.json({
            success: true,
            data: {
                statusStats,
                dispositionStats,
                records,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/production-reports/transfers - Stock Transfers Operational Summary Report
router.get('/transfers', auth_1.requireAuth, (0, auth_1.requirePermission)('stocktransfer:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const tenantFilter = {
            ...(companyId && { companyId }),
            ...(plantId && {
                OR: [
                    { sourcePlantId: String(plantId) },
                    { targetPlantId: String(plantId) },
                ],
            }),
        };
        const [statusStats, records] = await Promise.all([
            prisma_1.prisma.inventoryTransferOrder.groupBy({
                by: ['status'],
                where: tenantFilter,
                _count: { _all: true },
                _sum: { transferQuantity: true },
            }),
            prisma_1.prisma.inventoryTransferOrder.findMany({
                where: tenantFilter,
                include: {
                    sourceWarehouse: { select: { warehouseCode: true, name: true } },
                    targetWarehouse: { select: { warehouseCode: true, name: true } },
                    material: { select: { materialCode: true, description: true } },
                    uom: { select: { uomCode: true } },
                    requestedBy: { select: { firstName: true, lastName: true, email: true } },
                    issuedBy: { select: { firstName: true, lastName: true, email: true } },
                    receivedBy: { select: { firstName: true, lastName: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        res.json({
            success: true,
            data: {
                statusStats,
                records,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
