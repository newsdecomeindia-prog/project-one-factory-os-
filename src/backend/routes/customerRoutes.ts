import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateJWT, authorizePermissions } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/customers — List company customers
router.get(
  '/',
  authenticateJWT,
  authorizePermissions(['customer:read']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'User company is required' });
        return;
      }

      const customers = await prisma.customer.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ success: true, data: customers });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// GET /api/v1/customers/:id — Get customer details
router.get(
  '/:id',
  authenticateJWT,
  authorizePermissions(['customer:read']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const companyId = req.user?.companyId;

      const customer = await prisma.customer.findUnique({
        where: { id },
      });

      if (!customer || customer.companyId !== companyId) {
        res.status(404).json({ success: false, error: 'Customer not found or access denied' });
        return;
      }

      res.status(200).json({ success: true, data: customer });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/customers — Create new Customer
router.post(
  '/',
  authenticateJWT,
  authorizePermissions(['customer:create']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.userId;

      if (!companyId || !userId) {
        res.status(400).json({ success: false, error: 'User context missing' });
        return;
      }

      const {
        customerCode,
        customerName,
        address,
        gstin,
        contactPerson,
        email,
        phone,
        shippingLocation,
        paymentTerms,
        creditLimit,
      } = req.body;

      if (!customerCode || !customerName) {
        res.status(400).json({ success: false, error: 'customerCode and customerName are required' });
        return;
      }

      const existing = await prisma.customer.findUnique({
        where: { companyId_customerCode: { companyId, customerCode } },
      });

      if (existing) {
        res.status(400).json({ success: false, error: 'Customer code already exists in this company' });
        return;
      }

      const customer = await prisma.customer.create({
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
      await AuditService.log({
        userId,
        companyId,
        entity: 'Customer',
        recordId: customer.id,
        action: 'CREATE',
        newValues: customer,
      });

      // Transaction Reference
      await prisma.transactionReference.create({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/v1/customers/:id — Update Customer
router.put(
  '/:id',
  authenticateJWT,
  authorizePermissions(['customer:update']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const companyId = req.user?.companyId as string;
      const userId = req.user?.userId as string;

      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        res.status(404).json({ success: false, error: 'Customer not found or access denied' });
        return;
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          ...req.body,
          companyId, // prevent companyId mutation
        },
      });

      await AuditService.log({
        userId,
        companyId,
        entity: 'Customer',
        recordId: id,
        action: 'UPDATE',
        oldValues: existing,
        newValues: updated,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/customers/:id/deactivate — Soft Deactivate Customer (NO DESTRUCTIVE DELETE)
router.post(
  '/:id/deactivate',
  authenticateJWT,
  authorizePermissions(['customer:update']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const companyId = req.user?.companyId as string;
      const userId = req.user?.userId as string;

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Mandatory deactivation reason required' });
        return;
      }

      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        res.status(404).json({ success: false, error: 'Customer not found or access denied' });
        return;
      }

      const deactivated = await prisma.customer.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          deactivationReason: reason,
        },
      });

      await AuditService.log({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
