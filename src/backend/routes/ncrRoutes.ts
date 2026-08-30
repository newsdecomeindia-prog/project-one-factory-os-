import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/ncr - List Non-Conformance Reports
router.get('/', requireAuth, requirePermission('ncr:read'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { plantId, status, disposition } = req.query;

    const companyId = user.isSuperAdmin ? (req.query.companyId as string) : user.companyId;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (plantId) {
      where.plantId = String(plantId);
    }
    if (status) {
      where.status = String(status);
    }
    if (disposition) {
      where.disposition = String(disposition);
    }

    const ncrs = await prisma.nonConformanceReport.findMany({
      where,
      include: {
        ipqc: { select: { id: true, inspectionNumber: true } },
        workOrder: { select: { id: true, woNumber: true } },
        material: { select: { id: true, materialCode: true, description: true } },
        uom: { select: { id: true, uomCode: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: ncrs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/ncr - Create Manual NCR
router.post('/', requireAuth, requirePermission('ncr:create'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { ipqcId, workOrderId, materialId, defectType, defectQuantity, plantId } = req.body;

    if (!materialId || !defectType || defectQuantity === undefined || !plantId) {
      return res.status(400).json({ success: false, error: 'Missing required fields: materialId, defectType, defectQuantity, plantId' });
    }

    const qty = Number(defectQuantity);
    if (qty <= 0) {
      return res.status(400).json({ success: false, error: 'Defect quantity must be positive' });
    }

    const plant = await prisma.plant.findUnique({ where: { id: String(plantId) } });
    if (!plant) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }

    if (!user.isSuperAdmin && plant.companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot create NCR for another company' });
    }

    const mat = await prisma.material.findUnique({ where: { id: String(materialId) } });
    if (!mat) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const ncrNumber = `NCR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const ncr = await prisma.$transaction(async (tx) => {
      const created = await tx.nonConformanceReport.create({
        data: {
          ncrNumber,
          sourceType: ipqcId ? 'IPQC' : 'MANUAL',
          sourceRecordId: ipqcId || null,
          ipqcId: ipqcId || null,
          workOrderId: workOrderId || null,
          materialId: String(materialId),
          uomId: mat.uomId,
          defectType: String(defectType),
          defectQuantity: qty,
          disposition: 'PENDING',
          assignedToId: user.id,
          companyId: plant.companyId,
          plantId: plant.id,
          status: 'OPEN',
          createdBy: user.id,
        },
      });

      await tx.transactionReference.create({
        data: {
          sourceEntity: 'NonConformanceReport',
          sourceRecordId: created.id,
          targetEntity: 'Material',
          targetRecordId: String(materialId),
          referenceType: 'NCR_CREATED',
          referenceNumber: ncrNumber,
          companyId: plant.companyId,
          plantId: plant.id,
          createdBy: user.id,
        },
      });

      return created;
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: plant.companyId,
      plantId: plant.id,
      entity: 'NonConformanceReport',
      recordId: ncr.id,
      action: 'CREATE',
      newValues: ncr,
      reason: `NCR Raised for Defect Type: ${defectType}`,
    });

    res.status(201).json({ success: true, data: ncr });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/ncr/:id/disposition - Execute NCR Disposition
router.post('/:id/disposition', requireAuth, requirePermission('ncr:disposition'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { disposition, reason, warehouseId, binId } = req.body;

    const validDispositions = ['SCRAP', 'REWORK', 'ACCEPT_WITH_VARIANCE'];
    if (!disposition || !validDispositions.includes(disposition)) {
      return res.status(400).json({ success: false, error: `Invalid disposition. Allowed: ${validDispositions.join(', ')}` });
    }

    const reasonStr = Array.isArray(reason) ? reason[0] : reason;
    if (!reasonStr || typeof reasonStr !== 'string' || reasonStr.trim() === '') {
      return res.status(400).json({ success: false, error: 'Mandatory reason is required for disposition action' });
    }

    const existing = await prisma.nonConformanceReport.findUnique({ where: { id: idParam } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'NCR not found' });
    }

    if (!user.isSuperAdmin && existing.companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot update NCR for another company' });
    }

    // PREVENT DUPLICATE NCR DISPOSITION
    if (existing.status === 'CLOSED') {
      return res.status(400).json({ success: false, error: 'NCR disposition has already been executed for this record' });
    }

    // MAKER-CHECKER SEGREGATION: Creator cannot execute disposition unless user is Super Admin
    if (!user.isSuperAdmin && existing.createdBy === user.id) {
      return res.status(403).json({ success: false, error: 'Segregation of Duty Violation: Creator cannot execute disposition on their own NCR' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      let reworkWoNumber = null;

      // Handle DISPOSITION DISPATCH
      if (disposition === 'SCRAP') {
        // SCRAP: Deduct/Write-off stock if warehouseId provided
        if (warehouseId) {
          const balance = await tx.stockBalance.findFirst({
            where: {
              plantId: existing.plantId,
              warehouseId: String(warehouseId),
              materialId: existing.materialId,
            },
          });

          if (balance && balance.quantity >= existing.defectQuantity) {
            await tx.stockBalance.update({
              where: { id: balance.id },
              data: { quantity: balance.quantity - existing.defectQuantity },
            });

            const mat = await tx.material.findUnique({ where: { id: existing.materialId } });
            await tx.stockTransaction.create({
              data: {
                transactionNumber: `STX-SCRAP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                materialId: existing.materialId,
                quantity: -existing.defectQuantity,
                uomId: existing.uomId || mat?.uomId || balance.id,
                warehouseId: String(warehouseId),
                binId: binId ? String(binId) : null,
                transactionType: 'SCRAP_WRITE_OFF',
                userId: user.id,
                companyId: existing.companyId,
                plantId: existing.plantId,
                referenceNumber: existing.ncrNumber,
              },
            });
          }
        }
      } else if (disposition === 'REWORK') {
        // REWORK: Controlled Rework Order Reference generation (Does NOT add to available FG stock)
        reworkWoNumber = `WO-RWK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      } else if (disposition === 'ACCEPT_WITH_VARIANCE') {
        // ACCEPT WITH VARIANCE: Explicit quality concession recorded without silent stock inflation
      }

      const ncrUpdated = await tx.nonConformanceReport.update({
        where: { id: idParam },
        data: {
          disposition,
          dispositionReason: reasonStr.trim(),
          reworkWoNumber,
          approvedById: user.id,
          approvedAt: new Date(),
          status: 'CLOSED',
        },
      });

      // Create Transaction Reference for Disposition
      await tx.transactionReference.create({
        data: {
          sourceEntity: 'NonConformanceReport',
          sourceRecordId: existing.id,
          targetEntity: 'Material',
          targetRecordId: existing.materialId,
          referenceType: 'NCR_DISPOSITIONED',
          referenceNumber: existing.ncrNumber,
          companyId: existing.companyId,
          plantId: existing.plantId,
          createdBy: user.id,
        },
      });

      // Emit Outbox Event for Disposition
      await tx.eventOutbox.create({
        data: {
          eventType: 'NCR_DISPOSITIONED',
          aggregateType: 'NonConformanceReport',
          aggregateId: existing.id,
          payloadJson: JSON.stringify({
            ncrNumber: existing.ncrNumber,
            disposition,
            reason: reasonStr.trim(),
            companyId: existing.companyId,
            plantId: existing.plantId,
          }),
          status: 'PENDING',
        },
      });

      return ncrUpdated;
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: existing.companyId,
      plantId: existing.plantId,
      entity: 'NonConformanceReport',
      recordId: existing.id,
      action: 'UPDATE',
      oldValues: existing,
      newValues: updated,
      reason: reasonStr.trim(),
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
