import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateJWT, authorizePermissions } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// ==================================================
// SALES ENQUIRY ROUTES
// ==================================================

// GET /api/v1/sales/enquiries
router.get(
  '/enquiries',
  authenticateJWT,
  authorizePermissions(['sales:enquiry']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'User company missing' });
        return;
      }

      const enquiries = await prisma.salesEnquiry.findMany({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/sales/enquiries
router.post(
  '/enquiries',
  authenticateJWT,
  authorizePermissions(['sales:enquiry']),
  async (req: Request, res: Response): Promise<void> => {
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

      const enquiry = await prisma.salesEnquiry.create({
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

      await AuditService.log({
        userId,
        companyId,
        plantId,
        entity: 'SalesEnquiry',
        recordId: enquiry.id,
        action: 'CREATE',
        newValues: enquiry,
      });

      await prisma.transactionReference.create({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/sales/enquiries/:id/status
router.post(
  '/enquiries/:id/status',
  authenticateJWT,
  authorizePermissions(['sales:enquiry']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status, remarks } = req.body;
      const companyId = req.user?.companyId as string;
      const userId = req.user?.userId as string;

      const existing = await prisma.salesEnquiry.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        res.status(404).json({ success: false, error: 'Enquiry not found or access denied' });
        return;
      }

      const updated = await prisma.salesEnquiry.update({
        where: { id },
        data: {
          status,
          remarks: remarks || existing.remarks,
        },
      });

      await AuditService.log({
        userId,
        companyId,
        entity: 'SalesEnquiry',
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

// ==================================================
// QUOTATION ROUTES
// ==================================================

// GET /api/v1/sales/quotations
router.get(
  '/quotations',
  authenticateJWT,
  authorizePermissions(['sales:quotation']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'User company missing' });
        return;
      }

      const quotations = await prisma.salesQuotation.findMany({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/sales/quotations
router.post(
  '/quotations',
  authenticateJWT,
  authorizePermissions(['sales:quotation']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.userId;

      if (!companyId || !userId) {
        res.status(400).json({ success: false, error: 'User context missing' });
        return;
      }

      const {
        customerId,
        enquiryId,
        materialId,
        quantity,
        rate,
        taxReference,
        deliveryTerms,
        paymentTerms,
        validityDate,
        plantId,
      } = req.body;

      if (!customerId || !materialId || !quantity || !rate || !validityDate || !plantId) {
        res.status(400).json({ success: false, error: 'Missing required quotation fields' });
        return;
      }

      const quotationNumber = `QUO-${Date.now()}`;

      const quotation = await prisma.salesQuotation.create({
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
        await prisma.salesEnquiry.update({
          where: { id: enquiryId },
          data: { status: 'CONVERTED' },
        });

        await prisma.transactionReference.create({
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

      await AuditService.log({
        userId,
        companyId,
        plantId,
        entity: 'SalesQuotation',
        recordId: quotation.id,
        action: 'CREATE',
        newValues: quotation,
      });

      res.status(201).json({ success: true, data: quotation });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==================================================
// SALES ORDER ROUTES
// ==================================================

// GET /api/v1/sales/orders
router.get(
  '/orders',
  authenticateJWT,
  authorizePermissions(['sales:order']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'User company missing' });
        return;
      }

      const orders = await prisma.salesOrder.findMany({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/sales/orders
router.post(
  '/orders',
  authenticateJWT,
  authorizePermissions(['sales:order']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.userId;

      if (!companyId || !userId) {
        res.status(400).json({ success: false, error: 'User context missing' });
        return;
      }

      const {
        customerId,
        quotationId,
        materialId,
        quantity,
        uomId,
        rate,
        taxReference,
        requiredDeliveryDate,
        plantId,
        shippingLocation,
        paymentTerms,
      } = req.body;

      if (!customerId || !materialId || !quantity || !uomId || !rate || !requiredDeliveryDate || !plantId) {
        res.status(400).json({ success: false, error: 'Missing required Sales Order fields' });
        return;
      }

      const soNumber = `SO-${Date.now()}`;

      const salesOrder = await prisma.salesOrder.create({
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
        await prisma.transactionReference.create({
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

      await AuditService.log({
        userId,
        companyId,
        plantId,
        entity: 'SalesOrder',
        recordId: salesOrder.id,
        action: 'CREATE',
        newValues: salesOrder,
      });

      res.status(201).json({ success: true, data: salesOrder });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/sales/orders/:id/approve — Maker-Checker Approval
router.post(
  '/orders/:id/approve',
  authenticateJWT,
  authorizePermissions(['sales:approve']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const companyId = req.user?.companyId as string;
      const userId = req.user?.userId as string;
      const userRoles = req.user?.roles || [];

      const so = await prisma.salesOrder.findUnique({ where: { id } });
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

      const approvedSo = await prisma.salesOrder.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvalStatus: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      await AuditService.log({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/sales/orders/:id/check-availability — FG Availability Check (Strictly READ-ONLY stock check)
router.post(
  '/orders/:id/check-availability',
  authenticateJWT,
  authorizePermissions(['sales:availability']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const companyId = req.user?.companyId as string;
      const userId = req.user?.userId as string;

      const so = await prisma.salesOrder.findUnique({
        where: { id },
        include: { material: true, uom: true, customer: true, plant: true },
      });

      if (!so || so.companyId !== companyId) {
        res.status(404).json({ success: false, error: 'Sales Order not found or access denied' });
        return;
      }

      // Check actual FG Stock Balance in DB for this plant & material
      const stockBalances = await prisma.stockBalance.findMany({
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
        reqRecord = await prisma.productionRequirement.create({
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

        await prisma.transactionReference.create({
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

      await AuditService.log({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==================================================
// DELIVERY PLANNING ROUTES
// ==================================================

// GET /api/v1/sales/delivery-plans
router.get(
  '/delivery-plans',
  authenticateJWT,
  authorizePermissions(['sales:delivery']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'User company missing' });
        return;
      }

      const plans = await prisma.deliveryPlan.findMany({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v1/sales/delivery-plans
router.post(
  '/delivery-plans',
  authenticateJWT,
  authorizePermissions(['sales:delivery']),
  async (req: Request, res: Response): Promise<void> => {
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

      const so = await prisma.salesOrder.findUnique({
        where: { id: soId },
        include: { material: true, uom: true, customer: true },
      });

      if (!so || so.companyId !== companyId) {
        res.status(404).json({ success: false, error: 'Sales Order not found or access denied' });
        return;
      }

      // Check current FG stock
      const stockBalances = await prisma.stockBalance.findMany({
        where: { plantId: so.plantId, materialId: so.materialId },
      });
      const currentAvailable = stockBalances.reduce((sum, b) => sum + b.quantity, 0);

      const planQty = parseFloat(plannedQuantity);
      const pending = Math.max(0, so.quantity - planQty);
      const planNumber = `DEL-${Date.now()}`;

      const deliveryPlan = await prisma.deliveryPlan.create({
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

      await AuditService.log({
        userId,
        companyId,
        plantId: so.plantId,
        entity: 'DeliveryPlan',
        recordId: deliveryPlan.id,
        action: 'CREATE',
        newValues: deliveryPlan,
      });

      res.status(201).json({ success: true, data: deliveryPlan });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==================================================
// SALES REPORTS
// ==================================================

// GET /api/v1/sales/reports/summary
router.get(
  '/reports/summary',
  authenticateJWT,
  authorizePermissions(['sales:report']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'User company missing' });
        return;
      }

      const customerCount = await prisma.customer.count({ where: { companyId } });
      const enquiryCount = await prisma.salesEnquiry.count({ where: { companyId } });
      const quotationCount = await prisma.salesQuotation.count({ where: { companyId } });
      const orderCount = await prisma.salesOrder.count({ where: { companyId } });
      const pendingApprovalCount = await prisma.salesOrder.count({
        where: { companyId, approvalStatus: 'PENDING' },
      });
      const productionRequirementCount = await prisma.productionRequirement.count({ where: { companyId } });
      const deliveryPlanCount = await prisma.deliveryPlan.count({ where: { companyId } });

      const recentOrders = await prisma.salesOrder.findMany({
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
