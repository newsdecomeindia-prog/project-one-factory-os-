import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AuditService } from '../services/auditService';
import { TaxEngine } from '../services/taxEngine';
import { GlPostingEngine } from '../services/glPostingEngine';

export const invoiceRoutes = Router();

// GET /api/v1/sales/invoices - List sales invoices
invoiceRoutes.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Company context missing' });

    const invoices = await prisma.salesInvoice.findMany({
      where: { companyId },
      include: {
        dispatch: true,
        salesOrder: true,
        customer: true,
        material: true,
        uom: true,
        taxMaster: true,
        createdUser: { select: { id: true, firstName: true, lastName: true } },
        approvedUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: invoices });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/sales/invoices - Create Sales Invoice from Dispatch Advice
invoiceRoutes.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Auth context missing' });

    const { dispatchId, taxCode } = req.body;

    if (!dispatchId) {
      return res.status(400).json({ error: 'Dispatch ID required' });
    }

    const dispatch = await prisma.dispatchAdvice.findFirst({
      where: { id: String(dispatchId), companyId },
      include: { salesOrder: true, deliveryPlan: true },
    });

    if (!dispatch) {
      return res.status(404).json({ error: 'Dispatch advice not found' });
    }

    // Idempotency / Duplicate Check
    const existingInvoice = await prisma.salesInvoice.findFirst({
      where: { dispatchId: String(dispatchId), companyId, status: { not: 'CANCELLED' } },
    });

    if (existingInvoice) {
      return res.status(409).json({
        error: `Invoice already generated for dispatch advice (${existingInvoice.invoiceNumber})`,
        invoice: existingInvoice,
      });
    }

    const quantity = dispatch.dispatchQuantity;
    const unitPrice = dispatch.salesOrder.rate;
    const subtotalAmount = quantity * unitPrice;

    // Configurable Tax Calculation
    const taxResult = await TaxEngine.calculateTax(prisma, companyId, subtotalAmount, taxCode || dispatch.salesOrder.taxReference || undefined);

    // Customer Credit Limit Check
    const customer = await prisma.customer.findFirst({
      where: { id: dispatch.customerId, companyId },
    });

    if (customer && customer.creditLimit > 0) {
      const pendingInvoices = await prisma.salesInvoice.aggregate({
        where: { customerId: customer.id, companyId, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        _sum: { totalAmount: true },
      });
      const outstanding = pendingInvoices._sum.totalAmount || 0;
      if (outstanding + taxResult.totalAmount > customer.creditLimit) {
        return res.status(400).json({
          error: `Invoice creation blocked: Total exposure (${outstanding + taxResult.totalAmount}) exceeds Customer Credit Limit (${customer.creditLimit})`,
        });
      }
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.salesInvoice.create({
        data: {
          invoiceNumber,
          dispatchId: dispatch.id,
          soId: dispatch.soId,
          customerId: dispatch.customerId,
          plantId: dispatch.plantId,
          materialId: dispatch.materialId,
          uomId: dispatch.uomId,
          quantity,
          unitPrice,
          subtotalAmount: taxResult.subtotalAmount,
          taxMasterId: taxResult.taxMasterId,
          taxRate: taxResult.taxRate,
          taxAmount: taxResult.taxAmount,
          totalAmount: taxResult.totalAmount,
          paymentStatus: 'UNPAID',
          status: 'ISSUED',
          approvalStatus: 'PENDING',
          createdById: userId,
          companyId,
        },
      });

      await tx.dispatchAdvice.update({
        where: { id: dispatch.id },
        data: { status: 'INVOICED' },
      });

      await tx.transactionReference.create({
        data: {
          sourceEntity: 'DispatchAdvice',
          sourceRecordId: dispatch.id,
          targetEntity: 'SalesInvoice',
          targetRecordId: inv.id,
          referenceType: 'DISPATCH_TO_INVOICE',
          referenceNumber: invoiceNumber,
          companyId,
          plantId: dispatch.plantId,
          createdBy: userId,
        },
      });

      await tx.eventOutbox.create({
        data: {
          eventType: 'SALES_INVOICE_CREATED',
          aggregateType: 'SalesInvoice',
          aggregateId: inv.id,
          payloadJson: JSON.stringify({ invoiceNumber, totalAmount: taxResult.totalAmount }),
        },
      });

      return inv;
    });

    await AuditService.log({
      userId,
      userEmail: req.user?.email,
      companyId,
      plantId: dispatch.plantId,
      entity: 'SalesInvoice',
      recordId: invoice.id,
      action: 'CREATE',
      newValues: invoice,
    });

    return res.status(201).json({ success: true, data: invoice });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/sales/invoices/:id/approve - Maker-Checker Invoice Approval & GL Posting
invoiceRoutes.post('/:id/approve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Auth context missing' });

    const invoiceId = String(req.params.id);
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Maker-Checker Segregation Rule: Creator cannot self-approve
    if (invoice.createdById === userId) {
      return res.status(403).json({ error: 'Maker-Checker Violation: Invoice creator cannot approve their own invoice.' });
    }

    if (invoice.approvalStatus === 'APPROVED') {
      return res.status(400).json({ error: 'Invoice is already approved' });
    }

    const approvedInvoice = await prisma.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        status: 'APPROVED',
      },
    });

    // GL Double-Entry Posting: DR Accounts Receivable, CR Sales Revenue, CR Tax Payable
    const lines = [
      {
        accountCode: '1200',
        accountName: 'Accounts Receivable',
        debitAmount: approvedInvoice.totalAmount,
        creditAmount: 0,
        lineDescription: `AR for Invoice ${approvedInvoice.invoiceNumber}`,
      },
      {
        accountCode: '4000',
        accountName: 'Sales Revenue',
        debitAmount: 0,
        creditAmount: approvedInvoice.subtotalAmount,
        lineDescription: `Revenue for Invoice ${approvedInvoice.invoiceNumber}`,
      },
    ];

    if (approvedInvoice.taxAmount > 0) {
      lines.push({
        accountCode: '2200',
        accountName: 'GST Output Tax Payable',
        debitAmount: 0,
        creditAmount: approvedInvoice.taxAmount,
        lineDescription: `Tax Payable for Invoice ${approvedInvoice.invoiceNumber}`,
      });
    }

    await GlPostingEngine.postJournal(prisma, {
      sourceDocumentType: 'INVOICE',
      sourceDocumentId: approvedInvoice.id,
      postedById: userId,
      companyId,
      plantId: approvedInvoice.plantId,
      lines,
    });

    await AuditService.log({
      userId,
      userEmail: req.user?.email,
      companyId,
      plantId: approvedInvoice.plantId,
      entity: 'SalesInvoice',
      recordId: approvedInvoice.id,
      action: 'UPDATE',
      newValues: approvedInvoice,
    });

    return res.json({ success: true, data: approvedInvoice });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/sales/invoices/:id/cancel - Pre-Gate Out Invoice Cancellation & Reversal
