import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AuditService } from '../services/auditService';

export const dispatchRoutes = Router();

// GET /api/v1/sales/dispatches - List dispatch notes for company
dispatchRoutes.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Company context missing' });

    const dispatches = await prisma.dispatchAdvice.findMany({
      where: { companyId },
      include: {
        deliveryPlan: true,
        salesOrder: true,
        material: true,
        uom: true,
        createdUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: dispatches });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/sales/dispatches - Create Dispatch Advice linked to Delivery Plan
dispatchRoutes.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Auth context missing' });

    const { deliveryPlanId, dispatchQuantity } = req.body;

    if (!deliveryPlanId || !dispatchQuantity || Number(dispatchQuantity) <= 0) {
      return res.status(400).json({ error: 'Delivery plan ID and positive dispatch quantity required' });
    }

    const deliveryPlan = await prisma.deliveryPlan.findFirst({
      where: { id: deliveryPlanId, companyId },
      include: { salesOrder: true, material: true },
    });

    if (!deliveryPlan) {
      return res.status(404).json({ error: 'Delivery plan not found' });
    }

    const qtyNum = Number(dispatchQuantity);

    // Quantity Chain Validation: Dispatch Qty <= Planned Qty
    if (qtyNum > deliveryPlan.plannedQuantity) {
      return res.status(400).json({
        error: `Dispatch quantity (${qtyNum}) exceeds planned delivery quantity (${deliveryPlan.plannedQuantity})`,
      });
    }

    // QA-Accepted FG Enforcement
    const stock = await prisma.stockBalance.findFirst({
      where: {
        companyId,
        plantId: deliveryPlan.plantId,
        materialId: deliveryPlan.materialId,
      },
    });

    const availableStock = stock ? stock.quantity : 0;

    if (availableStock < qtyNum) {
      return res.status(400).json({
        error: `Insufficient QA-accepted Finished Goods stock (${availableStock}) for dispatch quantity (${qtyNum})`,
      });
    }

    const dispatchNumber = `DISP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const dispatch = await prisma.$transaction(async (tx) => {
      const disp = await tx.dispatchAdvice.create({
        data: {
          dispatchNumber,
          deliveryPlanId,
          soId: deliveryPlan.soId,
          customerId: deliveryPlan.customerId,
          plantId: deliveryPlan.plantId,
          materialId: deliveryPlan.materialId,
          uomId: deliveryPlan.uomId,
          dispatchQuantity: qtyNum,
          status: 'ISSUED',
          qcStatus: 'ACCEPTED',
          createdById: userId,
          companyId,
        },
      });

      await tx.transactionReference.create({
        data: {
          sourceEntity: 'DeliveryPlan',
          sourceRecordId: deliveryPlan.id,
          targetEntity: 'DispatchAdvice',
          targetRecordId: disp.id,
          referenceType: 'DP_TO_DISPATCH',
          referenceNumber: dispatchNumber,
          companyId,
          plantId: deliveryPlan.plantId,
          createdBy: userId,
        },
      });

      await tx.eventOutbox.create({
        data: {
          eventType: 'DISPATCH_ADVICE_CREATED',
          aggregateType: 'DispatchAdvice',
          aggregateId: disp.id,
          payloadJson: JSON.stringify({ dispatchNumber, quantity: qtyNum }),
        },
      });

      return disp;
    });

    await AuditService.log({
      userId,
      userEmail: req.user?.email,
      companyId,
      plantId: deliveryPlan.plantId,
      entity: 'DispatchAdvice',
      recordId: dispatch.id,
      action: 'ISSUE',
      newValues: dispatch,
    });

    return res.status(201).json({ success: true, data: dispatch });
  } catch (error: any) {
    console.error('DISPATCH POST ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
});
