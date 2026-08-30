import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AuditService } from '../services/auditService';
import { GlPostingEngine } from '../services/glPostingEngine';

export const financeRoutes = Router();

// --- TAX MASTER ENDPOINTS ---

// GET /api/v1/finance/tax-masters - List tax masters
financeRoutes.get('/tax-masters', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Company context missing' });

    const taxes = await prisma.taxMaster.findMany({
      where: { companyId },
      orderBy: { taxCode: 'asc' },
    });

    return res.json({ success: true, data: taxes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/finance/tax-masters - Create Tax Master slab rule
financeRoutes.post('/tax-masters', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId) return res.status(401).json({ error: 'Company context missing' });

    const { taxCode, taxName, taxRate, taxType, description } = req.body;

    if (!taxCode || !taxName || taxRate === undefined) {
      return res.status(400).json({ error: 'Tax code, name, and rate required' });
    }

    const rateNum = Number(taxRate);
    const typeStr = taxType === 'INTER_STATE' ? 'INTER_STATE' : 'INTRA_STATE';

    const cgstRate = typeStr === 'INTRA_STATE' ? rateNum / 2 : 0;
    const sgstRate = typeStr === 'INTRA_STATE' ? rateNum / 2 : 0;
    const igstRate = typeStr === 'INTER_STATE' ? rateNum : 0;

    const taxMaster = await prisma.taxMaster.create({
      data: {
        taxCode,
        taxName,
        taxRate: rateNum,
        taxType: typeStr,
        cgstRate,
        sgstRate,
        igstRate,
        description: description || '',
        companyId,
        createdBy: userId,
      },
    });

    return res.status(201).json({ success: true, data: taxMaster });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- GENERAL LEDGER ENDPOINTS ---

// GET /api/v1/finance/journals - List posted GL Journals
financeRoutes.get('/journals', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Company context missing' });

    const journals = await prisma.journalHeader.findMany({
      where: { companyId },
      include: {
        lines: true,
        postedUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: journals });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- CUSTOMER PAYMENTS & RECONCILIATION ENDPOINTS ---

// GET /api/v1/finance/payments - List customer payments
financeRoutes.get('/payments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Company context missing' });

    const payments = await prisma.customerPayment.findMany({
      where: { companyId },
      include: {
        customer: true,
        postedUser: { select: { id: true, firstName: true, lastName: true } },
        paymentReconciliation: { include: { invoice: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: payments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/finance/payments - Post Customer Payment Receipt & GL Journal
financeRoutes.post('/payments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Auth context missing' });

    const { customerId, paymentAmount, paymentMethod, paymentReference, plantId } = req.body;

    if (!customerId || !paymentAmount || Number(paymentAmount) <= 0) {
      return res.status(400).json({ error: 'Customer ID and positive payment amount required' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const amountNum = Number(paymentAmount);
    const paymentNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const payment = await prisma.customerPayment.create({
      data: {
        paymentNumber,
        customerId,
        paymentAmount: amountNum,
        unallocatedAmount: amountNum,
        paymentMethod: paymentMethod || 'BANK_TRANSFER',
        paymentReference: paymentReference || '',
        status: 'POSTED',
        postedById: userId,
        companyId,
        plantId: plantId || null,
      },
    });

    // GL Double-Entry Posting: DR Bank Account (1010), CR Accounts Receivable (1200)
    await GlPostingEngine.postJournal(prisma, {
      sourceDocumentType: 'PAYMENT',
      sourceDocumentId: payment.id,
      postedById: userId,
      companyId,
      plantId: payment.plantId || undefined,
      lines: [
        {
          accountCode: '1010',
          accountName: 'Bank Account / Cash',
          debitAmount: amountNum,
          creditAmount: 0,
          lineDescription: `Payment Received from Customer ${customer.customerName} (${paymentNumber})`,
        },
        {
          accountCode: '1200',
          accountName: 'Accounts Receivable',
          debitAmount: 0,
          creditAmount: amountNum,
          lineDescription: `AR Credit for Payment ${paymentNumber}`,
        },
      ],
    });

    await AuditService.log({
      userId,
      userEmail: req.user?.email,
      companyId,
      entity: 'CustomerPayment',
      recordId: payment.id,
      action: 'CREATE',
      newValues: payment,
    });

    return res.status(201).json({ success: true, data: payment });
  } catch (error: any) {
    console.error('PAYMENT POST ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/finance/reconciliations - Manual Payment-to-Invoice Reconciliation
financeRoutes.post('/reconciliations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Auth context missing' });

    const { paymentId, invoiceId, reconcileAmount } = req.body;

    if (!paymentId || !invoiceId || !reconcileAmount || Number(reconcileAmount) <= 0) {
      return res.status(400).json({ error: 'Payment ID, Invoice ID, and positive reconcile amount required' });
    }

    const recAmount = Number(reconcileAmount);

    const payment = await prisma.customerPayment.findFirst({
      where: { id: paymentId, companyId },
    });

    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { paymentReconciliation: true },
    });

    if (!payment) return res.status(404).json({ error: 'Customer Payment record not found' });
    if (!invoice) return res.status(404).json({ error: 'Sales Invoice record not found' });

    if (payment.unallocatedAmount < recAmount) {
      return res.status(400).json({
        error: `Reconciliation Amount (${recAmount}) exceeds payment unallocated balance (${payment.unallocatedAmount})`,
      });
    }

    const totalReconciledSoFar = invoice.paymentReconciliation.reduce((sum, r) => sum + r.reconciledAmount, 0);
    const outstanding = invoice.totalAmount - totalReconciledSoFar;

    if (recAmount > outstanding) {
      return res.status(400).json({
        error: `Reconciliation Amount (${recAmount}) exceeds invoice outstanding balance (${outstanding})`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const recon = await tx.paymentReconciliation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          reconciledAmount: recAmount,
          companyId,
        },
      });

      const newUnallocated = payment.unallocatedAmount - recAmount;
      const paymentStatus = newUnallocated === 0 ? 'RECONCILED' : 'POSTED';

      await tx.customerPayment.update({
        where: { id: payment.id },
        data: {
          unallocatedAmount: newUnallocated,
          status: paymentStatus,
        },
      });

      const newTotalReconciled = totalReconciledSoFar + recAmount;
      let newInvoicePaymentStatus = 'PARTIALLY_PAID';
      if (newTotalReconciled >= invoice.totalAmount) {
        newInvoicePaymentStatus = 'PAID';
      }

      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          paymentStatus: newInvoicePaymentStatus,
        },
      });

      return recon;
    });

    await AuditService.log({
      userId,
      userEmail: req.user?.email,
      companyId,
      entity: 'PaymentReconciliation',
      recordId: result.id,
      action: 'CREATE',
      newValues: result,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
