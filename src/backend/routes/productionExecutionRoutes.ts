import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/production-executions - List Production Executions
router.get('/', requireAuth, requirePermission('productionexecution:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.isSuperAdmin ? (req.query.companyId as string) : req.user!.companyId;
    const plantId = req.query.plantId as string;

    const executions = await prisma.productionExecution.findMany({
      where: {
        ...(companyId && { companyId }),
        ...(plantId && { plantId }),
      },
      include: {
        workOrder: { select: { id: true, woNumber: true, plannedQuantity: true, status: true } },
        finishedMaterial: { select: { id: true, materialCode: true, description: true } },
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
        productionReceipts: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: executions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/production-executions - Record Production Execution (Reconciliation Rule: Executed = Good + Rejected + Hold)
router.post('/', requireAuth, requirePermission('productionexecution:create'), async (req: Request, res: Response) => {
  try {
    const { workOrderId, executedQuantity, goodQuantity, rejectedQuantity, holdQuantity, productionLine, startTime, endTime, remarks } = req.body;

    const targetCompanyId = req.user!.companyId;

    if (!workOrderId || executedQuantity === undefined || goodQuantity === undefined) {
      return res.status(400).json({ success: false, error: 'Work order, executed quantity, and good quantity are required' });
    }

    const execQty = parseFloat(executedQuantity);
    const goodQty = parseFloat(goodQuantity);
    const rejQty = parseFloat(rejectedQuantity || 0);
    const hldQty = parseFloat(holdQuantity || 0);

    if (execQty <= 0 || goodQty < 0 || rejQty < 0 || hldQty < 0) {
      return res.status(400).json({ success: false, error: 'Quantities cannot be negative and executed quantity must be greater than zero' });
    }

    // Mandatory Reconciliation Check: executedQuantity === goodQuantity + rejectedQuantity + holdQuantity
    if (Math.abs(execQty - (goodQty + rejQty + hldQty)) > 0.0001) {
      return res.status(400).json({
        success: false,
        error: `Production quantity reconciliation failure: Executed (${execQty}) must equal Good (${goodQty}) + Rejected (${rejQty}) + Hold (${hldQty})`,
      });
    }

    // Verify Work Order
    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
    if (!wo) {
      return res.status(404).json({ success: false, error: 'Work Order not found' });
    }

    if (!req.user!.isSuperAdmin && wo.companyId !== targetCompanyId) {
      return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
    }

    if (wo.status === 'CANCELLED' || wo.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: `Cannot execute production against Work Order in status ${wo.status}` });
    }

    // Generate Execution Number
    const execCount = await prisma.productionExecution.count();
    const executionNumber = `EXEC-${String(execCount + 1).padStart(5, '0')}`;

    const execution = await prisma.productionExecution.create({
      data: {
        executionNumber,
        workOrderId: wo.id,
        finishedMaterialId: wo.finishedMaterialId,
        plannedQuantity: wo.plannedQuantity,
        executedQuantity: execQty,
        goodQuantity: goodQty,
        rejectedQuantity: rejQty,
        holdQuantity: hldQty,
        operatorId: req.user!.id,
        productionLine: productionLine || wo.productionLine || 'LINE-1',
        startTime: startTime ? new Date(startTime) : new Date(),
        endTime: endTime ? new Date(endTime) : new Date(),
        status: 'COMPLETED',
        remarks,
        companyId: wo.companyId,
        plantId: wo.plantId,
        createdBy: req.user!.id,
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: wo.companyId,
      plantId: wo.plantId,
      departmentId: wo.departmentId,
      entity: 'ProductionExecution',
      recordId: execution.id,
      action: 'CREATE',
      newValues: execution,
    });

    res.status(201).json({ success: true, data: execution });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
