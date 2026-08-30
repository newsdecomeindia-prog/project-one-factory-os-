"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// ==================================================
// SALES ENQUIRY ROUTES
// ==================================================
// GET /api/v1/sales/enquiries
router.get('/enquiries', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:enquiry']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            res.status(400).json({ success: false, error: 'User company missing' });
            return;
        }
        const enquiries = await prisma_1.prisma.salesEnquiry.findMany({
            where: { companyId },
            include: {
                customer: true,
                plant: true,
                material: true,
                uom: true,
                requester: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, data: enquiries });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/sales/enquiries
router.post('/enquiries', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:enquiry']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        if (!companyId || !userId) {
            res.status(400).json({ success: false, error: 'User context missing' });
            return;
        }
        const { customerId, plantId, departmentId, materialId, quantity, uomId, requiredDate, remarks } = req.body;
        if (!customerId || !plantId || !materialId || !quantity || !uomId || !requiredDate) {
            res.status(400).json({ success: false, error: 'Missing required enquiry fields' });
            return;
        }
        const enquiryNumber = `ENQ-${Date.now()}`;
        const enquiry = await prisma_1.prisma.salesEnquiry.create({
            data: {
                enquiryNumber,
                customerId,
                plantId,
                departmentId,
                materialId,
                quantity: parseFloat(quantity),
                uomId,
                requiredDate: new Date(requiredDate),
                requesterId: userId,
                remarks,
                companyId,
                createdBy: userId,
                status: 'DRAFT',
            },
            include: { customer: true, material: true },
        });
        await auditService_1.AuditService.log({
            userId,
            companyId,
            plantId,
            entity: 'SalesEnquiry',
            recordId: enquiry.id,
            action: 'CREATE',
            newValues: enquiry,
        });
        await prisma_1.prisma.transactionReference.create({
            data: {
                sourceEntity: 'SalesEnquiry',
                sourceRecordId: enquiry.id,
                targetEntity: 'Customer',
                targetRecordId: customerId,
                referenceType: 'ENQUIRY_CREATED',
                referenceNumber: enquiry.enquiryNumber,
                companyId,
                plantId,
                createdBy: userId,
            },
        });
        res.status(201).json({ success: true, data: enquiry });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/sales/enquiries/:id/status
router.post('/enquiries/:id/status', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:enquiry']), async (req, res) => {
    try {
        const id = req.params.id;
        const { status, remarks } = req.body;
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        const existing = await prisma_1.prisma.salesEnquiry.findUnique({ where: { id } });
        if (!existing || existing.companyId !== companyId) {
            res.status(404).json({ success: false, error: 'Enquiry not found or access denied' });
            return;
        }
        const updated = await prisma_1.prisma.salesEnquiry.update({
            where: { id },
            data: {
                status,
                remarks: remarks || existing.remarks,
            },
        });
        await auditService_1.AuditService.log({
            userId,
            companyId,
            entity: 'SalesEnquiry',
            recordId: id,
            action: 'UPDATE',
            oldValues: existing,
            newValues: updated,
        });
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================================================
// QUOTATION ROUTES
// ==================================================
// GET /api/v1/sales/quotations
router.get('/quotations', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:quotation']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            res.status(400).json({ success: false, error: 'User company missing' });
            return;
        }
        const quotations = await prisma_1.prisma.salesQuotation.findMany({
            where: { companyId },
            include: {
                customer: true,
                enquiry: true,
                material: true,
                plant: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, data: quotations });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/sales/quotations
router.post('/quotations', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:quotation']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        if (!companyId || !userId) {
            res.status(400).json({ success: false, error: 'User context missing' });
            return;
        }
        const { customerId, enquiryId, materialId, quantity, rate, taxReference, deliveryTerms, paymentTerms, validityDate, plantId, } = req.body;
        if (!customerId || !materialId || !quantity || !rate || !validityDate || !plantId) {
            res.status(400).json({ success: false, error: 'Missing required quotation fields' });
            return;
        }
        const quotationNumber = `QUO-${Date.now()}`;
        const quotation = await prisma_1.prisma.salesQuotation.create({
            data: {
                quotationNumber,
                customerId,
                enquiryId: enquiryId || null,
                materialId,
                quantity: parseFloat(quantity),
                rate: parseFloat(rate),
                taxReference,
                deliveryTerms,
                paymentTerms,
                validityDate: new Date(validityDate),
                plantId,
                companyId,
                createdBy: userId,
                status: 'ISSUED',
            },
            include: { customer: true, material: true },
        });
        // Update Enquiry status if converted
        if (enquiryId) {
            await prisma_1.prisma.salesEnquiry.update({
                where: { id: enquiryId },
                data: { status: 'CONVERTED' },
            });
            await prisma_1.prisma.transactionReference.create({
                data: {
                    sourceEntity: 'SalesEnquiry',
                    sourceRecordId: enquiryId,
                    targetEntity: 'SalesQuotation',
                    targetRecordId: quotation.id,
                    referenceType: 'ENQUIRY_TO_QUOTATION',
                    referenceNumber: quotation.quotationNumber,
                    companyId,
                    plantId,
                    createdBy: userId,
                },
            });
        }
        await auditService_1.AuditService.log({
            userId,
            companyId,
            plantId,
            entity: 'SalesQuotation',
            recordId: quotation.id,
            action: 'CREATE',
            newValues: quotation,
        });
        res.status(201).json({ success: true, data: quotation });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================================================
// SALES ORDER ROUTES
// ==================================================
// GET /api/v1/sales/orders
router.get('/orders', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:order']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            res.status(400).json({ success: false, error: 'User company missing' });
            return;
        }
        const orders = await prisma_1.prisma.salesOrder.findMany({
            where: { companyId },
            include: {
                customer: true,
                quotation: true,
                material: true,
                uom: true,
                plant: true,
                createdUser: true,
                approvedUser: true,
                productionRequirements: true,
                deliveryPlans: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/sales/orders
router.post('/orders', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:order']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        if (!companyId || !userId) {
            res.status(400).json({ success: false, error: 'User context missing' });
            return;
        }
        const { customerId, quotationId, materialId, quantity, uomId, rate, taxReference, requiredDeliveryDate, plantId, shippingLocation, paymentTerms, } = req.body;
        if (!customerId || !materialId || !quantity || !uomId || !rate || !requiredDeliveryDate || !plantId) {
            res.status(400).json({ success: false, error: 'Missing required Sales Order fields' });
            return;
        }
        const soNumber = `SO-${Date.now()}`;
        const salesOrder = await prisma_1.prisma.salesOrder.create({
            data: {
                soNumber,
                customerId,
                quotationId: quotationId || null,
                materialId,
                quantity: parseFloat(quantity),
                uomId,
                rate: parseFloat(rate),
                taxReference,
                requiredDeliveryDate: new Date(requiredDeliveryDate),
                plantId,
                shippingLocation,
                paymentTerms,
                createdById: userId,
                companyId,
                status: 'SUBMITTED',
                approvalStatus: 'PENDING',
            },
            include: { customer: true, material: true, uom: true },
        });
        if (quotationId) {
            await prisma_1.prisma.transactionReference.create({
                data: {
                    sourceEntity: 'SalesQuotation',
                    sourceRecordId: quotationId,
                    targetEntity: 'SalesOrder',
                    targetRecordId: salesOrder.id,
                    referenceType: 'QUOTATION_TO_SO',
                    referenceNumber: salesOrder.soNumber,
                    companyId,
                    plantId,
                    createdBy: userId,
                },
            });
        }
        await auditService_1.AuditService.log({
            userId,
            companyId,
            plantId,
            entity: 'SalesOrder',
            recordId: salesOrder.id,
            action: 'CREATE',
            newValues: salesOrder,
        });
        res.status(201).json({ success: true, data: salesOrder });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/sales/orders/:id/approve — Maker-Checker Approval
router.post('/orders/:id/approve', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:approve']), async (req, res) => {
    try {
        const id = req.params.id;
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        const userRoles = req.user?.roles || [];
        const so = await prisma_1.prisma.salesOrder.findUnique({ where: { id } });
        if (!so || so.companyId !== companyId) {
            res.status(404).json({ success: false, error: 'Sales Order not found or access denied' });
            return;
        }
        // Maker cannot approve own SO unless Super Admin
        const isSuperAdmin = userRoles.includes('Super Admin');
        if (so.createdById === userId && !isSuperAdmin) {
            res.status(403).json({ success: false, error: 'Maker-Checker Segregation: Requisitioner cannot approve own Sales Order' });
            return;
        }
        const approvedSo = await prisma_1.prisma.salesOrder.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approvalStatus: 'APPROVED',
                approvedById: userId,
                approvedAt: new Date(),
            },
        });
        await auditService_1.AuditService.log({
            userId,
            companyId,
            plantId: so.plantId,
            entity: 'SalesOrder',
            recordId: id,
            action: 'RELEASE',
            oldValues: so,
            newValues: approvedSo,
        });
        res.status(200).json({ success: true, data: approvedSo });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/sales/orders/:id/check-availability — FG Availability Check (Strictly READ-ONLY stock check)
router.post('/orders/:id/check-availability', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:availability']), async (req, res) => {
    try {
        const id = req.params.id;
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        const so = await prisma_1.prisma.salesOrder.findUnique({
            where: { id },
            include: { material: true, uom: true, customer: true, plant: true },
        });
        if (!so || so.companyId !== companyId) {
            res.status(404).json({ success: false, error: 'Sales Order not found or access denied' });
            return;
        }
        // Check actual FG Stock Balance in DB for this plant & material
        const stockBalances = await prisma_1.prisma.stockBalance.findMany({
            where: {
                plantId: so.plantId,
                materialId: so.materialId,
            },
        });
        const totalAvailable = stockBalances.reduce((sum, b) => sum + b.quantity, 0);
        const orderedQty = so.quantity;
        const fulfillable = Math.min(orderedQty, totalAvailable);
        const shortage = Math.max(0, orderedQty - totalAvailable);
        let reqRecord = null;
        if (shortage > 0) {
            const reqNumber = `PRQ-${Date.now()}`;
            reqRecord = await prisma_1.prisma.productionRequirement.create({
                data: {
                    requirementNumber: reqNumber,
                    soId: so.id,
                    plantId: so.plantId,
                    materialId: so.materialId,
                    uomId: so.uomId,
                    shortageQuantity: shortage,
                    status: 'OPEN',
                    companyId,
                    createdBy: userId,
                },
            });
            await prisma_1.prisma.transactionReference.create({
                data: {
                    sourceEntity: 'SalesOrder',
                    sourceRecordId: so.id,
                    targetEntity: 'ProductionRequirement',
                    targetRecordId: reqRecord.id,
                    referenceType: 'SO_SHORTAGE_REQUIREMENT',
                    referenceNumber: reqNumber,
                    companyId,
                    plantId: so.plantId,
                    createdBy: userId,
                },
            });
        }
        await auditService_1.AuditService.log({
            userId,
            companyId,
            plantId: so.plantId,
            entity: 'SalesOrder',
            recordId: so.id,
            action: 'EXECUTE',
            newValues: {
                soNumber: so.soNumber,
                orderedQuantity: orderedQty,
                availableStock: totalAvailable,
                fulfillable,
                shortage,
                productionRequirementCreated: reqRecord ? reqRecord.requirementNumber : null,
            },
        });
        res.status(200).json({
            success: true,
            data: {
                soId: so.id,
                soNumber: so.soNumber,
                materialCode: so.material.materialCode,
                orderedQuantity: orderedQty,
                availableStock: totalAvailable,
                fulfillableQuantity: fulfillable,
                shortageQuantity: shortage,
                productionRequirement: reqRecord,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================================================
// DELIVERY PLANNING ROUTES
// ==================================================
// GET /api/v1/sales/delivery-plans
router.get('/delivery-plans', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:delivery']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            res.status(400).json({ success: false, error: 'User company missing' });
            return;
        }
        const plans = await prisma_1.prisma.deliveryPlan.findMany({
            where: { companyId },
            include: {
                salesOrder: true,
                customer: true,
                plant: true,
                material: true,
                uom: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, data: plans });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/sales/delivery-plans
router.post('/delivery-plans', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:delivery']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        if (!companyId || !userId) {
            res.status(400).json({ success: false, error: 'User context missing' });
            return;
        }
        const { soId, plannedQuantity } = req.body;
        if (!soId || !plannedQuantity) {
            res.status(400).json({ success: false, error: 'soId and plannedQuantity are required' });
            return;
        }
        const so = await prisma_1.prisma.salesOrder.findUnique({
            where: { id: soId },
            include: { material: true, uom: true, customer: true },
        });
        if (!so || so.companyId !== companyId) {
            res.status(404).json({ success: false, error: 'Sales Order not found or access denied' });
            return;
        }
        // Check current FG stock
        const stockBalances = await prisma_1.prisma.stockBalance.findMany({
            where: { plantId: so.plantId, materialId: so.materialId },
        });
        const currentAvailable = stockBalances.reduce((sum, b) => sum + b.quantity, 0);
        const planQty = parseFloat(plannedQuantity);
        const pending = Math.max(0, so.quantity - planQty);
        const planNumber = `DEL-${Date.now()}`;
        const deliveryPlan = await prisma_1.prisma.deliveryPlan.create({
            data: {
                planNumber,
                soId: so.id,
                customerId: so.customerId,
                plantId: so.plantId,
                materialId: so.materialId,
                uomId: so.uomId,
                orderedQuantity: so.quantity,
                availableQuantity: currentAvailable,
                plannedQuantity: planQty,
                pendingQuantity: pending,
                requiredDate: so.requiredDeliveryDate,
                companyId,
                createdBy: userId,
                status: 'PLANNED',
            },
        });
        await auditService_1.AuditService.log({
            userId,
            companyId,
            plantId: so.plantId,
            entity: 'DeliveryPlan',
            recordId: deliveryPlan.id,
            action: 'CREATE',
            newValues: deliveryPlan,
        });
        res.status(201).json({ success: true, data: deliveryPlan });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================================================
// SALES REPORTS
// ==================================================
// GET /api/v1/sales/reports/summary
router.get('/reports/summary', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['sales:report']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            res.status(400).json({ success: false, error: 'User company missing' });
            return;
        }
        const customerCount = await prisma_1.prisma.customer.count({ where: { companyId } });
        const enquiryCount = await prisma_1.prisma.salesEnquiry.count({ where: { companyId } });
        const quotationCount = await prisma_1.prisma.salesQuotation.count({ where: { companyId } });
        const orderCount = await prisma_1.prisma.salesOrder.count({ where: { companyId } });
        const pendingApprovalCount = await prisma_1.prisma.salesOrder.count({
            where: { companyId, approvalStatus: 'PENDING' },
        });
        const productionRequirementCount = await prisma_1.prisma.productionRequirement.count({ where: { companyId } });
        const deliveryPlanCount = await prisma_1.prisma.deliveryPlan.count({ where: { companyId } });
        const recentOrders = await prisma_1.prisma.salesOrder.findMany({
            where: { companyId },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { customer: true, material: true },
        });
        res.status(200).json({
            success: true,
            data: {
                summary: {
                    customerCount,
                    enquiryCount,
                    quotationCount,
                    orderCount,
                    pendingApprovalCount,
                    productionRequirementCount,
                    deliveryPlanCount,
                },
                recentOrders,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
