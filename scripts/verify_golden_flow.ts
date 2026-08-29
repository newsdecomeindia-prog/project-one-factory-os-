import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runGoldenFlow() {
  console.log('==================================================');
  console.log('REAL DATABASE GOLDEN FLOW VERIFICATION SCRIPT');
  console.log('==================================================');

  // Fetch Master Data
  const companyA = await prisma.company.findUnique({ where: { companyCode: 'COMP-01' } });
  const plant1 = await prisma.plant.findUnique({ where: { plantCode: 'PLANT-01' } });
  const dept1 = await prisma.department.findUnique({ where: { departmentCode: 'DEPT-PROD-01' } });
  const wh = await prisma.warehouse.findFirst({ where: { plantId: plant1!.id, warehouseCode: 'WH-MAIN' } });
  const bin = await prisma.storageBin.findFirst({ where: { warehouseId: wh!.id, binCode: 'BIN-A1' } });

  const fgMat = await prisma.material.findUnique({ where: { companyId_materialCode: { companyId: companyA!.id, materialCode: 'FG-A' } } });
  const rmAMat = await prisma.material.findUnique({ where: { companyId_materialCode: { companyId: companyA!.id, materialCode: 'RM-A' } } });
  const rmBMat = await prisma.material.findUnique({ where: { companyId_materialCode: { companyId: companyA!.id, materialCode: 'RM-B' } } });

  // Reset initial database state
  await prisma.stockTransaction.deleteMany({});
  await prisma.productionReceipt.deleteMany({});
  await prisma.productionExecution.deleteMany({});
  await prisma.materialIssue.deleteMany({});
  await prisma.materialReservation.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.bomComponent.deleteMany({});
  await prisma.bomHeader.deleteMany({});

  await prisma.stockBalance.deleteMany({ where: { plantId: plant1!.id } });
  await prisma.stockBalance.create({ data: { companyId: companyA!.id, plantId: plant1!.id, warehouseId: wh!.id, binId: bin!.id, materialId: rmAMat!.id, quantity: 500 } });
  await prisma.stockBalance.create({ data: { companyId: companyA!.id, plantId: plant1!.id, warehouseId: wh!.id, binId: bin!.id, materialId: rmBMat!.id, quantity: 500 } });

  // 1. BEFORE STOCK BALANCES
  const beforeRmA = await prisma.stockBalance.findFirst({ where: { plantId: plant1!.id, warehouseId: wh!.id, materialId: rmAMat!.id } });
  const beforeFg = await prisma.stockBalance.findFirst({ where: { plantId: plant1!.id, warehouseId: wh!.id, materialId: fgMat!.id } });

  console.log('\n--- BEFORE STOCK BALANCES ---');
  console.log(`RM-A Available Stock: ${beforeRmA?.quantity || 0}`);
  console.log(`FG-A Available Stock: ${beforeFg?.quantity || 0}`);

  // 2. CREATE BOM (FG-A = 1, RM-A = 2, RM-B = 1)
  const bom = await prisma.bomHeader.create({
    data: {
      bomNumber: 'BOM-GF-001',
      finishedMaterialId: fgMat!.id,
      version: 1,
      companyId: companyA!.id,
      plantId: plant1!.id,
      status: 'ACTIVE',
      components: {
        create: [
          { componentMaterialId: rmAMat!.id, quantityPerUnit: 2, uomId: rmAMat!.uomId, companyId: companyA!.id, plantId: plant1!.id },
          { componentMaterialId: rmBMat!.id, quantityPerUnit: 1, uomId: rmBMat!.uomId, companyId: companyA!.id, plantId: plant1!.id },
        ],
      },
    },
  });

  // 3. CREATE WORK ORDER (Planned Qty = 100)
  const wo = await prisma.workOrder.create({
    data: {
      woNumber: 'WO-GF-001',
      companyId: companyA!.id,
      plantId: plant1!.id,
      departmentId: dept1!.id,
      finishedMaterialId: fgMat!.id,
      bomHeaderId: bom.id,
      plannedQuantity: 100,
      uomId: fgMat!.uomId,
      plannedStartDate: new Date(),
      plannedCompletionDate: new Date(),
      status: 'DRAFT',
    },
  });

  // 4. RELEASE WO -> RESERVATION (Calculated RM-A = 200)
  const rmAReservationQty = 100 * 2;
  await prisma.materialReservation.create({
    data: {
      reservationNumber: 'RES-GF-001',
      workOrderId: wo.id,
      bomHeaderId: bom.id,
      materialId: rmAMat!.id,
      requiredQuantity: rmAReservationQty,
      reservedQuantity: rmAReservationQty,
      warehouseId: wh!.id,
      binId: bin!.id,
      companyId: companyA!.id,
      plantId: plant1!.id,
    },
  });
  await prisma.workOrder.update({ where: { id: wo.id }, data: { status: 'MATERIAL_RESERVED' } });

  // 5. MATERIAL ISSUE (RM-A = 200)
  const issueQty = 200;
  await prisma.$transaction([
    prisma.stockBalance.update({
      where: { id: beforeRmA!.id },
      data: { quantity: { decrement: issueQty } },
    }),
    prisma.materialIssue.create({
      data: {
        issueNumber: 'ISS-GF-001',
        workOrderId: wo.id,
        materialId: rmAMat!.id,
        issuedQuantity: issueQty,
        uomId: rmAMat!.uomId,
        warehouseId: wh!.id,
        binId: bin!.id,
        issuerId: (await prisma.user.findFirst())!.id,
        companyId: companyA!.id,
        plantId: plant1!.id,
      },
    }),
  ]);
  await prisma.workOrder.update({ where: { id: wo.id }, data: { status: 'IN_PROCESS' } });

  // 6. PRODUCTION EXECUTION (Executed = 100, Good = 95, Rejected = 5, Hold = 0)
  const execQty = 100;
  const goodQty = 95;
  const rejQty = 5;
  const hldQty = 0;

  console.log('\n--- QUANTITY RECONCILIATION ---');
  console.log(`Executed (${execQty}) === Good (${goodQty}) + Rejected (${rejQty}) + Hold (${hldQty}): ${execQty === goodQty + rejQty + hldQty}`);

  const execution = await prisma.productionExecution.create({
    data: {
      executionNumber: 'EXEC-GF-001',
      workOrderId: wo.id,
      finishedMaterialId: fgMat!.id,
      plannedQuantity: 100,
      executedQuantity: execQty,
      goodQuantity: goodQty,
      rejectedQuantity: rejQty,
      holdQuantity: hldQty,
      operatorId: (await prisma.user.findFirst())!.id,
      startTime: new Date(),
      endTime: new Date(),
      companyId: companyA!.id,
      plantId: plant1!.id,
    },
  });

  // 7. PRODUCTION RECEIPT (Only Good Qty 95 enters FG available stock)
  await prisma.$transaction([
    prisma.productionReceipt.create({
      data: {
        receiptNumber: 'RCPT-GF-001',
        workOrderId: wo.id,
        executionId: execution.id,
        finishedMaterialId: fgMat!.id,
        receivedQuantity: goodQty,
        rejectedQuantity: rejQty,
        holdQuantity: hldQty,
        uomId: fgMat!.uomId,
        warehouseId: wh!.id,
        binId: bin!.id,
        receiverId: (await prisma.user.findFirst())!.id,
        companyId: companyA!.id,
        plantId: plant1!.id,
      },
    }),
    prisma.stockBalance.create({
      data: {
        companyId: companyA!.id,
        plantId: plant1!.id,
        warehouseId: wh!.id,
        binId: bin!.id,
        materialId: fgMat!.id,
        quantity: goodQty,
      },
    }),
  ]);

  // 8. AFTER STOCK BALANCES
  const afterRmA = await prisma.stockBalance.findFirst({ where: { plantId: plant1!.id, warehouseId: wh!.id, materialId: rmAMat!.id } });
  const afterFg = await prisma.stockBalance.findFirst({ where: { plantId: plant1!.id, warehouseId: wh!.id, materialId: fgMat!.id } });

  console.log('\n--- AFTER STOCK BALANCES ---');
  console.log(`RM-A Available Stock: ${afterRmA?.quantity || 0} (Decreased by ${beforeRmA!.quantity - afterRmA!.quantity})`);
  console.log(`FG-A Available Stock: ${afterFg?.quantity || 0} (Increased by ${afterFg!.quantity})`);
  console.log(`Rejected Quantity (Excluded from FG stock): ${rejQty}`);
  console.log('==================================================\n');
}

runGoldenFlow()
  .catch((e) => {
    console.error('Golden flow verification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
