"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/production-receipts - List Production Receipts
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('productionreceipt:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const receipts = await prisma_1.prisma.productionReceipt.findMany({
            where: {
                ...(companyId && { companyId }),
                ...(plantId && { plantId }),
            },
            include: {
                workOrder: { select: { id: true, woNumber: true, plannedQuantity: true, status: true } },
                execution: { select: { id: true, executionNumber: true, executedQuantity: true, goodQuantity: true, rejectedQuantity: true, holdQuantity: true } },
                finishedMaterial: { select: { id: true, materialCode: true, description: true } },
                uom: { select: { id: true, uomCode: true, name: true } },
                warehouse: { select: { id: true, warehouseCode: true, name: true } },
                bin: { select: { id: true, binCode: true, name: true } },
                receiver: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: receipts });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/production-receipts - Integration Contract PRODUCTION_COMPLETED
// Posts ONLY good production quantity to Available FG Stock (Rejected/Hold excluded from available stock)
router.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('productionreceipt:create'), async (req, res) => {
    try {
        const { executionId, warehouseId, binId } = req.body;
        const targetCompanyId = req.user.companyId;
        if (!executionId || !warehouseId) {
            return res.status(400).json({ success: false, error: 'Execution ID and destination warehouse ID are required' });
        }
        // Verify Production Execution
        const exec = await prisma_1.prisma.productionExecution.findUnique({
            where: { id: executionId },
            include: {
                workOrder: true,
                finishedMaterial: true,
            },
        });
        if (!exec) {
            return res.status(404).json({ success: false, error: 'Production Execution not found' });
        }
        if (!req.user.isSuperAdmin && exec.companyId !== targetCompanyId) {
            return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
        }
        // Verify Destination Warehouse & Bin
        const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
        if (!warehouse || warehouse.plantId !== exec.plantId) {
            return res.status(400).json({ success: false, error: 'Warehouse does not belong to production plant' });
        }
        if (binId) {
            const bin = await prisma_1.prisma.storageBin.findUnique({ where: { id: binId } });
            if (!bin || bin.warehouseId !== warehouseId) {
                return res.status(400).json({ success: false, error: 'Storage bin does not belong to destination warehouse' });
            }
        }
        // Protect against Duplicate Production Receipt
        const existingReceipt = await prisma_1.prisma.productionReceipt.findFirst({
            where: { executionId },
        });
        if (existingReceipt) {
            return res.status(400).json({ success: false, error: `Production receipt already generated for execution (${existingReceipt.receiptNumber})` });
        }
        const goodQtyToReceive = exec.goodQuantity; // ONLY good quantity enters FG available stock
        // Atomic transaction for Receipt Creation + Stock Addition + Work Order Completion check + Integration Reference + Event Outbox
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Create Production Receipt
            const rcptCount = await tx.productionReceipt.count();
            const receiptNumber = `RCPT-${String(rcptCount + 1).padStart(5, '0')}`;
            const receipt = await tx.productionReceipt.create({
                data: {
                    receiptNumber,
                    workOrderId: exec.workOrderId,
                    executionId: exec.id,
                    finishedMaterialId: exec.finishedMaterialId,
                    receivedQuantity: goodQtyToReceive, // ONLY Good Production
                    rejectedQuantity: exec.rejectedQuantity,
                    holdQuantity: exec.holdQuantity,
                    uomId: exec.finishedMaterial.uomId,
                    warehouseId,
                    binId: binId || null,
                    receiverId: req.user.id,
                    companyId: exec.companyId,
                    plantId: exec.plantId,
                    status: 'COMPLETED',
                    createdBy: req.user.id,
                },
            });
            // 2. Increase Available FG Stock in StockBalance (ONLY for good production)
            const existingStock = await tx.stockBalance.findFirst({
                where: {
                    plantId: exec.plantId,
                    warehouseId,
                    materialId: exec.finishedMaterialId,
                },
            });
            if (existingStock) {
                await tx.stockBalance.update({
                    where: { id: existingStock.id },
                    data: { quantity: { increment: goodQtyToReceive } },
                });
            }
            else {
                await tx.stockBalance.create({
                    data: {
                        companyId: exec.companyId,
                        plantId: exec.plantId,
                        warehouseId,
                        binId: binId || null,
                        materialId: exec.finishedMaterialId,
                        quantity: goodQtyToReceive,
                    },
                });
            }
            // 3. Record Stock Transaction Ledger
            const txCount = await tx.stockTransaction.count();
            const txNumber = `STX-${String(txCount + 1).padStart(5, '0')}`;
            await tx.stockTransaction.create({
                data: {
                    transactionNumber: txNumber,
                    materialId: exec.finishedMaterialId,
                    quantity: goodQtyToReceive, // Positive for FG stock addition
                    uomId: exec.finishedMaterial.uomId,
                    warehouseId,
                    binId: binId || null,
                    transactionType: 'PRODUCTION_RECEIPT',
                    productionReceiptId: receipt.id,
                    userId: req.user.id,
                    companyId: exec.companyId,
                    plantId: exec.plantId,
                    referenceNumber: exec.workOrder.woNumber,
                },
            });
            // 4. Update Work Order status if completed
            const allReceipts = await tx.productionReceipt.aggregate({
                where: { workOrderId: exec.workOrderId },
                _sum: { receivedQuantity: true },
            });
            const totalReceived = allReceipts._sum.receivedQuantity || 0;
            if (totalReceived >= exec.workOrder.plannedQuantity) {
                await tx.workOrder.update({
                    where: { id: exec.workOrderId },
                    data: { status: 'COMPLETED' },
                });
            }
            // 5. Transaction Reference (Integration Contract PRODUCTION_COMPLETED)
            await tx.transactionReference.create({
                data: {
                    sourceEntity: 'ProductionReceipt',
                    sourceRecordId: receipt.id,
                    targetEntity: 'WorkOrder',
                    targetRecordId: exec.workOrderId,
                    referenceType: 'PRODUCTION_COMPLETED',
                    referenceNumber: receipt.receiptNumber,
                    companyId: exec.companyId,
                    plantId: exec.plantId,
                    departmentId: exec.workOrder.departmentId,
                    createdBy: req.user.id,
                },
            });
            // 6. Event Outbox
            await tx.eventOutbox.create({
                data: {
                    eventType: 'PRODUCTION_COMPLETED',
                    aggregateType: 'ProductionReceipt',
                    aggregateId: receipt.id,
                    payloadJson: JSON.stringify({
                        receiptNumber: receipt.receiptNumber,
                        woNumber: exec.workOrder.woNumber,
                        fgMaterialCode: exec.finishedMaterial.materialCode,
                        goodQuantityReceived: goodQtyToReceive,
                        rejectedQuantity: exec.rejectedQuantity,
                    }),
                },
            });
            return receipt;
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: exec.companyId,
            plantId: exec.plantId,
            departmentId: exec.workOrder.departmentId,
            entity: 'ProductionReceipt',
            recordId: result.id,
            action: 'CREATE',
            newValues: result,
        });
        res.status(201).json({ success: true, data: result });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});
exports.default = router;
