"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/work-orders - List Work Orders
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('workorder:read'), async (req, res) => {
    try {
        const companyId = req.user.isSuperAdmin ? req.query.companyId : req.user.companyId;
        const plantId = req.query.plantId;
        const workOrders = await prisma_1.prisma.workOrder.findMany({
            where: {
                ...(companyId && { companyId }),
                ...(plantId && { plantId }),
            },
            include: {
                finishedMaterial: { select: { id: true, materialCode: true, description: true } },
                bomHeader: { select: { id: true, bomNumber: true, version: true } },
                plant: { select: { id: true, plantCode: true, plantName: true } },
                department: { select: { id: true, departmentCode: true, departmentName: true } },
                uom: { select: { id: true, uomCode: true, name: true } },
                reservations: {
                    include: {
                        material: { select: { id: true, materialCode: true, description: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: workOrders });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/v1/work-orders/:id - Work Order Details
router.get('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('workorder:read'), async (req, res) => {
    try {
        const { id } = req.params;
        const wo = await prisma_1.prisma.workOrder.findUnique({
            where: { id: id },
            include: {
                finishedMaterial: true,
                bomHeader: { include: { components: { include: { componentMaterial: true, uom: true } } } },
                plant: true,
                department: true,
                uom: true,
                reservations: { include: { material: true, warehouse: true, bin: true } },
                materialIssues: { include: { material: true, uom: true, warehouse: true, bin: true } },
                productionExecutions: { include: { operator: { select: { firstName: true, lastName: true, email: true } } } },
                productionReceipts: { include: { warehouse: true, bin: true } },
            },
        });
        if (!wo) {
            return res.status(404).json({ success: false, error: 'Work Order not found' });
        }
        if (!req.user.isSuperAdmin && wo.companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
        }
        res.json({ success: true, data: wo });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/work-orders - Create Draft Work Order
router.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('workorder:create'), async (req, res) => {
    try {
        const { plantId, departmentId, finishedMaterialId, bomHeaderId, plannedQuantity, uomId, plannedStartDate, plannedCompletionDate, priority, productionLine } = req.body;
        const companyId = req.user.companyId;
        if (!plantId || !departmentId || !finishedMaterialId || !bomHeaderId || !plannedQuantity || plannedQuantity <= 0) {
            return res.status(400).json({ success: false, error: 'Plant, department, finished material, active BOM, and positive planned quantity are required' });
        }
        // Verify plant
        const plant = await prisma_1.prisma.plant.findUnique({ where: { id: plantId } });
        if (!plant || (!req.user.isSuperAdmin && plant.companyId !== companyId)) {
            return res.status(400).json({ success: false, error: 'Invalid plant or plant isolation violation' });
        }
        // Verify department
        const dept = await prisma_1.prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept || dept.plantId !== plantId) {
            return res.status(400).json({ success: false, error: 'Department does not belong to selected plant' });
        }
        // Verify BOM Header
        const bom = await prisma_1.prisma.bomHeader.findUnique({ where: { id: bomHeaderId }, include: { components: true } });
        if (!bom || bom.finishedMaterialId !== finishedMaterialId || (bom.status !== 'ACTIVE' && bom.status !== 'DRAFT')) {
            return res.status(400).json({ success: false, error: 'Invalid or inactive BOM reference' });
        }
        const finishedMat = await prisma_1.prisma.material.findUnique({ where: { id: finishedMaterialId } });
        if (!finishedMat) {
            return res.status(400).json({ success: false, error: 'Finished material not found' });
        }
        // Generate WO Number
        const woCount = await prisma_1.prisma.workOrder.count();
        const woNumber = `WO-${String(woCount + 1).padStart(5, '0')}`;
        const wo = await prisma_1.prisma.workOrder.create({
            data: {
                woNumber,
                companyId: plant.companyId,
                plantId,
                departmentId,
                finishedMaterialId,
                bomHeaderId,
                plannedQuantity: parseFloat(plannedQuantity),
                uomId: uomId || finishedMat.uomId,
                plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : new Date(),
                plannedCompletionDate: plannedCompletionDate ? new Date(plannedCompletionDate) : new Date(Date.now() + 86400000 * 7),
                priority: priority || 'MEDIUM',
                productionLine: productionLine || 'LINE-1',
                status: 'DRAFT',
                createdBy: req.user.id,
            },
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: plant.companyId,
            plantId,
            departmentId,
            entity: 'WorkOrder',
            recordId: wo.id,
            action: 'CREATE',
            newValues: wo,
        });
        res.status(201).json({ success: true, data: wo });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});
// POST /api/v1/work-orders/:id/release - Integration Contract WORK_ORDER_RELEASED
router.post('/:id/release', auth_1.requireAuth, (0, auth_1.requirePermission)('workorder:release'), async (req, res) => {
    try {
        const { id } = req.params;
        const wo = await prisma_1.prisma.workOrder.findUnique({
            where: { id: id },
            include: {
                bomHeader: { include: { components: true } },
                finishedMaterial: true,
            },
        });
        if (!wo) {
            return res.status(404).json({ success: false, error: 'Work Order not found' });
        }
        if (!req.user.isSuperAdmin && wo.companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
        }
        if (wo.status !== 'DRAFT') {
            return res.status(400).json({ success: false, error: `Cannot release Work Order in status ${wo.status}` });
        }
        if (!wo.bomHeader || wo.bomHeader.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: 'Cannot release Work Order with inactive or invalid BOM' });
        }
        // Default main warehouse for reservation calculation
        const defaultWarehouse = await prisma_1.prisma.warehouse.findFirst({
            where: { plantId: wo.plantId, status: 'ACTIVE' },
        });
        if (!defaultWarehouse) {
            return res.status(400).json({ success: false, error: 'No active warehouse found for plant to create material reservations' });
        }
        const defaultBin = await prisma_1.prisma.storageBin.findFirst({
            where: { warehouseId: defaultWarehouse.id, status: 'ACTIVE' },
        });
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Create Material Reservation records calculated strictly from BOM quantity per unit * planned quantity
            const resCount = await tx.materialReservation.count();
            const reservations = [];
            for (let i = 0; i < wo.bomHeader.components.length; i++) {
                const comp = wo.bomHeader.components[i];
                const requiredQty = comp.quantityPerUnit * wo.plannedQuantity * (1 + (comp.scrapFactor || 0) / 100);
                const resNumber = `RES-${String(resCount + i + 1).padStart(5, '0')}`;
                const resObj = await tx.materialReservation.create({
                    data: {
                        reservationNumber: resNumber,
                        workOrderId: wo.id,
                        bomHeaderId: wo.bomHeaderId,
                        materialId: comp.componentMaterialId,
                        requiredQuantity: requiredQty,
                        reservedQuantity: requiredQty,
                        warehouseId: defaultWarehouse.id,
                        binId: defaultBin?.id || null,
                        companyId: wo.companyId,
                        plantId: wo.plantId,
                        status: 'RESERVED',
                        createdBy: req.user.id,
                    },
                });
                reservations.push(resObj);
            }
            // Update WO status to RELEASED (or MATERIAL_RESERVED)
            const updatedWo = await tx.workOrder.update({
                where: { id: wo.id },
                data: { status: 'MATERIAL_RESERVED' },
                include: { reservations: true },
            });
            // Create TransactionReference contract for WORK_ORDER_RELEASED
            await tx.transactionReference.create({
                data: {
                    sourceEntity: 'WorkOrder',
                    sourceRecordId: wo.id,
                    targetEntity: 'MaterialReservation',
                    targetRecordId: reservations[0]?.id || wo.id,
                    referenceType: 'WORK_ORDER_RELEASED',
                    referenceNumber: wo.woNumber,
                    companyId: wo.companyId,
                    plantId: wo.plantId,
                    departmentId: wo.departmentId,
                    createdBy: req.user.id,
                },
            });
            // Event Outbox
            await tx.eventOutbox.create({
                data: {
                    eventType: 'WORK_ORDER_RELEASED',
                    aggregateType: 'WorkOrder',
                    aggregateId: wo.id,
                    payloadJson: JSON.stringify({
                        woNumber: wo.woNumber,
                        plannedQuantity: wo.plannedQuantity,
                        reservationCount: reservations.length,
                    }),
                },
            });
            return updatedWo;
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: wo.companyId,
            plantId: wo.plantId,
            departmentId: wo.departmentId,
            entity: 'WorkOrder',
            recordId: wo.id,
            action: 'RELEASE',
            oldValues: { status: 'DRAFT' },
            newValues: { status: 'MATERIAL_RESERVED' },
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});
// POST /api/v1/work-orders/:id/cancel - Controlled Cancellation (No Destructive Delete)
router.post('/:id/cancel', auth_1.requireAuth, (0, auth_1.requirePermission)('workorder:cancel'), async (req, res) => {
    try {
        const { id } = req.params;
        const { cancelReason } = req.body;
        if (!cancelReason || typeof cancelReason !== 'string' || cancelReason.trim() === '') {
            return res.status(400).json({ success: false, error: 'Mandatory cancellation reason is required' });
        }
        const wo = await prisma_1.prisma.workOrder.findUnique({ where: { id: id } });
        if (!wo) {
            return res.status(404).json({ success: false, error: 'Work Order not found' });
        }
        if (!req.user.isSuperAdmin && wo.companyId !== req.user.companyId) {
            return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
        }
        if (wo.status === 'COMPLETED' || wo.status === 'CANCELLED') {
            return res.status(400).json({ success: false, error: `Cannot cancel Work Order in status ${wo.status}` });
        }
        const updated = await prisma_1.prisma.workOrder.update({
            where: { id: id },
            data: {
                status: 'CANCELLED',
                cancelReason,
            },
        });
        await auditService_1.AuditService.log({
            userId: req.user.id,
            userEmail: req.user.email,
            companyId: wo.companyId,
            plantId: wo.plantId,
            departmentId: wo.departmentId,
            entity: 'WorkOrder',
            recordId: id,
            action: 'CANCEL',
            oldValues: wo,
            newValues: updated,
            reason: cancelReason,
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
