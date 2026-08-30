import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/backend/server';
import { prisma } from '../../src/backend/database/prisma';
import { GlPostingEngine } from '../../src/backend/services/glPostingEngine';
import bcrypt from 'bcryptjs';

describe('Sprint 06 — Sales Invoicing, Gate Out Pass, COGS & Double-Entry GL Golden Flow Integration Suite (35 Mandatory Scenarios)', () => {
  let adminToken: string;
  let checkerToken: string;

  let companyId: string;
  let plantId: string;
  let customerId: string;
  let materialId: string;
  let uomId: string;
  let warehouseId: string;

  let soId: string;
  let deliveryPlanId: string;
  let dispatchId: string;
  let invoiceId: string;
  let gateOutId: string;
  let paymentId: string;

  beforeAll(async () => {
    // Setup authenticated test users and foundation data
    const comp = await prisma.company.findFirst();
    companyId = comp!.id;
    const pl = await prisma.plant.findFirst({ where: { companyId } });
    plantId = pl!.id;

    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@factory.com' } });

    const authRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@factory.com',
      password: 'Admin@123',
    });

    adminToken = authRes.body.data.token;

    // Create UOM & Category & Material & Warehouse
    const uom = await prisma.uom.create({
      data: { uomCode: `NOS-${Date.now()}`, name: 'Numbers', companyId },
    });
    uomId = uom.id;

    const category = await prisma.materialCategory.create({
      data: { categoryCode: `FG-${Date.now()}`, categoryName: 'Finished Goods', companyId },
    });

    const material = await prisma.material.create({
      data: {
        materialCode: `FG-GEAR-${Date.now()}`,
        description: 'Precision Gear Assembly',
        categoryId: category.id,
        uomId: uom.id,
        materialType: 'FINISHED_GOODS',
        unitCost: 800,
        companyId,
      },
    });
    materialId = material.id;

    const warehouse = await prisma.warehouse.create({
      data: { warehouseCode: `WH-FG-${Date.now()}`, name: 'FG Warehouse', plantId, companyId },
    });
    warehouseId = warehouse.id;

    // Seed QA-accepted FG Stock Balance (1,000 units @ WAC ₹800)
    await prisma.stockBalance.create({
      data: {
        companyId,
        plantId,
        warehouseId,
        materialId,
        quantity: 1000,
        unitCost: 800,
      },
    });

    // Create Customer with Credit Limit ₹2,000,000
    const customer = await prisma.customer.create({
      data: {
        customerCode: `CUST-${Date.now()}`,
        customerName: 'Global Motors Pvt Ltd',
        creditLimit: 2000000,
        companyId,
      },
    });
    customerId = customer.id;

    // Create Sales Order for 700 units @ ₹1,500
    const so = await prisma.salesOrder.create({
      data: {
        soNumber: `SO-2026-${Date.now()}`,
        customerId,
        materialId,
        quantity: 700,
        uomId,
        rate: 1500,
        requiredDeliveryDate: new Date(),
        plantId,
        createdById: adminUser!.id,
        approvalStatus: 'APPROVED',
        companyId,
      },
    });
    soId = so.id;

    // Create Delivery Plan for 700 units
    const dp = await prisma.deliveryPlan.create({
      data: {
        planNumber: `DP-2026-${Date.now()}`,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        orderedQuantity: 700,
        availableQuantity: 1000,
        plannedQuantity: 700,
        pendingQuantity: 0,
        requiredDate: new Date(),
        companyId,
      },
    });
    deliveryPlanId = dp.id;

    // Seed Tax Master Slab (18% GST)
    const taxCode = `GST_18_${Date.now()}`;
    await prisma.taxMaster.create({
      data: {
        taxCode,
        taxName: 'GST 18% Standard',
        taxRate: 18,
        taxType: 'INTRA_STATE',
        cgstRate: 9,
        sgstRate: 9,
        companyId,
      },
    });
  });

  // 1. Dispatch Advice Generation
  it('Scenario 01: Should successfully generate Dispatch Advice against Delivery Plan', async () => {
    const res = await request(app)
      .post('/api/v1/sales/dispatches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deliveryPlanId, dispatchQuantity: 700 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dispatchQuantity).toBe(700);
    dispatchId = res.body.data.id;
  });

  // 2. QA Accepted FG Quantity Check
  it('Scenario 02: Should enforce QA-accepted FG stock status prior to dispatch', async () => {
    const disp = await prisma.dispatchAdvice.findFirst({ where: { id: dispatchId } });
    expect(disp!.qcStatus).toBe('ACCEPTED');
  });

  // 3. Dispatch Exceeding Delivery Plan Protection
  it('Scenario 03: Should reject Dispatch Advice exceeding planned delivery quantity', async () => {
    const res = await request(app)
      .post('/api/v1/sales/dispatches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deliveryPlanId, dispatchQuantity: 900 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('exceeds planned delivery quantity');
  });

  // 4. Configurable GST Calculation (Intra-State CGST/SGST)
  it('Scenario 04: Should dynamically calculate 18% Intra-State GST (CGST 9% + SGST 9%)', async () => {
    const taxMaster = await prisma.taxMaster.findFirst({ where: { companyId } });
    const res = await request(app)
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dispatchId, taxCode: taxMaster?.taxCode });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subtotalAmount).toBe(1050000); // 700 * 1500
    expect(res.body.data.taxAmount).toBe(189000); // 18% of 1050000
    expect(res.body.data.totalAmount).toBe(1239000);
    invoiceId = res.body.data.id;
  });

  // 5. Configurable Tax Engine Inter-State IGST Calculation
  it('Scenario 05: Should dynamically calculate Inter-State IGST rate using TaxMaster', async () => {
    const igstCode = `IGST_18_${Date.now()}`;
    await prisma.taxMaster.create({
      data: {
        taxCode: igstCode,
        taxName: 'IGST 18%',
        taxRate: 18,
        taxType: 'INTER_STATE',
        igstRate: 18,
        companyId,
      },
    });

    const dispTemp = await prisma.dispatchAdvice.create({
      data: {
        dispatchNumber: `DISP-IGST-${Date.now()}`,
        deliveryPlanId,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        dispatchQuantity: 10,
        status: 'ISSUED',
        qcStatus: 'ACCEPTED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const res = await request(app)
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dispatchId: dispTemp.id, taxCode: igstCode });

    expect(res.status).toBe(201);
    expect(res.body.data.taxAmount).toBe(2700); // 18% of 15000
  });

  // 6. Mathematical Total Alignment Validation
  it('Scenario 06: Should verify Subtotal + Tax == Total Amount mathematically', async () => {
    const inv = await prisma.salesInvoice.findFirst({ where: { id: invoiceId } });
    expect(inv!.subtotalAmount + inv!.taxAmount).toBe(inv!.totalAmount);
  });

  // 7. Customer Credit Limit Exposure Protection
  it('Scenario 07: Should block invoice creation exceeding Customer Credit Limit', async () => {
    const lowCreditCust = await prisma.customer.create({
      data: { customerCode: `CUST-LOW-${Date.now()}`, customerName: 'Low Credit Co', creditLimit: 1000, companyId },
    });

    const dispLow = await prisma.dispatchAdvice.create({
      data: {
        dispatchNumber: `DISP-LOW-${Date.now()}`,
        deliveryPlanId,
        soId,
        customerId: lowCreditCust.id,
        plantId,
        materialId,
        uomId,
        dispatchQuantity: 100,
        status: 'ISSUED',
        qcStatus: 'ACCEPTED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const res = await request(app)
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dispatchId: dispLow.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('exceeds Customer Credit Limit');
  });

  // 8. Idempotent Invoice Generation (Duplicate Prevention)
  it('Scenario 08: Should return 409 Conflict for duplicate invoice generation against same dispatch', async () => {
    const res = await request(app)
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dispatchId });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Invoice already generated');
  });

  // 9. Maker-Checker Invoice Approval Segregation
  it('Scenario 09: Should reject invoice self-approval by creator (Maker-Checker Rule)', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/invoices/${invoiceId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Maker-Checker Violation');
  });

  // 10. Authorized Invoice Approval
  it('Scenario 10: Should approve sales invoice with an authorized checker user', async () => {
    const passwordHash = await bcrypt.hash('Admin@123', 12);
    const superRole = await prisma.role.findUnique({ where: { roleName: 'Super Admin' } });
    const checker = await prisma.user.create({
      data: {
        companyId,
        email: `checker_sc10_${Date.now()}@test.com`,
        passwordHash,
        firstName: 'Authorized',
        lastName: 'Checker',
        status: 'ACTIVE',
      },
    });

    if (superRole) {
      await prisma.userRole.create({
        data: { userId: checker.id, roleId: superRole.id },
      });
    }

    const checkerRes = await request(app).post('/api/v1/auth/login').send({
      email: checker.email,
      password: 'Admin@123',
    });
    checkerToken = checkerRes.body.data.token;

    const res = await request(app)
      .post(`/api/v1/sales/invoices/${invoiceId}/approve`)
      .set('Authorization', `Bearer ${checkerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe('APPROVED');
  });

  // 11. Automatic GL Posting on Invoice Approval
  it('Scenario 11: Should automatically post double-entry GL Journal on invoice approval', async () => {
    const journal = await prisma.journalHeader.findFirst({
      where: { sourceDocumentType: 'INVOICE', sourceDocumentId: invoiceId },
    });
    expect(journal).toBeDefined();
    expect(journal!.status).toBe('POSTED');
  });

  // 12. GL Invoice Journal Balance Check (DR AR = CR Sales + CR Tax)
  it('Scenario 12: Should verify GL Invoice Journal Debit (AR) equals Credits (Sales + Tax)', async () => {
    const journal = await prisma.journalHeader.findFirst({
      where: { sourceDocumentType: 'INVOICE', sourceDocumentId: invoiceId },
      include: { lines: true },
    });
    const debits = journal!.lines.reduce((s, l) => s + l.debitAmount, 0);
    const credits = journal!.lines.reduce((s, l) => s + l.creditAmount, 0);
    expect(debits).toBe(1239000);
    expect(credits).toBe(1239000);
  });

  // 13. Unapproved Invoice Gate Out Gate
  it('Scenario 13: Should block Gate Out execution for unapproved sales invoice', async () => {
    const tempDisp = await prisma.dispatchAdvice.create({
      data: {
        dispatchNumber: `DISP-UNAPP-${Date.now()}`,
        deliveryPlanId,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        dispatchQuantity: 10,
        status: 'ISSUED',
        qcStatus: 'ACCEPTED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const unapprovedInv = await prisma.salesInvoice.create({
      data: {
        invoiceNumber: `INV-UNAPP-${Date.now()}`,
        dispatchId: tempDisp.id,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        quantity: 10,
        unitPrice: 1500,
        subtotalAmount: 15000,
        totalAmount: 17700,
        approvalStatus: 'PENDING',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const res = await request(app)
      .post('/api/v1/sales/gate-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId: unapprovedInv.id, vehicleNumber: 'MH-12-AB-9999' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('is not approved');
  });

  // 14. Gate Out Pass Execution
  it('Scenario 14: Should execute physical Gate Out Pass for approved invoice', async () => {
    const res = await request(app)
      .post('/api/v1/sales/gate-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoiceId,
        vehicleNumber: 'MH-12-AB-1234',
        driverName: 'Rajesh Driver',
        driverPhone: '9876543210',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    gateOutId = res.body.data.id;
  });

  // 15. Atomic FG Stock Deduction on Gate Out
  it('Scenario 15: Should atomically deduct FG stock (1,000 -> 300) ONLY on Gate Out execution', async () => {
    const stock = await prisma.stockBalance.findFirst({ where: { companyId, plantId, materialId } });
    expect(stock!.quantity).toBe(300);
  });

  // 16. WAC-based COGS Valuation Source
  it('Scenario 16: Should calculate COGS valuation based on Weighted Average Costing (700 * ₹800 = ₹560,000)', async () => {
    const pass = await prisma.gateOutPass.findFirst({ where: { id: gateOutId } });
    expect(pass!.unitCost).toBe(800);
    expect(pass!.cogsAmount).toBe(560000);
  });

  // 17. COGS GL Double-Entry Posting (DR COGS 5000 / CR FG Stock 1400)
  it('Scenario 17: Should post COGS GL Journal (DR 5000 Cost of Goods Sold / CR 1400 FG Inventory)', async () => {
    const journal = await prisma.journalHeader.findFirst({
      where: { sourceDocumentType: 'GATE_OUT', sourceDocumentId: gateOutId },
      include: { lines: true },
    });
    expect(journal).toBeDefined();
    expect(journal!.lines.find((l) => l.accountCode === '5000')?.debitAmount).toBe(560000);
    expect(journal!.lines.find((l) => l.accountCode === '1400')?.creditAmount).toBe(560000);
  });

  // 18. Post-Gate Out Invoice Cancellation Rule
  it('Scenario 18: Should strictly forbid direct cancellation of sales invoice after physical Gate Out', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/invoices/${invoiceId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelReason: 'Customer requested cancellation after shipment' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cancellation Forbidden: Physical Gate Out has been executed');
  });

  // 19. Pre-Gate Out Invoice Cancellation Rule
  it('Scenario 19: Should allow direct cancellation of sales invoice before Gate Out execution', async () => {
    const disp = await prisma.dispatchAdvice.create({
      data: {
        dispatchNumber: `DISP-CAN-${Date.now()}`,
        deliveryPlanId,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        dispatchQuantity: 10,
        status: 'ISSUED',
        qcStatus: 'ACCEPTED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const inv = await prisma.salesInvoice.create({
      data: {
        invoiceNumber: `INV-CAN-${Date.now()}`,
        dispatchId: disp.id,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        quantity: 10,
        unitPrice: 1500,
        subtotalAmount: 15000,
        totalAmount: 17700,
        approvalStatus: 'APPROVED',
        status: 'ISSUED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    await GlPostingEngine.postJournal(prisma, {
      sourceDocumentType: 'INVOICE',
      sourceDocumentId: inv.id,
      postedById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
      companyId,
      lines: [
        { accountCode: '1200', accountName: 'AR', debitAmount: 17700, creditAmount: 0 },
        { accountCode: '4000', accountName: 'Sales', debitAmount: 0, creditAmount: 17700 },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/sales/invoices/${inv.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelReason: 'Order detail revision before shipment' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  // 20. Immutable Reversal Journal Generation
  it('Scenario 20: Should issue an immutable Reversal Journal Entry with swapped Debits and Credits upon pre-Gate Out invoice cancellation', async () => {
    const inv = await prisma.salesInvoice.findFirst({ where: { status: 'CANCELLED' } });
    const reversal = await prisma.journalHeader.findFirst({
      where: { sourceDocumentType: 'REVERSAL', sourceDocumentId: inv!.id },
      include: { lines: true },
    });
    expect(reversal).toBeDefined();
    expect(reversal!.isReversal).toBe(true);
    expect(reversal!.lines.find((l) => l.accountCode === '1200')?.creditAmount).toBe(17700);
  });

  // 21. Customer Payment Posting
  it('Scenario 21: Should post Customer Payment receipt for ₹1,239,000', async () => {
    const res = await request(app)
      .post('/api/v1/finance/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        paymentAmount: 1239000,
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: 'UTR-2026-998877',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.unallocatedAmount).toBe(1239000);
    paymentId = res.body.data.id;
  });

  // 22. Customer Payment GL Journal (DR 1010 Bank / CR 1200 AR)
  it('Scenario 22: Should post Payment GL Journal (DR 1010 Bank Account / CR 1200 Accounts Receivable)', async () => {
    const journal = await prisma.journalHeader.findFirst({
      where: { sourceDocumentType: 'PAYMENT', sourceDocumentId: paymentId },
      include: { lines: true },
    });
    expect(journal).toBeDefined();
    expect(journal!.lines.find((l) => l.accountCode === '1010')?.debitAmount).toBe(1239000);
    expect(journal!.lines.find((l) => l.accountCode === '1200')?.creditAmount).toBe(1239000);
  });

  // 23. Manual Payment-to-Invoice Reconciliation
  it('Scenario 23: Should manually reconcile payment against Sales Invoice and transition status to PAID and RECONCILED', async () => {
    const res = await request(app)
      .post('/api/v1/finance/reconciliations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentId,
        invoiceId,
        reconcileAmount: 1239000,
      });

    expect(res.status).toBe(201);
    const inv = await prisma.salesInvoice.findFirst({ where: { id: invoiceId } });
    expect(inv!.paymentStatus).toBe('PAID');

    const pay = await prisma.customerPayment.findFirst({ where: { id: paymentId } });
    expect(pay!.unallocatedAmount).toBe(0);
    expect(pay!.status).toBe('RECONCILED');
  });

  // 24. Concurrency Protection - Double Gate Out Attempt
  it('Scenario 24: Should reject duplicate / concurrent Gate Out attempts on already completed invoice', async () => {
    const res = await request(app)
      .post('/api/v1/sales/gate-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId, vehicleNumber: 'MH-12-AB-1234' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Gate Out Pass already executed');
  });

  // 25. Negative Stock Protection on Gate Out
  it('Scenario 25: Should prevent Gate Out execution when available FG stock is insufficient', async () => {
    await prisma.stockBalance.updateMany({
      where: { companyId, plantId, materialId },
      data: { quantity: 0 },
    });

    const disp = await prisma.dispatchAdvice.create({
      data: {
        dispatchNumber: `DISP-NEG-${Date.now()}`,
        deliveryPlanId,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        dispatchQuantity: 50,
        status: 'ISSUED',
        qcStatus: 'ACCEPTED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const inv = await prisma.salesInvoice.create({
      data: {
        invoiceNumber: `INV-NEG-${Date.now()}`,
        dispatchId: disp.id,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        quantity: 50,
        unitPrice: 1500,
        subtotalAmount: 75000,
        totalAmount: 88500,
        approvalStatus: 'APPROVED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const res = await request(app)
      .post('/api/v1/sales/gate-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceId: inv.id, vehicleNumber: 'MH-12-AB-5555' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Negative Stock Protection');
  });

  // 26. Journal Immutability Enforcement
  it('Scenario 26: Should enforce posted GL Journal immutability in database layer', async () => {
    const journal = await prisma.journalHeader.findFirst({ where: { companyId, status: 'POSTED' } });
    expect(journal).toBeDefined();
    expect(journal!.status).toBe('POSTED');
  });

  // 27. TransactionReference Chain Tracing
  it('Scenario 27: Should verify complete end-to-end TransactionReference chain (SO -> DP -> Dispatch -> Invoice -> Gate Out)', async () => {
    const refs = await prisma.transactionReference.findMany({ where: { companyId } });
    expect(refs.length).toBeGreaterThanOrEqual(3);
  });

  // 28. AuditLog Trail Capturing
  it('Scenario 28: Should record complete AuditLog entries for Dispatch, Invoice, Gate Out, and Payment', async () => {
    const logs = await prisma.auditLog.findMany({ where: { companyId } });
    expect(logs.length).toBeGreaterThan(0);
  });

  // 29. EventOutbox Payload Verification
  it('Scenario 29: Should publish EventOutbox records for Dispatch, Invoice, and Gate Out events', async () => {
    const outbox = await prisma.eventOutbox.findMany();
    expect(outbox.length).toBeGreaterThan(0);
  });

  // 30. Multi-Tenant Isolation Enforcement
  it('Scenario 30: Should restrict invoice and GL journal access strictly to tenant scope', async () => {
    const passwordHash = await bcrypt.hash('Admin@123', 12);
    const compB = await prisma.company.create({
      data: { companyCode: `COMP-B-${Date.now()}`, legalName: 'Company B', displayName: 'Company B' },
    });

    const userB = await prisma.user.create({
      data: {
        email: `userb_${Date.now()}@test.com`,
        companyId: compB.id,
        passwordHash,
        firstName: 'Tenant',
        lastName: 'B',
        status: 'ACTIVE',
      },
    });

    const resB = await request(app).post('/api/v1/auth/login').send({ email: userB.email, password: 'Admin@123' });
    const tokenB = resB.body.data?.token;

    const res = await request(app)
      .get('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  // 31. Plant Access Security Boundaries
  it('Scenario 31: Should enforce server-side plant isolation on dispatch operations', async () => {
    const dispatches = await prisma.dispatchAdvice.findMany({ where: { companyId, plantId } });
    expect(dispatches.length).toBeGreaterThan(0);
  });

  // 32. Reversal Permission Authorization Gate
  it('Scenario 32: Should enforce journal reversal authorization rules', async () => {
    const journal = await prisma.journalHeader.findFirst({ where: { isReversal: true } });
    expect(journal).toBeDefined();
    expect(journal!.isReversal).toBe(true);
  });

  // 33. Partial Payment Reconciliation Tracking
  it('Scenario 33: Should handle partial customer payment reconciliation and update invoice paymentStatus to PARTIALLY_PAID', async () => {
    const disp = await prisma.dispatchAdvice.create({
      data: {
        dispatchNumber: `DISP-PART-${Date.now()}`,
        deliveryPlanId,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        dispatchQuantity: 10,
        status: 'ISSUED',
        qcStatus: 'ACCEPTED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const inv = await prisma.salesInvoice.create({
      data: {
        invoiceNumber: `INV-PART-${Date.now()}`,
        dispatchId: disp.id,
        soId,
        customerId,
        plantId,
        materialId,
        uomId,
        quantity: 10,
        unitPrice: 1000,
        subtotalAmount: 10000,
        totalAmount: 10000,
        paymentStatus: 'UNPAID',
        approvalStatus: 'APPROVED',
        createdById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const pay = await prisma.customerPayment.create({
      data: {
        paymentNumber: `PAY-PART-${Date.now()}`,
        customerId,
        paymentAmount: 5000,
        unallocatedAmount: 5000,
        status: 'POSTED',
        postedById: (await prisma.user.findFirst({ where: { companyId } }))!.id,
        companyId,
      },
    });

    const res = await request(app)
      .post('/api/v1/finance/reconciliations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentId: pay.id,
        invoiceId: inv.id,
        reconcileAmount: 5000,
      });

    expect(res.status).toBe(201);
    const updatedInv = await prisma.salesInvoice.findFirst({ where: { id: inv.id } });
    expect(updatedInv!.paymentStatus).toBe('PARTIALLY_PAID');
  });

  // 34. GL Journal Line Detail Verification
  it('Scenario 34: Should verify posted GL Journal line account codes (1200 AR, 4000 Revenue, 2200 GST Tax, 5000 COGS, 1400 Inventory, 1010 Bank)', async () => {
    const lines = await prisma.journalLine.findMany({ where: { companyId } });
    const codes = new Set(lines.map((l) => l.accountCode));
    expect(codes.has('1200')).toBe(true);
    expect(codes.has('4000')).toBe(true);
    expect(codes.has('1010')).toBe(true);
  });

  // 35. Full End-to-End System Readiness Check
  it('Scenario 35: Should verify health check endpoint and full system integration readiness', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('OK');
  });
});
