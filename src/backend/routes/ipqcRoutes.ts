import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/ipqc - List In-Process QA Inspections
router.get('/', requireAuth, requirePermission('ipqc:read'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { plantId, workOrderId, status } = req.query;

    const companyId = user.isSuperAdmin ? (req.query.companyId as string) : user.companyId;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (plantId) {
      where.plantId = String(plantId);
    }
    if (workOrderId) {
      where.workOrderId = String(workOrderId);
    }
    if (status) {
      where.status = String(status);
    }

    const inspections = await prisma.inProcessQaInspection.findMany({
      where,
      include: {
        workOrder: { select: { id: true, woNumber: true } },
        execution: { select: { id: true, executionNumber: true } },
        material: { select: { id: true, materialCode: true, description: true } },
        uom: { select: { id: true, uomCode: true, name: true } },
        department: { select: { id: true, departmentCode: true, departmentName: true } },
        inspector: { select: { id: true, firstName: true, lastName: true, email: true } },
        nonConformanceReports: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: inspections });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/ipqc - Record New In-Process Quality Inspection
router.post('/', requireAuth, requirePermission('ipqc:create'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { workOrderId, executionId, materialId, uomId, inspectedQuantity, passedQuantity, failedQuantity, remarks } = req.body;

    if (!materialId || inspectedQuantity === undefined || passedQuantity === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields: materialId, inspectedQuantity, passedQuantity' });
    }

    const inspected = Number(inspectedQuantity);
    const passed = Number(passedQuantity);
    const failed = Number(failedQuantity || 0);

    if (inspected <= 0 || passed < 0 || failed < 0) {
      return res.status(400).json({ success: false, error: 'Inspected quantity must be positive, passed and failed quantities non-negative' });
    }

    // MANDATORY QUANTITY RULE: INSPECTED QTY = PASSED QTY + FAILED QTY
    if (inspected !== passed + failed) {
      return res.status(400).json({ success: false, error: `Quantity reconciliation failure: Inspected (${inspected}) must equal Passed (${passed}) + Failed (${failed})` });
    }

    let companyId = user.companyId;
    let plantId = user.plantIds[0];
    let departmentId: string | undefined = undefined;

    let woRecord = null;
    if (workOrderId) {
      woRecord = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
      if (!woRecord) {
        return res.status(404).json({ success: false, error: 'Work Order not found' });
      }
      companyId = woRecord.companyId;
      plantId = woRecord.plantId;
      departmentId = woRecord.departmentId;
    }

    if (!user.isSuperAdmin && companyId && companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot record IPQC for another company' });
    }

    const matRecord = await prisma.material.findUnique({ where: { id: materialId } });
    if (!matRecord) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const targetUomId = uomId || matRecord.uomId;
    const inspectionNumber = `IPQC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const ipqcStatus = failed > 0 ? (passed > 0 ? 'PARTIAL_FAIL' : 'FAILED') : 'PASSED';

    const result = await prisma.$transaction(async (tx) => {
      const inspection = await tx.inProcessQaInspection.create({
        data: {
          inspectionNumber,
          workOrderId: workOrderId || null,
          executionId: executionId || null,
          materialId,
          uomId: targetUomId,
          inspectedQuantity: inspected,
          passedQuantity: passed,
          failedQuantity: failed,
          inspectorId: user.id,
          remarks: remarks || null,
          companyId: companyId!,
          plantId: plantId!,
          departmentId,
          status: ipqcStatus,
          createdBy: user.id,
        },
      });

      // Create Transaction Reference
      await tx.transactionReference.create({
        data: {
          sourceEntity: 'InProcessQaInspection',
          sourceRecordId: inspection.id,
          targetEntity: 'WorkOrder',
          targetRecordId: workOrderId || inspection.id,
          referenceType: 'IPQC_CREATED',
          referenceNumber: inspectionNumber,
          companyId: companyId!,
          plantId: plantId!,
          createdBy: user.id,
        },
      });

      // Automatically generate Non-Conformance Report (NCR) if failed quantity > 0
      let ncrRecord = null;
      if (failed > 0) {
        // Prevent duplicate NCR creation for the same inspection event
        const existingNcr = await tx.nonConformanceReport.findFirst({
          where: { ipqcId: inspection.id },
        });

        if (!existingNcr) {
          const ncrNumber = `NCR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
          ncrRecord = await tx.nonConformanceReport.create({
            data: {
              ncrNumber,
              sourceType: 'IPQC',
              sourceRecordId: inspection.id,
              ipqcId: inspection.id,
              workOrderId: workOrderId || null,
              materialId,
              uomId: targetUomId,
              defectType: 'IPQC_INSPECTION_DEFECT',
              defectQuantity: failed,
              disposition: 'PENDING',
              assignedToId: user.id,
              companyId: companyId!,
              plantId: plantId!,
              departmentId,
              status: 'OPEN',
              createdBy: user.id,
            },
          });

          // Create NCR Transaction Reference
          await tx.transactionReference.create({
            data: {
              sourceEntity: 'InProcessQaInspection',
              sourceRecordId: inspection.id,
              targetEntity: 'NonConformanceReport',
              targetRecordId: ncrRecord.id,
              referenceType: 'NCR_CREATED',
              referenceNumber: ncrNumber,
              companyId: companyId!,
              plantId: plantId!,
              createdBy: user.id,
            },
          });

          // Emit Outbox Event for Quality Defect Alert
          await tx.eventOutbox.create({
            data: {
              eventType: 'NCR_CREATED',
              aggregateType: 'NonConformanceReport',
              aggregateId: ncrRecord.id,
              payloadJson: JSON.stringify({
                ncrNumber,
                ipqcNumber: inspectionNumber,
                materialId,
                failedQuantity: failed,
                companyId,
                plantId,
              }),
              status: 'PENDING',
            },
          });

          // Send In-App Notification to Inspector/Quality Manager
          await tx.notification.create({
            data: {
              userId: user.id,
              title: `NCR Raised: ${ncrNumber}`,
              message: `Defect recorded during IPQC inspection ${inspectionNumber}. Failed quantity: ${failed}`,
              entity: 'NonConformanceReport',
              recordId: ncrRecord.id,
            },
          });
        }
      }

      return { inspection, ncrRecord };
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: companyId || undefined,
      plantId: plantId || undefined,
      departmentId: departmentId || undefined,
      entity: 'InProcessQaInspection',
      recordId: result.inspection.id,
      action: 'CREATE',
      newValues: result.inspection,
      reason: remarks || 'In-Process QA Inspection Completed',
    });

    res.status(201).json({ success: true, data: result.inspection, ncr: result.ncrRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
