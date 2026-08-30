import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AuditService } from '../services/auditService';
import { GlPostingEngine } from '../services/glPostingEngine';

export const gateOutRoutes = Router();

// GET /api/v1/sales/gate-out - List gate out passes
gateOutRoutes.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Company context missing' });

    const passes = await prisma.gateOutPass.findMany({
      where: { companyId },
      include: {
        invoice: true,
        dispatch: true,
        customer: true,
        material: true,
        uom: true,
        approvedUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: passes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/sales/gate-out - Execute Gate Out Pass with Atomic Stock Deduction & COGS Posting
gateOutRoutes.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Auth context missing' });

    const { invoiceId, vehicleNumber, driverName, driverPhone } = req.body;

    if (!invoiceId || !vehicleNumber) {
      return res.status(400).json({ error: 'Invoice ID and Vehicle Number required' });
    }

    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { dispatch: true, material: true },
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Gate Out Gate Rule: Only APPROVED invoices can Gate Out
    if (invoice.approvalStatus !== 'APPROVED') {
      return res.status(400).json({
        error: `Gate Out Blocked: Sales Invoice (${invoice.invoiceNumber}) is not approved (Status: ${invoice.approvalStatus})`,
      });
    }

    // Check duplicate execution
    const existingGateOut = await prisma.gateOutPass.findFirst({
      where: { invoiceId: invoice.id, companyId, status: 'EXECUTED' },
    });

    if (existingGateOut) {
      return res.status(409).json({
        error: `Gate Out Pass already executed for invoice (${existingGateOut.gateOutNumber})`,
        gateOutPass: existingGateOut,
      });
    }

    const gateOutNumber = `GO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const gateOutPass = await prisma.$transaction(async (tx) => {
      // Fetch current QA-accepted Stock Balance
      const stockBalance = await tx.stockBalance.findFirst({
        where: {
          companyId,
          plantId: invoice.plantId,
          materialId: invoice.materialId,
        },
      });

      const currentQty = stockBalance ? stockBalance.quantity : 0;

      // Negative Stock Protection
      if (currentQty < invoice.quantity) {
        throw new Error(
          `Negative Stock Protection: Cannot execute Gate Out. Required QA-Accepted Stock: ${invoice.quantity}, Available: ${currentQty}`
        );
      }

      // Calculate WAC Unit Cost for COGS Valuation
      const unitCost = stockBalance && stockBalance.unitCost > 0 ? stockBalance.unitCost : invoice.material.unitCost || 1000;
      const cogsAmount = Math.round(invoice.quantity * unitCost * 100) / 100;

      // 1. Atomic FG Stock Deduction
      if (stockBalance) {
        await tx.stockBalance.update({
          where: { id: stockBalance.id },
          data: {
            quantity: { decrement: invoice.quantity },
          },
        });
      }

      // 2. Create Stock Transaction Ledger Entry
      await tx.stockTransaction.create({
        data: {
          transactionNumber: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          materialId: invoice.materialId,
          quantity: -invoice.quantity, // Negative for outward dispatch
          uomId: invoice.uomId,
          warehouseId: stockBalance ? stockBalance.warehouseId : (await tx.warehouse.findFirstOrThrow({ where: { plantId: invoice.plantId } })).id,
          transactionType: 'GATE_OUT_DISPATCH',
          userId,
          companyId,
          plantId: invoice.plantId,
          referenceNumber: gateOutNumber,
        },
      });

      // 3. Create Gate Out Pass Record
      const pass = await tx.gateOutPass.create({
        data: {
          gateOutNumber,
          invoiceId: invoice.id,
          dispatchId: invoice.dispatchId,
          customerId: invoice.customerId,
          plantId: invoice.plantId,
          materialId: invoice.materialId,
          uomId: invoice.uomId,
          quantity: invoice.quantity,
          vehicleNumber,
          driverName: driverName || '',
          driverPhone: driverPhone || '',
          status: 'EXECUTED',
          unitCost,
          cogsAmount,
          approvedById: userId,
          companyId,
        },
      });

      // 4. Update Invoice & Dispatch Statuses to COMPLETED
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { status: 'COMPLETED' },
      });

      await tx.dispatchAdvice.update({
        where: { id: invoice.dispatchId },
        data: { status: 'COMPLETED' },
      });

      await tx.transactionReference.create({
        data: {
          sourceEntity: 'SalesInvoice',
          sourceRecordId: invoice.id,
          targetEntity: 'GateOutPass',
          targetRecordId: pass.id,
          referenceType: 'INVOICE_TO_GATE_OUT',
          referenceNumber: gateOutNumber,
          companyId,
          plantId: invoice.plantId,
          createdBy: userId,
        },
      });

      await tx.eventOutbox.create({
        data: {
          eventType: 'GATE_OUT_EXECUTED',
          aggregateType: 'GateOutPass',
          aggregateId: pass.id,
          payloadJson: JSON.stringify({ gateOutNumber, quantity: invoice.quantity, cogsAmount }),
        },
      });

      return pass;
    });

    // GL Double-Entry Posting for COGS: DR Cost of Goods Sold (5000), CR Finished Goods Inventory (1400)
    if (gateOutPass.cogsAmount > 0) {
      await GlPostingEngine.postJournal(prisma, {
        sourceDocumentType: 'GATE_OUT',
        sourceDocumentId: gateOutPass.id,
        postedById: userId,
        companyId,
        plantId: gateOutPass.plantId,
        lines: [
          {
            accountCode: '5000',
            accountName: 'Cost of Goods Sold (COGS)',
            debitAmount: gateOutPass.cogsAmount,
            creditAmount: 0,
            lineDescription: `COGS for Gate Out Pass ${gateOutPass.gateOutNumber}`,
          },
          {
            accountCode: '1400',
            accountName: 'Finished Goods Inventory',
            debitAmount: 0,
            creditAmount: gateOutPass.cogsAmount,
            lineDescription: `Stock Deduction for Gate Out Pass ${gateOutPass.gateOutNumber}`,
          },
        ],
      });
    }

    await AuditService.log({
      userId,
      userEmail: req.user?.email,
      companyId,
      plantId: gateOutPass.plantId,
      entity: 'GateOutPass',
      recordId: gateOutPass.id,
      action: 'EXECUTE',
      newValues: gateOutPass,
    });

    return res.status(201).json({ success: true, data: gateOutPass });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
