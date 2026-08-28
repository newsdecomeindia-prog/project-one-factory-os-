import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/backend/server';
import { prisma } from '../../src/backend/database/prisma';

describe('Sprint 03 Production to FG Stock Golden Flow Integration Tests', () => {
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
    // 1. Authenticate Super Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@factory.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;

    // 2. Authenticate Company B Tenant User
    const compBRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'compb.manager@factory.com', password: 'Admin@123' });
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

    // Clean test transactional tables to guarantee clean state
    await prisma.stockTransaction.deleteMany({});
    await prisma.productionReceipt.deleteMany({});
    await prisma.productionExecution.deleteMany({});
    await prisma.materialIssue.deleteMany({});
    await prisma.materialReservation.deleteMany({});
    await prisma.workOrder.deleteMany({});
    await prisma.bomComponent.deleteMany({});
    await prisma.bomHeader.deleteMany({});

    // Reset stock balances: RM-A = 500, RM-B = 500, FG-A = 0
    await prisma.stockBalance.deleteMany({ where: { plantId: plant1Id } });
    await prisma.stockBalance.create({
      data: { companyId: companyAId, plantId: plant1Id, warehouseId, binId, materialId: rmAMaterialId, quantity: 500 },
    });
    await prisma.stockBalance.create({
      data: { companyId: companyAId, plantId: plant1Id, warehouseId, binId, materialId: rmBMaterialId, quantity: 500 },
    });
  });

  let createdBomId: string;
  let createdWoId: string;
  let createdExecutionId: string;

  it('1. BOM Creation & Validation', async () => {
    const res = await request(app)
      .post('/api/v1/boms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        finishedMaterialId: fgMaterialId,
        plantId: plant1Id,
        companyId: companyAId,
        components: [
          { componentMaterialId: rmAMaterialId, quantityPerUnit: 2, scrapFactor: 0 },
          { componentMaterialId: rmBMaterialId, quantityPerUnit: 1, scrapFactor: 0 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bomNumber).toBeDefined();
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.components.length).toBe(2);

    createdBomId = res.body.data.id;
  });

  it('2. BOM Version Control on Update', async () => {
    const res = await request(app)
      .put(`/api/v1/boms/${createdBomId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        components: [
          { componentMaterialId: rmAMaterialId, quantityPerUnit: 2, scrapFactor: 5 },
          { componentMaterialId: rmBMaterialId, quantityPerUnit: 1, scrapFactor: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe(2);
  });

  it('3. Work Order Creation', async () => {
    const res = await request(app)
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plantId: plant1Id,
        departmentId: dept1Id,
        finishedMaterialId: fgMaterialId,
        bomHeaderId: createdBomId,
        plannedQuantity: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.woNumber).toBeDefined();

    createdWoId = res.body.data.id;
  });

  it('4. Work Order Release & Automatic Material Reservation Calculation', async () => {
    const res = await request(app)
      .post(`/api/v1/work-orders/${createdWoId}/release`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('MATERIAL_RESERVED');
    expect(res.body.data.reservations.length).toBe(2);

    // Verify calculated reservation quantity: WO = 100, RM-A = 2 per FG with 5% scrap = 210
    const rmARes = res.body.data.reservations.find((r: any) => r.materialId === rmAMaterialId);
    expect(rmARes).toBeDefined();
    expect(rmARes.requiredQuantity).toBe(210);
  });

  it('5. Unauthorized Tenant Access Rejection (Multi-Tenant Isolation)', async () => {
    const res = await request(app)
      .get(`/api/v1/work-orders/${createdWoId}`)
      .set('Authorization', `Bearer ${compBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('6. Insufficient Stock Rejection during Material Issue', async () => {
    const res = await request(app)
      .post('/api/v1/material-issues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        workOrderId: createdWoId,
        materialId: rmAMaterialId,
        issuedQuantity: 10000, // Stock is 500
        warehouseId,
        binId,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Insufficient stock available');
  });

  it('7. Material Issue & Stock Deduction', async () => {
    // Initial stock for RM-A is 500. Issue 200. Expected available = 300.
    const res = await request(app)
      .post('/api/v1/material-issues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        workOrderId: createdWoId,
        materialId: rmAMaterialId,
        issuedQuantity: 200,
        warehouseId,
        binId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.issueNumber).toBeDefined();

    // Verify stock balance updated to 300
    const stockBal = await prisma.stockBalance.findFirst({
      where: { plantId: plant1Id, warehouseId, materialId: rmAMaterialId },
    });
    expect(stockBal!.quantity).toBe(300);
  });

  it('8. Production Execution Quantity Reconciliation Validation', async () => {
    // Invalid reconciliation: Executed 100 != Good 90 + Rejected 5 + Hold 0 (sum 95)
    const invalidRes = await request(app)
      .post('/api/v1/production-executions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        workOrderId: createdWoId,
        executedQuantity: 100,
        goodQuantity: 90,
        rejectedQuantity: 5,
        holdQuantity: 0,
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.success).toBe(false);

    // Valid reconciliation: Executed 100 = Good 95 + Rejected 5 + Hold 0
    const validRes = await request(app)
      .post('/api/v1/production-executions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        workOrderId: createdWoId,
        executedQuantity: 100,
        goodQuantity: 95,
        rejectedQuantity: 5,
        holdQuantity: 0,
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.data.goodQuantity).toBe(95);

    createdExecutionId = validRes.body.data.id;
  });

  it('9. Production Receipt & FG Stock Increase (Good Production ONLY)', async () => {
    const res = await request(app)
      .post('/api/v1/production-receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        executionId: createdExecutionId,
        warehouseId,
        binId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receivedQuantity).toBe(95);

    // Verify Available FG Stock equals exactly 95 (Rejected 5 excluded)
    const fgStock = await prisma.stockBalance.findFirst({
      where: { plantId: plant1Id, warehouseId, materialId: fgMaterialId },
    });
    expect(fgStock).toBeDefined();
    expect(fgStock!.quantity).toBe(95);
  });

  it('10. Duplicate Production Receipt Protection', async () => {
    const res = await request(app)
      .post('/api/v1/production-receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        executionId: createdExecutionId,
        warehouseId,
        binId,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('already generated for execution');
  });

  it('11. Controlled Cancellation with Mandatory Reason (No Direct Delete)', async () => {
    // Fail without mandatory reason
    const failRes = await request(app)
      .post(`/api/v1/work-orders/${createdWoId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelReason: '' });

    expect(failRes.status).toBe(400);

    // Create a new draft WO to test cancellation
    const newWoRes = await request(app)
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plantId: plant1Id,
        departmentId: dept1Id,
        finishedMaterialId: fgMaterialId,
        bomHeaderId: createdBomId,
        plannedQuantity: 50,
      });

    const newWoId = newWoRes.body.data.id;

    const passRes = await request(app)
      .post(`/api/v1/work-orders/${newWoId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelReason: 'Engineering design change request' });

    expect(passRes.status).toBe(200);
    expect(passRes.body.data.status).toBe('CANCELLED');

    // Verify audit log generated for cancellation
    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'WorkOrder', recordId: newWoId, action: 'CANCEL' },
    });
    expect(audit).toBeDefined();
    expect(audit!.reason).toBe('Engineering design change request');
  });

  it('12. Complete End-to-End Golden Flow Verification', async () => {
    // Golden Flow: BOM -> WO -> RELEASE -> MATERIAL ISSUE -> EXECUTION -> RECEIPT -> FG STOCK
    // WO = 100
    // RM-A issued = 200 (Stock 300 -> 100)
    // Production Executed = 100 (Good = 95, Rejected = 5, Hold = 0)
    // Receipt: FG Stock +95 (Previous 95 -> 190 total FG)

    const woRes = await request(app)
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plantId: plant1Id,
        departmentId: dept1Id,
        finishedMaterialId: fgMaterialId,
        bomHeaderId: createdBomId,
        plannedQuantity: 100,
      });
    const woId = woRes.body.data.id;

    await request(app)
      .post(`/api/v1/work-orders/${woId}/release`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .post('/api/v1/material-issues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ workOrderId: woId, materialId: rmAMaterialId, issuedQuantity: 200, warehouseId, binId });

    const execRes = await request(app)
      .post('/api/v1/production-executions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ workOrderId: woId, executedQuantity: 100, goodQuantity: 95, rejectedQuantity: 5, holdQuantity: 0 });

    await request(app)
      .post('/api/v1/production-receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ executionId: execRes.body.data.id, warehouseId, binId });

    // Final checks
    const finalRmABalance = await prisma.stockBalance.findFirst({
      where: { plantId: plant1Id, warehouseId, materialId: rmAMaterialId },
    });
    expect(finalRmABalance!.quantity).toBe(100); // 300 - 200 = 100

    const finalFgBalance = await prisma.stockBalance.findFirst({
      where: { plantId: plant1Id, warehouseId, materialId: fgMaterialId },
    });
    expect(finalFgBalance!.quantity).toBe(190); // 95 + 95 = 190
  });
});
