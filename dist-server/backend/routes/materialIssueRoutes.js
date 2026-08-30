"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/material-issues - List Material Issues
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('materialissue:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const issues = await prisma_1.prisma.materialIssue.findMany({
            where: {
                ...(companyId && { companyId }),
                ...(plantId && { plantId }),
            },
            include: {
                workOrder: { select: { id: true, woNumber: true, plannedQuantity: true, status: true } },
                material: { select: { id: true, materialCode: true, description: true } },
                uom: { select: { id: true, uomCode: true, name: true } },
                warehouse: { select: { id: true, warehouseCode: true, name: true } },
                bin: { select: { id: true, binCode: true, name: true } },
                issuer: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: issues });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/material-issues - Integration Contract MATERIAL_ISSUED
router.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('materialissue:create'), async (req, res) => {
    try {
        const { workOrderId, reservationId, materialId, issuedQuantity, warehouseId, binId } = req.body;
        const targetCompanyId = req.user.companyId;
        if (!workOrderId || !materialId || !issuedQuantity || parseFloat(issuedQuantity) <= 0 || !warehouseId) {
            return res.status(400).json({ success: false, error: 'Work order, material, positive issued quantity, and warehouse are required' });
        }
        const qtyToIssue = parseFloat(issuedQuantity);
        // Verify Work Order
        const wo = await prisma_1.prisma.workOrder.findUnique({ where: { id: workOrderId } });
        if (!wo) {
            return res.status(404).json({ success: false, error: 'Work Order not found' });
        }
        if (!req.user.isSuperAdmin && wo.companyId !== targetCompanyId) {
            return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
        }
        if (wo.status === 'CANCELLED' || wo.status === 'COMPLETED') {
            return res.status(400).json({ success: false, error: `Cannot issue material for Work Order in status ${wo.status}` });
        }
        // Verify Material
        const material = await prisma_1.prisma.material.findUnique({ where: { id: materialId } });
        if (!material || (!req.user.isSuperAdmin && material.companyId !== targetCompanyId)) {
            return res.status(400).json({ success: false, error: 'Invalid material or tenant boundary violation' });
        }
        // Verify Warehouse and Bin
        const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
        if (!warehouse || warehouse.plantId !== wo.plantId) {
            return res.status(400).json({ success: false, error: 'Warehouse does not belong to Work Order plant' });
        }
        if (binId) {
            const bin = await prisma_1.prisma.storageBin.findUnique({ where: { id: binId } });
            if (!bin || bin.warehouseId !== warehouseId) {
                return res.status(400).json({ success: false, error: 'Storage Bin does not belong to selected warehouse' });
            }
        }
        // Atomic transaction for Stock Deduction + Material Issue Creation + Stock Transaction Ledger + Integration Reference
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Validate Stock Balance
            const stockBal = await tx.stockBalance.findFirst({
                where: {
                    plantId: wo.plantId,
                    warehouseId,
                    materialId,
                },
            });
            const currentAvailable = stockBal ? stockBal.quantity : 0;
            if (currentAvailable < qtyToIssue) {
                throw new Error(`Insufficient stock available. Required: ${qtyToIssue}, Available: ${currentAvailable}`);
            }
            // 2. Deduct Stock Balance (Prevent Negative Stock)
            const updatedBalance = await tx.stockBalance.update({
                where: { id: stockBal.id },
                data: { quantity: { decrement: qtyToIssue } },
            });
            if (updatedBalance.quantity < 0) {
                throw new Error('Transaction aborted: Stock quantity cannot be negative');
            }
            // 3. Create Material Issue Record
            const issueCount = await tx.materialIssue.count();
            const issueNumber = `ISS-${String(issueCount + 1).padStart(5, '0')}`;
            const issue = await tx.materialIssue.create({
                data: {
                    issueNumber,
                    workOrderId: wo.id,
                    reservationId: reservationId || null,
                    materialId,
                    issuedQuantity: qtyToIssue,
                    uomId: material.uomId,
                    warehouseId,
                    binId: binId || null,
                    issuerId: req.user.id,
                    companyId: wo.companyId,
                    plantId: wo.plantId,
                    status: 'COMPLETED',
                    createdBy: req.user.id,
                },
            });
            // 4. Create Stock Transaction Record
            const txCount = await tx.stockTransaction.count();
            const txNumber = `STX-${String(txCount + 1).padStart(5, '0')}`;
            await tx.stockTransaction.create({
                data: {
                    transactionNumber: txNumber,
                    materialId,
                    quantity: -qtyToIssue, // Negative for consumption/issue
                    uomId: material.uomId,
                    warehouseId,
                    binId: binId || null,
                    transactionType: 'MATERIAL_ISSUE',
                    materialIssueId: issue.id,
                    userId: req.user.id,
                    companyId: wo.companyId,
                    plantId: wo.plantId,
                    referenceNumber: wo.woNumber,
                },
            });
            // 5. Update Reservation / Work Order status if in MATERIAL_RESERVED state
            if (wo.status === 'MATERIAL_RESERVED' || wo.status === 'RELEASED') {
                await tx.workOrder.update({
                    where: { id: wo.id },
                    data: { status: 'IN_PROCESS' },
                });
            }
            // 6. Transaction Reference (Integration Contract MATERIAL_ISSUED)
            await tx.transactionReference.create({
                data: {
                    sourceEntity: 'MaterialIssue',
                    sourceRecordId: issue.id,
                    targetEntity: 'WorkOrder',
                    targetRecordId: wo.id,
                    referenceType: 'MATERIAL_ISSUED',
                    referenceNumber: issue.issueNumber,
                    companyId: wo.companyId,
                    plantId: wo.plantId,
                    departmentId: wo.departmentId,
                    createdBy: req.user.id,
                },
            });
            // 7. Event Outbox
            await tx.eventOutbox.create({
                data: {
                    eventType: 'MATERIAL_ISSUED',
                    aggregateType: 'MaterialIssue',
                    aggregateId: issue.id,
                    payloadJson: JSON.stringify({
                        issueNumber: issue.issueNumber,
                        woNumber: wo.woNumber,
                        materialId,
                        issuedQuantity: qtyToIssue,
                    }),
                },
            });
            return issue;
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: wo.companyId,
            plantId: wo.plantId,
            departmentId: wo.departmentId,
            entity: 'MaterialIssue',
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