invoiceRoutes.post('/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Auth context missing' });

    const { cancelReason } = req.body;
    if (!cancelReason) return res.status(400).json({ error: 'Mandatory cancel reason required' });

    const invoiceId = String(req.params.id);
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { gateOutPasses: true },
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Pre-Gate Out Rule: Cannot cancel invoice if Gate Out has been executed
    const executedGateOut = invoice.gateOutPasses.find((g: any) => g.status === 'EXECUTED');
    if (executedGateOut) {
      return res.status(400).json({
        error: 'Cancellation Forbidden: Physical Gate Out has been executed. Adjustments must use Credit Notes.',
      });
    }

    const cancelledInvoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CANCELLED',
          cancelReason: String(cancelReason),
        },
      });

      await tx.dispatchAdvice.update({
        where: { id: invoice.dispatchId },
        data: { status: 'ISSUED' },
      });

      // Find GL Journal and Reverse it
      const journal = await tx.journalHeader.findFirst({
        where: { sourceDocumentType: 'INVOICE', sourceDocumentId: invoice.id, status: 'POSTED' },
      });

      if (journal) {
        await GlPostingEngine.reverseJournal(tx, journal.id, userId, companyId, String(cancelReason));
      }

      return inv;
    });

    await AuditService.log({
      userId,
      userEmail: req.user?.email,
      companyId,
      plantId: invoice.plantId,
      entity: 'SalesInvoice',
      recordId: invoice.id,
      action: 'CANCEL',
      reason: String(cancelReason),
    });

    return res.json({ success: true, data: cancelledInvoice });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
