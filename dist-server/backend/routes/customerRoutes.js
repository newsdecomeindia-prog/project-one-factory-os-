"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
// GET /api/v1/customers — List company customers
router.get('/', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['customer:read']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            res.status(400).json({ success: false, error: 'User company is required' });
            return;
        }
        const customers = await prisma_1.prisma.customer.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, data: customers });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/v1/customers/:id — Get customer details
router.get('/:id', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['customer:read']), async (req, res) => {
    try {
        const id = req.params.id;
        const companyId = req.user?.companyId;
        const customer = await prisma_1.prisma.customer.findUnique({
            where: { id },
        });
        if (!customer || customer.companyId !== companyId) {
            res.status(404).json({ success: false, error: 'Customer not found or access denied' });
            return;
        }
        res.status(200).json({ success: true, data: customer });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/v1/customers — Create new Customer
router.post('/', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['customer:create']), async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        if (!companyId || !userId) {
            res.status(400).json({ success: false, error: 'User context missing' });
            return;
        }
        const { customerCode, customerName, address, gstin, contactPerson, email, phone, shippingLocation, paymentTerms, creditLimit, } = req.body;
        if (!customerCode || !customerName) {
            res.status(400).json({ success: false, error: 'customerCode and customerName are required' });
            return;
        }
        const existing = await prisma_1.prisma.customer.findUnique({
            where: { companyId_customerCode: { companyId, customerCode } },
        });
        if (existing) {
            res.status(400).json({ success: false, error: 'Customer code already exists in this company' });
            return;
        }
        const customer = await prisma_1.prisma.customer.create({
            data: {
                customerCode,
                customerName,
                address,
                gstin,
                contactPerson,
                email,
                phone,
                shippingLocation,
                paymentTerms,
                creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
                companyId,
                createdBy: userId,
            },
        });
        // Audit Log
        await auditService_1.AuditService.log({
            userId,
            companyId,
            entity: 'Customer',
            recordId: customer.id,
            action: 'CREATE',
            newValues: customer,
        });
        // Transaction Reference
        await prisma_1.prisma.transactionReference.create({
            data: {
                sourceEntity: 'Customer',
                sourceRecordId: customer.id,
                targetEntity: 'Company',
                targetRecordId: companyId,
                referenceType: 'CUSTOMER_REGISTERED',
                referenceNumber: customer.customerCode,
                companyId,
                createdBy: userId,
            },
        });
        res.status(201).json({ success: true, data: customer });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// PUT /api/v1/customers/:id — Update Customer
router.put('/:id', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['customer:update']), async (req, res) => {
    try {
        const id = req.params.id;
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        const existing = await prisma_1.prisma.customer.findUnique({ where: { id } });
        if (!existing || existing.companyId !== companyId) {
            res.status(404).json({ success: false, error: 'Customer not found or access denied' });
            return;
        }
        const updated = await prisma_1.prisma.customer.update({
            where: { id },
            data: {
                ...req.body,
                companyId, // prevent companyId mutation
            },
        });
        await auditService_1.AuditService.log({
            userId,
            companyId,
            entity: 'Customer',
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
// POST /api/v1/customers/:id/deactivate — Soft Deactivate Customer (NO DESTRUCTIVE DELETE)
router.post('/:id/deactivate', auth_1.authenticateJWT, (0, auth_1.authorizePermissions)(['customer:update']), async (req, res) => {
    try {
        const id = req.params.id;
        const { reason } = req.body;
        const companyId = req.user?.companyId;
        const userId = req.user?.userId;
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            res.status(400).json({ success: false, error: 'Mandatory deactivation reason required' });
            return;
        }
        const existing = await prisma_1.prisma.customer.findUnique({ where: { id } });
        if (!existing || existing.companyId !== companyId) {
            res.status(404).json({ success: false, error: 'Customer not found or access denied' });
            return;
        }
        const deactivated = await prisma_1.prisma.customer.update({
            where: { id },
            data: {
                status: 'INACTIVE',
                deactivationReason: reason,
            },
        });
        await auditService_1.AuditService.log({
            userId,
            companyId,
            entity: 'Customer',
            recordId: id,
            action: 'DEACTIVATE',
            oldValues: existing,
            newValues: deactivated,
            reason,
        });
        res.status(200).json({ success: true, data: deactivated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
