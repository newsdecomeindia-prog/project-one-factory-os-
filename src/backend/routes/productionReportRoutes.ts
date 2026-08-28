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

export default router;
