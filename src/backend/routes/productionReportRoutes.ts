import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

// GET /api/v1/production-reports/dashboard - Real-Time Production & Stock Dashboard Analytics
router.get('/dashboard', requireAuth, requirePermission('stock:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.isSuperAdmin ? (req.query.companyId as string) : req.user!.companyId;
    const plantId = req.query.plantId as string;

    const tenantFilter = {
      ...(companyId && { companyId }),
      ...(plantId && { plantId }),
    };

    const [workOrderStats, stockBalances, totalIssued, totalExecuted, totalReceipts] = await Promise.all([
      prisma.workOrder.groupBy({
        by: ['status'],
        where: tenantFilter,
        _count: { _all: true },
      }),
      prisma.stockBalance.findMany({
        where: tenantFilter,
        include: {
          material: { select: { materialCode: true, description: true, materialType: true } },
          warehouse: { select: { warehouseCode: true, name: true } },
          bin: { select: { binCode: true } },
        },
      }),
      prisma.materialIssue.aggregate({
        where: tenantFilter,
        _sum: { issuedQuantity: true },
        _count: { _all: true },
      }),
      prisma.productionExecution.aggregate({
        where: tenantFilter,
        _sum: { executedQuantity: true, goodQuantity: true, rejectedQuantity: true, holdQuantity: true },
        _count: { _all: true },
      }),
      prisma.productionReceipt.aggregate({
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/production-reports/stock-ledger - Full Production Stock Transaction Ledger
router.get('/stock-ledger', requireAuth, requirePermission('stock:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.isSuperAdmin ? (req.query.companyId as string) : req.user!.companyId;
    const plantId = req.query.plantId as string;

    const ledger = await prisma.stockTransaction.findMany({
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/production-reports/ipqc - IPQC Quality Report Analytics
router.get('/ipqc', requireAuth, requirePermission('ipqc:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.isSuperAdmin ? (req.query.companyId as string) : req.user!.companyId;
    const plantId = req.query.plantId as string;

    const tenantFilter = {
      ...(companyId && { companyId }),
      ...(plantId && { plantId }),
    };

    const [stats, records] = await Promise.all([
      prisma.inProcessQaInspection.aggregate({
        where: tenantFilter,
        _sum: { inspectedQuantity: true, passedQuantity: true, failedQuantity: true },
        _count: { _all: true },
      }),
      prisma.inProcessQaInspection.findMany({
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/production-reports/ncr - Non-Conformance & CAPA Summary Report
router.get('/ncr', requireAuth, requirePermission('ncr:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.isSuperAdmin ? (req.query.companyId as string) : req.user!.companyId;
    const plantId = req.query.plantId as string;

    const tenantFilter = {
      ...(companyId && { companyId }),
      ...(plantId && { plantId }),
    };

    const [statusStats, dispositionStats, records] = await Promise.all([
      prisma.nonConformanceReport.groupBy({
        by: ['status'],
        where: tenantFilter,
        _count: { _all: true },
      }),
      prisma.nonConformanceReport.groupBy({
        by: ['disposition'],
        where: tenantFilter,
        _count: { _all: true },
        _sum: { defectQuantity: true },
      }),
      prisma.nonConformanceReport.findMany({
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/production-reports/transfers - Stock Transfers Operational Summary Report
router.get('/transfers', requireAuth, requirePermission('stocktransfer:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.isSuperAdmin ? (req.query.companyId as string) : req.user!.companyId;
    const plantId = req.query.plantId as string;

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
      prisma.inventoryTransferOrder.groupBy({
        by: ['status'],
        where: tenantFilter,
        _count: { _all: true },
        _sum: { transferQuantity: true },
      }),
      prisma.inventoryTransferOrder.findMany({
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
