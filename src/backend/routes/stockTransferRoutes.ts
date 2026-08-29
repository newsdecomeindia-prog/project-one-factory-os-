import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/stock-transfers - List Transfer Orders
router.get('/', requireAuth, requirePermission('stocktransfer:read'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { plantId, status } = req.query;

    const companyId = user.isSuperAdmin ? (req.query.companyId as string) : user.companyId;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (plantId) {
      where.OR = [
        { sourcePlantId: String(plantId) },
        { targetPlantId: String(plantId) },
      ];
    }
    if (status) {
      where.status = String(status);
    }

    const transfers = await prisma.inventoryTransferOrder.findMany({
      where,
      include: {
        sourcePlant: { select: { id: true, plantCode: true, plantName: true } },
        targetPlant: { select: { id: true, plantCode: true, plantName: true } },
        sourceWarehouse: { select: { id: true, warehouseCode: true, name: true } },
        targetWarehouse: { select: { id: true, warehouseCode: true, name: true } },
        material: { select: { id: true, materialCode: true, description: true } },
        uom: { select: { id: true, uomCode: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: transfers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/stock-transfers - Create Stock Transfer Order Requisition
router.post('/', requireAuth, requirePermission('stocktransfer:create'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { sourcePlantId, targetPlantId, sourceWarehouseId, targetWarehouseId, sourceBinId, targetBinId, materialId, transferQuantity, uomId } = req.body;

    if (!sourcePlantId || !targetPlantId || !sourceWarehouseId || !targetWarehouseId || !materialId || !transferQuantity || !uomId) {
      return res.status(400).json({ success: false, error: 'Missing required transfer order fields' });
    }

    const qty = Number(transferQuantity);
    if (qty <= 0) {
      return res.status(400).json({ success: false, error: 'Transfer quantity must be positive' });
    }

    const sourcePlant = await prisma.plant.findUnique({ where: { id: String(sourcePlantId) } });
    if (!sourcePlant) {
      return res.status(404).json({ success: false, error: 'Source plant not found' });
    }

    if (!user.isSuperAdmin && sourcePlant.companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot request transfer for another company' });
    }

    const transferNumber = `TR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryTransferOrder.create({
        data: {
          transferNumber,
          sourcePlantId: String(sourcePlantId),
          targetPlantId: String(targetPlantId),
          sourceWarehouseId: String(sourceWarehouseId),
          targetWarehouseId: String(targetWarehouseId),
          sourceBinId: sourceBinId ? String(sourceBinId) : null,
          targetBinId: targetBinId ? String(targetBinId) : null,
          materialId: String(materialId),
          transferQuantity: qty,
          uomId: String(uomId),
          status: 'REQUESTED',
          requestedById: user.id,
          companyId: sourcePlant.companyId,
          createdBy: user.id,
        },
      });

      await tx.transactionReference.create({
        data: {
          sourceEntity: 'InventoryTransferOrder',
          sourceRecordId: created.id,
          targetEntity: 'Material',
          targetRecordId: String(materialId),
          referenceType: 'STOCK_TRANSFER_REQUESTED',
          referenceNumber: transferNumber,
          companyId: sourcePlant.companyId,
          plantId: String(sourcePlantId),
          createdBy: user.id,
        },
      });

      return created;
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: sourcePlant.companyId,
      plantId: String(sourcePlantId),
      entity: 'InventoryTransferOrder',
      recordId: transfer.id,
      action: 'CREATE',
      newValues: transfer,
      reason: `Stock Transfer Request ${transferNumber}`,
    });

    res.status(201).json({ success: true, data: transfer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/stock-transfers/:id/approve - Approve Stock Transfer Requisition
router.post('/:id/approve', requireAuth, requirePermission('stocktransfer:approve'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const transferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const transfer = await prisma.inventoryTransferOrder.findUnique({ where: { id: transferId } });
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer order not found' });
    }

    if (!user.isSuperAdmin && transfer.companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot approve transfer for another company' });
    }

    if (transfer.status !== 'REQUESTED') {
      return res.status(400).json({ success: false, error: `Transfer order cannot be approved in status ${transfer.status}` });
    }

    const updated = await prisma.inventoryTransferOrder.update({
      where: { id: transferId },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: transfer.companyId,
      plantId: transfer.sourcePlantId,
      entity: 'InventoryTransferOrder',
      recordId: transfer.id,
      action: 'UPDATE',
      oldValues: transfer,
      newValues: updated,
      reason: `Stock Transfer Approved (${transfer.transferNumber})`,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/v1/stock-transfers/:id/issue - Issue & Dispatch Stock Transfer Order
router.post('/:id/issue', requireAuth, requirePermission('stocktransfer:issue'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const transferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const transfer = await prisma.inventoryTransferOrder.findUnique({ where: { id: transferId } });
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer order not found' });
    }

    if (!user.isSuperAdmin && transfer.companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot issue transfer for another company' });
    }

    // PREVENT DUPLICATE ISSUE
    if (transfer.status === 'IN_TRANSIT' || transfer.status === 'RECEIVED' || transfer.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: `Transfer order has already been issued or completed (current status: ${transfer.status})` });
    }

    if (transfer.status !== 'REQUESTED' && transfer.status !== 'APPROVED') {
      return res.status(400).json({ success: false, error: `Transfer order cannot be issued in status ${transfer.status}` });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check source stock balance
      const sourceBalance = await tx.stockBalance.findFirst({
        where: {
          plantId: transfer.sourcePlantId,
          warehouseId: transfer.sourceWarehouseId,
          materialId: transfer.materialId,
        },
      });

      if (!sourceBalance || sourceBalance.quantity < transfer.transferQuantity) {
        throw new Error(`Insufficient stock available at source warehouse. Available: ${sourceBalance ? sourceBalance.quantity : 0}, Requested: ${transfer.transferQuantity}`);
      }

      // Deduct stock exactly once from source balance
      await tx.stockBalance.update({
        where: { id: sourceBalance.id },
        data: { quantity: sourceBalance.quantity - transfer.transferQuantity },
      });

      // Record source stock transaction
      const txnNumber = `STX-ISS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await tx.stockTransaction.create({
        data: {
          transactionNumber: txnNumber,
          materialId: transfer.materialId,
          quantity: -transfer.transferQuantity,
          uomId: transfer.uomId,
          warehouseId: transfer.sourceWarehouseId,
          binId: transfer.sourceBinId,
          transactionType: 'TRANSFER_ISSUE',
          userId: user.id,
          companyId: transfer.companyId,
          plantId: transfer.sourcePlantId,
          referenceNumber: transfer.transferNumber,
        },
      });

      // Update transfer order status to IN_TRANSIT
      const updated = await tx.inventoryTransferOrder.update({
        where: { id: transferId },
        data: {
          status: 'IN_TRANSIT',
          issuedById: user.id,
        },
      });

      // Create Transaction Reference
      await tx.transactionReference.create({
        data: {
          sourceEntity: 'InventoryTransferOrder',
          sourceRecordId: transfer.id,
          targetEntity: 'StockBalance',
          targetRecordId: sourceBalance.id,
          referenceType: 'STOCK_TRANSFER_ISSUED',
          referenceNumber: transfer.transferNumber,
          companyId: transfer.companyId,
          plantId: transfer.sourcePlantId,
          createdBy: user.id,
        },
      });

      // Emit Outbox Event
      await tx.eventOutbox.create({
        data: {
          eventType: 'STOCK_TRANSFER_ISSUED',
          aggregateType: 'InventoryTransferOrder',
          aggregateId: transfer.id,
          payloadJson: JSON.stringify({
            transferNumber: transfer.transferNumber,
            quantity: transfer.transferQuantity,
            sourceWarehouseId: transfer.sourceWarehouseId,
            companyId: transfer.companyId,
          }),
          status: 'PENDING',
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: transfer.companyId,
      plantId: transfer.sourcePlantId,
      entity: 'InventoryTransferOrder',
      recordId: transfer.id,
      action: 'ISSUE',
      newValues: result,
      reason: `Stock Transfer Issued & Dispatched (${transfer.transferNumber})`,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/v1/stock-transfers/:id/receive - Receive Transfer Order at Target
router.post('/:id/receive', requireAuth, requirePermission('stocktransfer:receive'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const recTransferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Use atomic update to lock state transition from IN_TRANSIT to COMPLETED
    const atomicUpdate = await prisma.inventoryTransferOrder.updateMany({
      where: {
        id: recTransferId,
        status: 'IN_TRANSIT',
      },
      data: {
        status: 'COMPLETED',
        receivedById: user.id,
      },
    });

    if (atomicUpdate.count === 0) {
      const current = await prisma.inventoryTransferOrder.findUnique({ where: { id: recTransferId } });
      if (!current) {
        return res.status(404).json({ success: false, error: 'Transfer order not found' });
      }
      return res.status(400).json({ success: false, error: `Transfer order cannot be received in status ${current.status}` });
    }

    const transfer = await prisma.inventoryTransferOrder.findUnique({ where: { id: recTransferId } });
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer order not found' });
    }

    if (!user.isSuperAdmin && transfer.companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot receive transfer for another company' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find or create target stock balance
      const existingTargetBalance = await tx.stockBalance.findFirst({
        where: {
          plantId: transfer.targetPlantId,
          warehouseId: transfer.targetWarehouseId,
          materialId: transfer.materialId,
        },
      });

      let targetBalId = '';
      if (existingTargetBalance) {
        targetBalId = existingTargetBalance.id;
        await tx.stockBalance.update({
          where: { id: existingTargetBalance.id },
          data: { quantity: existingTargetBalance.quantity + transfer.transferQuantity },
        });
      } else {
        const newBal = await tx.stockBalance.create({
          data: {
            companyId: transfer.companyId,
            plantId: transfer.targetPlantId,
            warehouseId: transfer.targetWarehouseId,
            binId: transfer.targetBinId,
            materialId: transfer.materialId,
            quantity: transfer.transferQuantity,
          },
        });
        targetBalId = newBal.id;
      }

      // Record target stock transaction
      const txnNumber = `STX-REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await tx.stockTransaction.create({
        data: {
          transactionNumber: txnNumber,
          materialId: transfer.materialId,
          quantity: transfer.transferQuantity,
          uomId: transfer.uomId,
          warehouseId: transfer.targetWarehouseId,
          binId: transfer.targetBinId,
          transactionType: 'TRANSFER_RECEIPT',
          userId: user.id,
          companyId: transfer.companyId,
          plantId: transfer.targetPlantId,
          referenceNumber: transfer.transferNumber,
        },
      });

      // Update transfer order status to COMPLETED
      const updated = await tx.inventoryTransferOrder.update({
        where: { id: recTransferId },
        data: {
          status: 'COMPLETED',
          receivedById: user.id,
        },
      });

      // Create Transaction Reference
      await tx.transactionReference.create({
        data: {
          sourceEntity: 'InventoryTransferOrder',
          sourceRecordId: transfer.id,
          targetEntity: 'StockBalance',
          targetRecordId: targetBalId,
          referenceType: 'STOCK_TRANSFER_RECEIVED',
          referenceNumber: transfer.transferNumber,
          companyId: transfer.companyId,
          plantId: transfer.targetPlantId,
          createdBy: user.id,
        },
      });

      // Emit Outbox Event
      await tx.eventOutbox.create({
        data: {
          eventType: 'STOCK_TRANSFER_RECEIVED',
          aggregateType: 'InventoryTransferOrder',
          aggregateId: transfer.id,
          payloadJson: JSON.stringify({
            transferNumber: transfer.transferNumber,
            quantity: transfer.transferQuantity,
            targetWarehouseId: transfer.targetWarehouseId,
            companyId: transfer.companyId,
          }),
          status: 'PENDING',
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: transfer.companyId,
      plantId: transfer.targetPlantId,
      entity: 'InventoryTransferOrder',
      recordId: transfer.id,
      action: 'RECEIVE',
      newValues: result,
      reason: `Stock Transfer Received at Target (${transfer.transferNumber})`,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/v1/stock-transfers/:id/cancel - Controlled Cancellation of Transfer Order
router.post('/:id/cancel', requireAuth, requirePermission('stocktransfer:create'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const transferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { reason } = req.body;

    const reasonStr = Array.isArray(reason) ? reason[0] : reason;
    if (!reasonStr || typeof reasonStr !== 'string' || reasonStr.trim() === '') {
      return res.status(400).json({ success: false, error: 'Mandatory reason is required for transfer cancellation' });
    }

    const transfer = await prisma.inventoryTransferOrder.findUnique({ where: { id: transferId } });
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer order not found' });
    }

    if (!user.isSuperAdmin && transfer.companyId !== user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot cancel transfer for another company' });
    }

    if (transfer.status === 'COMPLETED' || transfer.status === 'RECEIVED') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a completed stock transfer' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If transfer was already IN_TRANSIT, restore source stock balance
      if (transfer.status === 'IN_TRANSIT') {
        const sourceBal = await tx.stockBalance.findFirst({
          where: { plantId: transfer.sourcePlantId, warehouseId: transfer.sourceWarehouseId, materialId: transfer.materialId },
        });

        if (sourceBal) {
          await tx.stockBalance.update({
            where: { id: sourceBal.id },
            data: { quantity: sourceBal.quantity + transfer.transferQuantity },
          });

          await tx.stockTransaction.create({
            data: {
              transactionNumber: `STX-RESTORE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              materialId: transfer.materialId,
              quantity: transfer.transferQuantity,
              uomId: transfer.uomId,
              warehouseId: transfer.sourceWarehouseId,
              binId: transfer.sourceBinId,
              transactionType: 'TRANSFER_CANCEL_RESTORE',
              userId: user.id,
              companyId: transfer.companyId,
              plantId: transfer.sourcePlantId,
              referenceNumber: transfer.transferNumber,
            },
          });
        }
      }

      return tx.inventoryTransferOrder.update({
        where: { id: transferId },
        data: {
          status: 'CANCELLED',
          cancelReason: reasonStr.trim(),
        },
      });
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: transfer.companyId,
      plantId: transfer.sourcePlantId,
      entity: 'InventoryTransferOrder',
      recordId: transfer.id,
      action: 'CANCEL',
      oldValues: transfer,
      newValues: updated,
      reason: reasonStr.trim(),
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
