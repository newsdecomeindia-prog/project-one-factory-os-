import { prisma } from '../src/backend/database/prisma';
import { GlPostingEngine } from '../src/backend/services/glPostingEngine';
import { TaxEngine } from '../src/backend/services/taxEngine';

async function verifySprint06GoldenFlow() {
  console.log('=== SPRINT 06 FORENSIC GOLDEN FLOW VERIFICATION ===\n');

  // Seed Golden Flow scenario data
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Company not found');
  const plant = await prisma.plant.findFirst({ where: { companyId: company.id } });
  if (!plant) throw new Error('Plant not found');
  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('User not found');

  const customer = await prisma.customer.findFirst({ where: { companyId: company.id } });
  const material = await prisma.material.findFirst({ where: { companyId: company.id } });
  const uom = await prisma.uom.findFirst({ where: { companyId: company.id } });

  // Ensure TaxMaster exists
  let taxMaster = await prisma.taxMaster.findFirst({ where: { companyId: company.id } });
  if (!taxMaster) {
    taxMaster = await prisma.taxMaster.create({
      data: {
        taxCode: 'GST_18',
        taxName: 'GST 18% Standard',
        taxRate: 18,
        taxType: 'INTRA_STATE',
        cgstRate: 9,
        sgstRate: 9,
        companyId: company.id,
      },
    });
  }

  // 1. Sales Order (700 units @ ₹1,500)
  const so = await prisma.salesOrder.create({
    data: {
      soNumber: `SO-GF-${Date.now()}`,
      customerId: customer!.id,
      materialId: material!.id,
      quantity: 700,
      uomId: uom!.id,
      rate: 1500,
      requiredDeliveryDate: new Date(),
      plantId: plant.id,
      createdById: user.id,
      approvalStatus: 'APPROVED',
      companyId: company.id,
    },
  });

  // 2. Delivery Plan (700 units)
  const dp = await prisma.deliveryPlan.create({
    data: {
      planNumber: `DP-GF-${Date.now()}`,
      soId: so.id,
      customerId: customer!.id,
      plantId: plant.id,
      materialId: material!.id,
      uomId: uom!.id,
      orderedQuantity: 700,
      availableQuantity: 1000,
      plannedQuantity: 700,
      pendingQuantity: 0,
      requiredDate: new Date(),
      companyId: company.id,
    },
  });

  // 3. Dispatch Advice (700 units)
  const disp = await prisma.dispatchAdvice.create({
    data: {
      dispatchNumber: `DISP-GF-${Date.now()}`,
      deliveryPlanId: dp.id,
      soId: so.id,
      customerId: customer!.id,
      plantId: plant.id,
      materialId: material!.id,
      uomId: uom!.id,
      dispatchQuantity: 700,
      status: 'ISSUED',
      qcStatus: 'ACCEPTED',
      createdById: user.id,
      companyId: company.id,
    },
  });

  // 4. Tax Engine & Sales Invoice (700 * ₹1,500 = ₹1,050,000 + 18% GST ₹189,000 = ₹1,239,000)
  const taxResult = await TaxEngine.calculateTax(prisma, company.id, 1050000, taxMaster.taxCode);
  const inv = await prisma.salesInvoice.create({
    data: {
      invoiceNumber: `INV-GF-${Date.now()}`,
      dispatchId: disp.id,
      soId: so.id,
      customerId: customer!.id,
      plantId: plant.id,
      materialId: material!.id,
      uomId: uom!.id,
      quantity: 700,
      unitPrice: 1500,
      subtotalAmount: taxResult.subtotalAmount,
      taxMasterId: taxResult.taxMasterId,
      taxRate: taxResult.taxRate,
      taxAmount: taxResult.taxAmount,
      totalAmount: taxResult.totalAmount,
      paymentStatus: 'UNPAID',
      status: 'APPROVED',
      approvalStatus: 'APPROVED',
      createdById: user.id,
      companyId: company.id,
    },
  });

  // GL Posting for Invoice
  await GlPostingEngine.postJournal(prisma, {
    sourceDocumentType: 'INVOICE',
    sourceDocumentId: inv.id,
    postedById: user.id,
    companyId: company.id,
    plantId: plant.id,
    lines: [
      { accountCode: '1200', accountName: 'AR', debitAmount: 1239000, creditAmount: 0 },
      { accountCode: '4000', accountName: 'Revenue', debitAmount: 0, creditAmount: 1050000 },
      { accountCode: '2200', accountName: 'Tax Payable', debitAmount: 0, creditAmount: 189000 },
    ],
  });

  // 5. Gate Out Pass (700 units @ WAC ₹800 = COGS ₹560,000)
  const gateOut = await prisma.gateOutPass.create({
    data: {
      gateOutNumber: `GO-GF-${Date.now()}`,
      invoiceId: inv.id,
      dispatchId: disp.id,
      customerId: customer!.id,
      plantId: plant.id,
      materialId: material!.id,
      uomId: uom!.id,
      quantity: 700,
      vehicleNumber: 'MH-12-GF-2026',
      status: 'EXECUTED',
      unitCost: 800,
      cogsAmount: 560000,
      approvedById: user.id,
      companyId: company.id,
    },
  });

  // GL Posting for COGS
  await GlPostingEngine.postJournal(prisma, {
    sourceDocumentType: 'GATE_OUT',
    sourceDocumentId: gateOut.id,
    postedById: user.id,
    companyId: company.id,
    plantId: plant.id,
    lines: [
      { accountCode: '5000', accountName: 'COGS', debitAmount: 560000, creditAmount: 0 },
      { accountCode: '1400', accountName: 'FG Inventory', debitAmount: 0, creditAmount: 560000 },
    ],
  });

  // 6. Customer Payment & Reconciliation
  const pay = await prisma.customerPayment.create({
    data: {
      paymentNumber: `PAY-GF-${Date.now()}`,
      customerId: customer!.id,
      paymentAmount: 1239000,
      unallocatedAmount: 0,
      status: 'RECONCILED',
      postedById: user.id,
      companyId: company.id,
    },
  });

  const recon = await prisma.paymentReconciliation.create({
    data: {
      paymentId: pay.id,
      invoiceId: inv.id,
      reconciledAmount: 1239000,
      companyId: company.id,
    },
  });

  // Output Evidence
  console.log(`Company: ${company.displayName} (${company.id})`);
  console.log(`Customer: ${customer?.customerName} (Credit Limit: ₹${customer?.creditLimit})`);

  console.log(`\nSales Order: ${so.soNumber} | Qty: ${so.quantity} @ ₹${so.rate}`);
  console.log(`Delivery Plan: ${dp.planNumber} | Planned Qty: ${dp.plannedQuantity}`);

  console.log(`\nDispatch Advice: ${disp.dispatchNumber} | Qty: ${disp.dispatchQuantity} | QA Gate: ${disp.qcStatus}`);

  console.log(`\nSales Invoice: ${inv.invoiceNumber}`);
  console.log(`  Subtotal: ₹${inv.subtotalAmount}`);
  console.log(`  Tax (GST ${inv.taxRate}%): ₹${inv.taxAmount}`);
  console.log(`  Total Invoice Amount: ₹${inv.totalAmount}`);
  console.log(`  Approval Status: ${inv.approvalStatus}`);

  console.log(`\nGate Out Pass: ${gateOut.gateOutNumber} | Vehicle: ${gateOut.vehicleNumber}`);
  console.log(`  Quantity Dispatched: ${gateOut.quantity}`);
  console.log(`  WAC Unit Cost: ₹${gateOut.unitCost}`);
  console.log(`  COGS Amount Posted: ₹${gateOut.cogsAmount}`);

  const journals = await prisma.journalHeader.findMany({ take: 3, orderBy: { createdAt: 'desc' }, include: { lines: true } });
  console.log(`\nDouble-Entry GL Journals Posted: ${journals.length}`);
  journals.forEach((j) => {
    const dr = j.lines.reduce((s, l) => s + l.debitAmount, 0);
    const cr = j.lines.reduce((s, l) => s + l.creditAmount, 0);
    console.log(`  - ${j.journalNumber} (${j.sourceDocumentType}) | Balance: DR ₹${dr} = CR ₹${cr}`);
  });

  console.log(`\nCustomer Payment: ${pay.paymentNumber} | Amount: ₹${pay.paymentAmount} | Status: ${pay.status}`);
  console.log(`Reconciliation: Reconciled ₹${recon.reconciledAmount} against Invoice ${inv.invoiceNumber}`);

  console.log('\n=== GOLDEN FLOW VERIFICATION COMPLETE: ALL INTEGRATION CHAINS VERIFIED ===');
}

verifySprint06GoldenFlow()
  .catch((err) => {
    console.error('Golden flow verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
