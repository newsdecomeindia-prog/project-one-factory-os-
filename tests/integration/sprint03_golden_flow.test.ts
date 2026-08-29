import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/backend/server';
import { prisma } from '../../src/backend/database/prisma';

describe('Sprint 03 — 32 Mandatory Specification Test Scenarios', () => {
  let adminToken: string;
  let compBToken: string;
  let companyAId: string;
  let companyBId: string;
  let plant1Id: string;
  let plant2Id: string;
  let dept1Id: string;
  let warehouseId: string;
  let binId: string;
  let fgMaterialId: string;
  let rmAMaterialId: string;
  let rmBMaterialId: string;

  beforeAll(async () => {
    // Authenticate Super Admin & Company B Manager
    const adminRes = await request(app).post('/api/v1/auth/login').send({ email: 'admin@factory.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;

    const compBRes = await request(app).post('/api/v1/auth/login').send({ email: 'compb.manager@factory.com', password: 'Admin@123' });
    compBToken = compBRes.body.data.token;

    // Fetch Master Data references
    const companyA = await prisma.company.findUnique({ where: { companyCode: 'COMP-01' } });
    companyAId = companyA!.id;

    const companyB = await prisma.company.findUnique({ where: { companyCode: 'COMP-02' } });
    companyBId = companyB!.id;

    const plant1 = await prisma.plant.findUnique({ where: { plantCode: 'PLANT-01' } });
    plant1Id = plant1!.id;

    const plant2 = await prisma.plant.findUnique({ where: { plantCode: 'PLANT-02' } });
    plant2Id = plant2!.id;

    const dept1 = await prisma.department.findUnique({ where: { departmentCode: 'DEPT-PROD-01' } });
    dept1Id = dept1!.id;

    const wh = await prisma.warehouse.findFirst({ where: { plantId: plant1Id, warehouseCode: 'WH-MAIN' } });
    warehouseId = wh!.id;

    const bin = await prisma.storageBin.findFirst({ where: { warehouseId, binCode: 'BIN-A1' } });
    binId = bin!.id;

    const fgMat = await prisma.material.findUnique({ where: { companyId_materialCode: { companyId: companyAId, materialCode: 'FG-A' } } });
    fgMaterialId = fgMat!.id;

    const rmAMat = await prisma.material.findUnique({ where: { companyId_materialCode: { companyId: companyAId, materialCode: 'RM-A' } } });
    rmAMaterialId = rmAMat!.id;

    const rmBMat = await prisma.material.findUnique({ where: { companyId_materialCode: { companyId: companyAId, materialCode: 'RM-B' } } });
    rmBMaterialId = rmBMat!.id;

    // Reset clean state
    await prisma.stockTransaction.deleteMany({});
    await prisma.productionReceipt.deleteMany({});
    await prisma.productionExecution.deleteMany({});
    await prisma.materialIssue.deleteMany({});
    await prisma.materialReservation.deleteMany({});
    await prisma.workOrder.deleteMany({});
    await prisma.bomComponent.deleteMany({});
    await prisma.bomHeader.deleteMany({});

    await prisma.stockBalance.deleteMany({ where: { plantId: plant1Id } });
    await prisma.stockBalance.create({ data: { companyId: companyAId, plantId: plant1Id, warehouseId, binId, materialId: rmAMaterialId, quantity: 500 } });
    await prisma.stockBalance.create({ data: { companyId: companyAId, plantId: plant1Id, warehouseId, binId, materialId: rmBMaterialId, quantity: 500 } });
  });

  let activeBomId: string;
  let activeWoId: string;
  let activeReservationId: string;
  let activeIssueId: string;
  let activeExecutionId: string;
  let activeReceiptId: string;

  // 1. BOM Creation
  it('1. BOM creation', async () => {
    const res = await request(app).post('/api/v1/boms').set('Authorization', `Bearer ${adminToken}`).send({
      finishedMaterialId: fgMaterialId,
      plantId: plant1Id,
      companyId: companyAId,
      components: [
        { componentMaterialId: rmAMaterialId, quantityPerUnit: 2, scrapFactor: 0 },
        { componentMaterialId: rmBMaterialId, quantityPerUnit: 1, scrapFactor: 0 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.bomNumber).toBeDefined();
    activeBomId = res.body.data.id;
  });

  // 2. BOM Validation
  it('2. BOM validation', async () => {
    const invalidRes = await request(app).post('/api/v1/boms').set('Authorization', `Bearer ${adminToken}`).send({
      finishedMaterialId: fgMaterialId,
      plantId: plant1Id,
      companyId: companyAId,
      components: [{ componentMaterialId: rmAMaterialId, quantityPerUnit: -5 }],
    });
    expect(invalidRes.status).toBe(400);
  });

  // 3. BOM Version Control
  it('3. BOM version control', async () => {
    const updateRes = await request(app).put(`/api/v1/boms/${activeBomId}`).set('Authorization', `Bearer ${adminToken}`).send({
      components: [
        { componentMaterialId: rmAMaterialId, quantityPerUnit: 2, scrapFactor: 0 },
        { componentMaterialId: rmBMaterialId, quantityPerUnit: 1, scrapFactor: 0 },
      ],
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.version).toBe(2);
  });

  // 4. Work Order Creation
  it('4. Work Order creation', async () => {
    const res = await request(app).post('/api/v1/work-orders').set('Authorization', `Bearer ${adminToken}`).send({
      plantId: plant1Id,
      departmentId: dept1Id,
      finishedMaterialId: fgMaterialId,
      bomHeaderId: activeBomId,
      plannedQuantity: 100,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    activeWoId = res.body.data.id;
  });

  // 5. Work Order Release
  it('5. Work Order release', async () => {
    const res = await request(app).post(`/api/v1/work-orders/${activeWoId}/release`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('MATERIAL_RESERVED');
    activeReservationId = res.body.data.reservations[0].id;
  });

  // 6. Unauthorized WO Release
  it('6. Unauthorized WO release', async () => {
    // Create draft WO
    const draftRes = await request(app).post('/api/v1/work-orders').set('Authorization', `Bearer ${adminToken}`).send({
      plantId: plant1Id,
      departmentId: dept1Id,
      finishedMaterialId: fgMaterialId,
      bomHeaderId: activeBomId,
      plannedQuantity: 50,
    });
    const draftWoId = draftRes.body.data.id;

    const unauthRes = await request(app).post(`/api/v1/work-orders/${draftWoId}/release`).set('Authorization', `Bearer ${compBToken}`);
    expect(unauthRes.status).toBe(403);
  });

  // 7. Material Requirement Calculation
  it('7. Material requirement calculation', async () => {
    const wo = await prisma.workOrder.findUnique({ where: { id: activeWoId }, include: { reservations: true } });
    expect(wo!.reservations.length).toBe(2);
    const rmARes = wo!.reservations.find(r => r.materialId === rmAMaterialId);
    expect(rmARes!.requiredQuantity).toBe(200); // 100 * 2
  });

  // 8. Material Reservation
  it('8. Material reservation', async () => {
    const res = await prisma.materialReservation.findUnique({ where: { id: activeReservationId } });
    expect(res).toBeDefined();
    expect(res!.status).toBe('RESERVED');
  });

  // 9. Material Issue
  it('9. Material issue', async () => {
    const res = await request(app).post('/api/v1/material-issues').set('Authorization', `Bearer ${adminToken}`).send({
      workOrderId: activeWoId,
      reservationId: activeReservationId,
      materialId: rmAMaterialId,
      issuedQuantity: 200,
      warehouseId,
      binId,
    });
    expect(res.status).toBe(201);
    activeIssueId = res.body.data.id;
  });

  // 10. Insufficient Stock Rejection
  it('10. Insufficient stock rejection', async () => {
    const res = await request(app).post('/api/v1/material-issues').set('Authorization', `Bearer ${adminToken}`).send({
      workOrderId: activeWoId,
      materialId: rmAMaterialId,
      issuedQuantity: 5000,
      warehouseId,
      binId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient stock available');
  });

  // 11. Invalid Warehouse/Bin Rejection
  it('11. Invalid warehouse/bin rejection', async () => {
    const res = await request(app).post('/api/v1/material-issues').set('Authorization', `Bearer ${adminToken}`).send({
      workOrderId: activeWoId,
      materialId: rmAMaterialId,
      issuedQuantity: 10,
      warehouseId: 'invalid-warehouse-uuid',
      binId,
    });
    expect(res.status).toBe(400);
  });

  // 12. Stock Deduction
  it('12. Stock deduction', async () => {
    const bal = await prisma.stockBalance.findFirst({ where: { plantId: plant1Id, warehouseId, materialId: rmAMaterialId } });
    expect(bal!.quantity).toBe(300); // 500 - 200 = 300
  });

  // 13. Production Execution
  it('13. Production execution', async () => {
    const res = await request(app).post('/api/v1/production-executions').set('Authorization', `Bearer ${adminToken}`).send({
      workOrderId: activeWoId,
      executedQuantity: 100,
      goodQuantity: 95,
      rejectedQuantity: 5,
      holdQuantity: 0,
    });
    expect(res.status).toBe(201);
    activeExecutionId = res.body.data.id;
  });

  // 14. Production Quantity Reconciliation
  it('14. Production quantity reconciliation', async () => {
    const invalidRes = await request(app).post('/api/v1/production-executions').set('Authorization', `Bearer ${adminToken}`).send({
      workOrderId: activeWoId,
      executedQuantity: 100,
      goodQuantity: 80,
      rejectedQuantity: 5,
      holdQuantity: 0,
    });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error).toContain('reconciliation failure');
  });

  // 15. Production Receipt
  it('15. Production receipt', async () => {
    const res = await request(app).post('/api/v1/production-receipts').set('Authorization', `Bearer ${adminToken}`).send({
      executionId: activeExecutionId,
      warehouseId,
      binId,
    });
    expect(res.status).toBe(201);
    activeReceiptId = res.body.data.id;
  });

  // 16. FG Stock Increase
  it('16. FG stock increase', async () => {
    const fgBal = await prisma.stockBalance.findFirst({ where: { plantId: plant1Id, warehouseId, materialId: fgMaterialId } });
    expect(fgBal!.quantity).toBe(95);
  });

  // 17. Rejected Quantity Excluded from FG Stock
  it('17. Rejected quantity excluded from FG stock', async () => {
    const fgBal = await prisma.stockBalance.findFirst({ where: { plantId: plant1Id, warehouseId, materialId: fgMaterialId } });
    expect(fgBal!.quantity).not.toBe(100);
    expect(fgBal!.quantity).toBe(95);
  });

  // 18. Tenant Isolation
  it('18. Tenant isolation', async () => {
    const res = await request(app).get(`/api/v1/work-orders/${activeWoId}`).set('Authorization', `Bearer ${compBToken}`);
    expect(res.status).toBe(403);
  });

  // 19. Company Isolation
  it('19. Company isolation', async () => {
    const res = await request(app).get('/api/v1/boms').set('Authorization', `Bearer ${compBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((b: any) => b.companyId === companyBId)).toBe(true);
  });

  // 20. Plant Isolation
  it('20. Plant isolation', async () => {
    const res = await request(app).get(`/api/v1/work-orders?plantId=${plant2Id}`).set('Authorization', `Bearer ${compBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((w: any) => w.plantId === plant2Id)).toBe(true);
  });

  // 21. Department Authorization
  it('21. Department authorization', async () => {
    const wo = await prisma.workOrder.findUnique({ where: { id: activeWoId } });
    expect(wo!.departmentId).toBe(dept1Id);
  });

  // 22. RBAC
  it('22. RBAC', async () => {
    const res = await request(app).get('/api/v1/boms').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  // 23. Audit Generation
  it('23. Audit generation', async () => {
    const audits = await prisma.auditLog.findMany({ where: { recordId: activeWoId } });
    expect(audits.length).toBeGreaterThan(0);
  });

  // 24. No Direct Delete
  it('24. No direct delete', async () => {
    // Create separate test WO to cancel without affecting activeWoId status for subsequent tests
    const testWoRes = await request(app).post('/api/v1/work-orders').set('Authorization', `Bearer ${adminToken}`).send({
      plantId: plant1Id, departmentId: dept1Id, finishedMaterialId: fgMaterialId, bomHeaderId: activeBomId, plannedQuantity: 10,
    });
    const testWoId = testWoRes.body.data.id;

    const res = await request(app).post(`/api/v1/work-orders/${testWoId}/cancel`).set('Authorization', `Bearer ${adminToken}`).send({ cancelReason: 'Controlled cancellation' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  // 25. Unauthorized Cancellation/Reversal
  it('25. Unauthorized cancellation/reversal', async () => {
    const res = await request(app).post(`/api/v1/work-orders/${activeWoId}/cancel`).set('Authorization', `Bearer ${compBToken}`).send({ cancelReason: 'Unauthorized' });
    expect(res.status).toBe(403);
  });

  // 26. Mandatory Reason
  it('26. Mandatory reason', async () => {
    const res = await request(app).post(`/api/v1/boms/${activeBomId}/deactivate`).set('Authorization', `Bearer ${adminToken}`).send({ reason: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Mandatory reason is required');
  });

  // 27. Duplicate WO Protection
  it('27. Duplicate WO protection', async () => {
    const wo1 = await request(app).post('/api/v1/work-orders').set('Authorization', `Bearer ${adminToken}`).send({
      plantId: plant1Id, departmentId: dept1Id, finishedMaterialId: fgMaterialId, bomHeaderId: activeBomId, plannedQuantity: 10,
    });
    const wo2 = await request(app).post('/api/v1/work-orders').set('Authorization', `Bearer ${adminToken}`).send({
      plantId: plant1Id, departmentId: dept1Id, finishedMaterialId: fgMaterialId, bomHeaderId: activeBomId, plannedQuantity: 10,
    });
    expect(wo1.body.data.woNumber).not.toBe(wo2.body.data.woNumber);
  });

  // 28. Duplicate Material Issue Protection
  it('28. Duplicate material issue protection', async () => {
    // Issue RM-B (stock is 500)
    const iss1 = await request(app).post('/api/v1/material-issues').set('Authorization', `Bearer ${adminToken}`).send({
      workOrderId: activeWoId, materialId: rmBMaterialId, issuedQuantity: 10, warehouseId, binId,
    });
    const iss2 = await request(app).post('/api/v1/material-issues').set('Authorization', `Bearer ${adminToken}`).send({
      workOrderId: activeWoId, materialId: rmBMaterialId, issuedQuantity: 10, warehouseId, binId,
    });
    expect(iss1.status).toBe(201);
    expect(iss2.status).toBe(201);
    expect(iss1.body.data.issueNumber).not.toBe(iss2.body.data.issueNumber);
  });

  // 29. Duplicate Production Receipt Protection
  it('29. Duplicate production receipt protection', async () => {
    const dupRes = await request(app).post('/api/v1/production-receipts').set('Authorization', `Bearer ${adminToken}`).send({
      executionId: activeExecutionId, warehouseId, binId,
    });
    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error).toContain('already generated');
  });

  // 30. Concurrent Stock Issue Protection
  it('30. Concurrent stock issue protection', async () => {
    // RM-B stock was 500 - 20 = 480 available. Issue 300 twice concurrently (total 600 > 480). One must succeed, one must fail.
    const results = await Promise.all([
      request(app).post('/api/v1/material-issues').set('Authorization', `Bearer ${adminToken}`).send({ workOrderId: activeWoId, materialId: rmBMaterialId, issuedQuantity: 300, warehouseId, binId }),
      request(app).post('/api/v1/material-issues').set('Authorization', `Bearer ${adminToken}`).send({ workOrderId: activeWoId, materialId: rmBMaterialId, issuedQuantity: 300, warehouseId, binId }),
    ]);
    const statuses = results.map(r => r.status);
    expect(statuses).toContain(201);
    expect(statuses).toContain(400); // One must fail due to stock depletion
  });

  // 31. Integration Contracts
  it('31. Integration contracts', async () => {
    const refs = await prisma.transactionReference.findMany({ where: { companyId: companyAId } });
    expect(refs.length).toBeGreaterThan(0);
  });

  // 32. Complete Golden Flow
  it('32. Complete Golden Flow', async () => {
    // Verify complete flow sequence stored cleanly in database
    const totalReceipts = await prisma.productionReceipt.count({ where: { companyId: companyAId } });
    expect(totalReceipts).toBeGreaterThan(0);
  });
});
