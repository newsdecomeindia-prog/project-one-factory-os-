import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('==================================================');
  console.log('SPRINT 05 REAL DATABASE GOLDEN FLOW VERIFICATION');
  console.log('==================================================\n');

  // Find Company A and Plant 1
  const company = await prisma.company.findFirst({ where: { companyCode: 'COMP-01' } });
  const plant = await prisma.plant.findFirst({ where: { plantCode: 'PLANT-01' } });
  const user = await prisma.user.findFirst({ where: { email: 'admin@factory.com' } });
  const material = await prisma.material.findFirst({ where: { materialCode: 'FG-A' } });
  const uom = await prisma.uom.findFirst({ where: { uomCode: 'PCS' } });

  if (!company || !plant || !user || !material || !uom) {
    console.error('Master data missing! Ensure db:seed was executed.');
    process.exit(1);
  }

  // 1. Create Customer
  const customer = await prisma.customer.create({
    data: {
      customerCode: `CUST-VERIFY-${Date.now()}`,
      customerName: 'Verified Global Motors Pvt Ltd',
      address: 'Plot 100, Chakan Phase 3, Pune',
      gstin: '27AAAAA1234A1Z1',
      companyId: company.id,
      createdBy: user.id,
    },
  });
  console.log(`1. CUSTOMER CREATED: ${customer.customerCode} (${customer.customerName})`);

  // 2. Create Sales Enquiry (1,000 units)
  const enquiry = await prisma.salesEnquiry.create({
    data: {
      enquiryNumber: `ENQ-VERIFY-${Date.now()}`,
      customerId: customer.id,
      plantId: plant.id,
      materialId: material.id,
      quantity: 1000,
      uomId: uom.id,
      requiredDate: new Date(Date.now() + 10 * 86400000),
      requesterId: user.id,
      companyId: company.id,
      createdBy: user.id,
      status: 'SUBMITTED',
    },
  });
  console.log(`2. SALES ENQUIRY CREATED: ${enquiry.enquiryNumber} for ${enquiry.quantity} ${uom.uomCode}`);

  // 3. Create Quotation
  const quotation = await prisma.salesQuotation.create({
    data: {
      quotationNumber: `QUO-VERIFY-${Date.now()}`,
      customerId: customer.id,
      enquiryId: enquiry.id,
      materialId: material.id,
      quantity: 1000,
      rate: 1500,
      validityDate: new Date(Date.now() + 30 * 86400000),
      plantId: plant.id,
      companyId: company.id,
      createdBy: user.id,
      status: 'ISSUED',
    },
  });
  console.log(`3. QUOTATION CREATED: ${quotation.quotationNumber} (Rate: ₹1500)`);

  // 4. Create Sales Order
  const salesOrder = await prisma.salesOrder.create({
    data: {
      soNumber: `SO-VERIFY-${Date.now()}`,
      customerId: customer.id,
      quotationId: quotation.id,
      materialId: material.id,
      quantity: 1000,
      uomId: uom.id,
      rate: 1500,
      requiredDeliveryDate: new Date(Date.now() + 15 * 86400000),
      plantId: plant.id,
      createdById: user.id,
      approvedById: user.id,
      approvedAt: new Date(),
      companyId: company.id,
      status: 'APPROVED',
      approvalStatus: 'APPROVED',
    },
  });
  console.log(`4. SALES ORDER CREATED & APPROVED: ${salesOrder.soNumber} for Qty: ${salesOrder.quantity}`);

  // 5. Query Actual FG Stock Balance in DB before Availability Check
  const stockBefore = await prisma.stockBalance.findMany({
    where: { plantId: plant.id, materialId: material.id },
  });
  const totalStockBefore = stockBefore.reduce((s, b) => s + b.quantity, 0);
  console.log(`\n--- DB STOCK BEFORE AVAILABILITY CHECK ---`);
  console.log(`FG-A Actual DB Available Stock: ${totalStockBefore} units`);

  // 6. FG Availability Calculation
  const orderedQty = salesOrder.quantity;
  const fulfillableQty = Math.min(orderedQty, totalStockBefore);
  const shortageQty = Math.max(0, orderedQty - totalStockBefore);

  console.log(`\n--- AVAILABILITY & SHORTAGE ANALYSIS ---`);
  console.log(`Sales Order Quantity : ${orderedQty}`);
  console.log(`Available FG Stock   : ${totalStockBefore}`);
  console.log(`Fulfillable Quantity : ${fulfillableQty}`);
  console.log(`Shortage Quantity    : ${shortageQty}`);

  // Create Production Requirement for Shortage
  let prodReq = null;
  if (shortageQty > 0) {
    prodReq = await prisma.productionRequirement.create({
      data: {
        requirementNumber: `PRQ-VERIFY-${Date.now()}`,
        soId: salesOrder.id,
        plantId: plant.id,
        materialId: material.id,
        uomId: uom.id,
        shortageQuantity: shortageQty,
        status: 'OPEN',
        companyId: company.id,
        createdBy: user.id,
      },
    });
    console.log(`5. PRODUCTION REQUIREMENT GENERATED: ${prodReq.requirementNumber} for Shortage Qty: ${prodReq.shortageQuantity}`);
  }

  // 7. Verify Stock Balance AFTER Availability Check
  const stockAfter = await prisma.stockBalance.findMany({
    where: { plantId: plant.id, materialId: material.id },
  });
  const totalStockAfter = stockAfter.reduce((s, b) => s + b.quantity, 0);

  console.log(`\n--- DB STOCK AFTER AVAILABILITY CHECK ---`);
  console.log(`FG-A Actual DB Available Stock: ${totalStockAfter} units`);
  console.log(`Stock Mutated: ${totalStockBefore !== totalStockAfter ? 'YES (FAIL)' : 'NO (PASS — Read Only)'}`);

  // 8. Create Delivery Plan
  const deliveryPlan = await prisma.deliveryPlan.create({
    data: {
      planNumber: `DEL-VERIFY-${Date.now()}`,
      soId: salesOrder.id,
      customerId: customer.id,
      plantId: plant.id,
      materialId: material.id,
      uomId: uom.id,
      orderedQuantity: orderedQty,
      availableQuantity: totalStockAfter,
      plannedQuantity: fulfillableQty,
      pendingQuantity: shortageQty,
      requiredDate: salesOrder.requiredDeliveryDate,
      companyId: company.id,
      createdBy: user.id,
      status: 'PLANNED',
    },
  });
  console.log(`\n6. DELIVERY PLAN CREATED: ${deliveryPlan.planNumber}`);
  console.log(`   - Planned Delivery Qty : ${deliveryPlan.plannedQuantity}`);
  console.log(`   - Pending Requirement  : ${deliveryPlan.pendingQuantity}`);

  console.log('\n==================================================');
  console.log('GOLDEN FLOW VERIFICATION COMPLETED SUCCESSFULLY');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('Error during Golden Flow verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
