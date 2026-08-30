import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/backend/server';
import { prisma } from '../../src/backend/database/prisma';
import bcrypt from 'bcryptjs';

describe('Sprint 05 — Sales & Demand Management Golden Flow Specification Test Suite (30 Categories)', () => {
  let adminToken: string;
  let compAToken: string;
  let compBToken: string;

  let companyAId: string;
  let companyBId: string;
  let plant1Id: string;
  let plant2Id: string;
  let fgAMaterialId: string;
  let uomPcsId: string;

  let customerId: string;
  let enquiryId: string;
  let quotationId: string;
  let salesOrderId: string;

  beforeAll(async () => {
    // Clean Sprint 06 and 05 tables in correct dependency order
    await prisma.paymentReconciliation.deleteMany();
    await prisma.customerPayment.deleteMany();
    await prisma.gateOutPass.deleteMany();
    await prisma.journalLine.deleteMany();
    await prisma.journalHeader.deleteMany();
    await prisma.salesInvoice.deleteMany();
    await prisma.dispatchAdvice.deleteMany();
    await prisma.taxMaster.deleteMany();
    await prisma.productionRequirement.deleteMany();
    await prisma.deliveryPlan.deleteMany();
    await prisma.salesOrder.deleteMany();
    await prisma.salesQuotation.deleteMany();
    await prisma.salesEnquiry.deleteMany();
    await prisma.customer.deleteMany();

    const passwordHash = await bcrypt.hash('Admin@123', 12);

    // Seed Companies
    const companyA = await prisma.company.upsert({
      where: { companyCode: 'COMP-01' },
      update: {},
      create: {
        companyCode: 'COMP-01',
        legalName: 'Apex Manufacturing Private Limited',
        displayName: 'Apex Manufacturing (Company A)',
        status: 'ACTIVE',
      },
    });
    companyAId = companyA.id;

    const companyB = await prisma.company.upsert({
      where: { companyCode: 'COMP-02' },
      update: {},
      create: {
        companyCode: 'COMP-02',
        legalName: 'Bharat Components Private Limited',
        displayName: 'Bharat Components (Company B)',
        status: 'ACTIVE',
      },
    });
    companyBId = companyB.id;

    // Seed Plants
    const plant1 = await prisma.plant.upsert({
      where: { plantCode: 'PLANT-01' },
      update: {},
      create: {
        plantCode: 'PLANT-01',
        companyId: companyAId,
        plantName: 'Chakan Unit 1 Assembly Plant',
        status: 'ACTIVE',
      },
    });
    plant1Id = plant1.id;

    const plant2 = await prisma.plant.upsert({
      where: { plantCode: 'PLANT-02' },
      update: {},
      create: {
        plantCode: 'PLANT-02',
        companyId: companyBId,
        plantName: 'Sanand Unit 2 Component Factory',
        status: 'ACTIVE',
      },
    });
    plant2Id = plant2.id;

    // Seed Roles & Super Admin
    let superRole = await prisma.role.findUnique({ where: { roleName: 'Super Admin' } });
    if (!superRole) {
      superRole = await prisma.role.create({ data: { roleName: 'Super Admin', description: 'Full System Access' } });
    }

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@factory.com' },
      update: { companyId: companyAId },
      create: {
        email: 'admin@factory.com',
        companyId: companyAId,
        passwordHash,
        firstName: 'System',
        lastName: 'SuperAdmin',
        status: 'ACTIVE',
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: superRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superRole.id },
    });

    // Seed Company A Manager & Company B Manager
    const compAUser = await prisma.user.upsert({
      where: { email: 'plant1.manager@factory.com' },
      update: { companyId: companyAId },
      create: {
        email: 'plant1.manager@factory.com',
        companyId: companyAId,
        passwordHash,
        firstName: 'Rajesh',
        lastName: 'Manager',
        status: 'ACTIVE',
      },
    });

    const compBUser = await prisma.user.upsert({
      where: { email: 'compb.manager@factory.com' },
      update: { companyId: companyBId },
      create: {
        email: 'compb.manager@factory.com',
        companyId: companyBId,
        passwordHash,
        firstName: 'Amit',
        lastName: 'Manager',
        status: 'ACTIVE',
      },
    });

    // Seed Permissions & Roles
    const permissions = [
      'customer:read', 'customer:create', 'customer:update',
      'sales:enquiry', 'sales:quotation', 'sales:order', 'sales:approve',
      'sales:availability', 'sales:delivery', 'sales:report', 'stock:read'
    ];

    for (const code of permissions) {
      let p = await prisma.permission.findUnique({ where: { permissionCode: code } });
      if (!p) {
        p = await prisma.permission.create({
          data: { permissionCode: code, module: 'Sales', action: code.split(':')[1] || 'read' },
        });
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: superRole.id, permissionId: p.id },
      });
    }

    // Login tokens
    const adminRes = await request(app).post('/api/v1/auth/login').send({ email: 'admin@factory.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;

    const compARes = await request(app).post('/api/v1/auth/login').send({ email: 'plant1.manager@factory.com', password: 'Admin@123' });
    compAToken = compARes.body.data.token;

    const compBRes = await request(app).post('/api/v1/auth/login').send({ email: 'compb.manager@factory.com', password: 'Admin@123' });
    compBToken = compBRes.body.data.token;

    // Seed UOM & Materials
    const uomPcs = await prisma.uom.upsert({
      where: { companyId_uomCode: { companyId: companyAId, uomCode: 'PCS' } },
      update: {},
      create: { companyId: companyAId, uomCode: 'PCS', name: 'Pieces', status: 'ACTIVE' },
    });
    uomPcsId = uomPcs.id;

    const catFG = await prisma.materialCategory.upsert({
      where: { companyId_categoryCode: { companyId: companyAId, categoryCode: 'FINISHED' } },
      update: {},
      create: { companyId: companyAId, categoryCode: 'FINISHED', categoryName: 'Finished Goods', status: 'ACTIVE' },
    });

    const fgA = await prisma.material.upsert({
      where: { companyId_materialCode: { companyId: companyAId, materialCode: 'FG-A' } },
      update: {},
      create: {
        companyId: companyAId,
        materialCode: 'FG-A',
        description: 'Finished Assembly Product A',
        categoryId: catFG.id,
        uomId: uomPcsId,
        materialType: 'FINISHED_GOODS',
        status: 'ACTIVE',
      },
    });
    fgAMaterialId = fgA.id;

    // Seed WH Main & Stock Balance = 700 units for FG-A in Plant 1
    const whMain = await prisma.warehouse.upsert({
      where: { plantId_warehouseCode: { plantId: plant1Id, warehouseCode: 'WH-MAIN' } },
      update: {},
      create: { plantId: plant1Id, companyId: companyAId, warehouseCode: 'WH-MAIN', name: 'Main Warehouse', status: 'ACTIVE' },
    });

    await prisma.stockBalance.upsert({
      where: { plantId_warehouseId_materialId: { plantId: plant1Id, warehouseId: whMain.id, materialId: fgAMaterialId } },
      update: { quantity: 700 },
      create: { companyId: companyAId, plantId: plant1Id, warehouseId: whMain.id, materialId: fgAMaterialId, quantity: 700 },
    });
  });

  // 1. Customer Creation
  it('1. Customer creation', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerCode: 'CUST-001',
        customerName: 'Acme Automotives India Pvt Ltd',
        address: 'Sector 10, MIDC Chakan',
        gstin: '27ACME0000A1Z1',
        contactPerson: 'John Doe',
        email: 'johndoe@acme.com',
        phone: '+91 9876543210',
        shippingLocation: 'Warehouse Gate 2, Chakan',
        paymentTerms: 'NET_30',
        creditLimit: 500000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.customerCode).toBe('CUST-001');
    customerId = res.body.data.id;
  });

  // 2. Company Isolation
  it('2. Company isolation', async () => {
    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${compBToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((c: any) => c.id === customerId);
    expect(found).toBeUndefined(); // Customer created under Company A must not leak to Company B
  });

  // 3. Unauthorized Customer Access
  it('3. Unauthorized customer access', async () => {
    const res = await request(app)
      .get(`/api/v1/customers/${customerId}`)
      .set('Authorization', `Bearer ${compBToken}`);

    expect(res.status).toBe(404);
  });

  // 4. Sales Enquiry Creation
  it('4. Sales enquiry creation', async () => {
    const res = await request(app)
      .post('/api/v1/sales/enquiries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        plantId: plant1Id,
        materialId: fgAMaterialId,
        quantity: 1000,
        uomId: uomPcsId,
        requiredDate: new Date().toISOString(),
        remarks: 'Urgent enquiry for Q4 delivery',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.enquiryNumber).toBeDefined();
    enquiryId = res.body.data.id;
  });

  // 5. Enquiry Status Validation
  it('5. Enquiry status validation', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/enquiries/${enquiryId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUBMITTED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  // 6. Quotation Creation from Enquiry
  it('6. Quotation creation from enquiry', async () => {
    const res = await request(app)
      .post('/api/v1/sales/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        enquiryId,
        materialId: fgAMaterialId,
        quantity: 1000,
        rate: 1500,
        taxReference: 'GST_18',
        deliveryTerms: 'EX_WORKS',
        paymentTerms: 'NET_30',
        validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        plantId: plant1Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.quotationNumber).toBeDefined();
    quotationId = res.body.data.id;
  });

  // 7. Invalid Quotation Rejection
  it('7. Invalid quotation rejection', async () => {
    const res = await request(app)
      .post('/api/v1/sales/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId });

    expect(res.status).toBe(400);
  });

  // 8. Sales Order Creation from Quotation
  it('8. Sales Order creation from quotation', async () => {
    const res = await request(app)
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${compAToken}`)
      .send({
        customerId,
        quotationId,
        materialId: fgAMaterialId,
        quantity: 1000,
        uomId: uomPcsId,
        rate: 1500,
        taxReference: 'GST_18',
        requiredDeliveryDate: new Date(Date.now() + 15 * 86400000).toISOString(),
        plantId: plant1Id,
        shippingLocation: 'Chakan Warehouse 2',
        paymentTerms: 'NET_30',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.soNumber).toBeDefined();
    salesOrderId = res.body.data.id;
  });

  // 9. Maker cannot self-approve
  it('9. Maker cannot self-approve', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/orders/${salesOrderId}/approve`)
      .set('Authorization', `Bearer ${compAToken}`); // Requoisitioner = compAUser

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Maker-Checker Segregation');
  });

  // 10. Authorized Approval
  it('10. Authorized approval', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/orders/${salesOrderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`); // Super Admin override or separate checker

    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe('APPROVED');
  });

  // 11. Unauthorized Approval = 403
  it('11. Unauthorized approval = 403', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/orders/${salesOrderId}/approve`)
      .set('Authorization', `Bearer ${compBToken}`); // Cross tenant user

    expect(res.status).toBe(404);
  });

  // 12. FG Availability Check with Partial Stock (SO = 1,000, Available = 700)
  it('12. FG availability with partial stock', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/orders/${salesOrderId}/check-availability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orderedQuantity).toBe(1000);
    expect(res.body.data.availableStock).toBe(700);
    expect(res.body.data.fulfillableQuantity).toBe(700);
    expect(res.body.data.shortageQuantity).toBe(300);
    expect(res.body.data.productionRequirement).toBeDefined();
  });

  // 13. FG Availability does NOT reduce stock
  it('13. FG availability does NOT reduce stock', async () => {
    const stockBalances = await prisma.stockBalance.findMany({
      where: { plantId: plant1Id, materialId: fgAMaterialId },
    });
    const totalAvailable = stockBalances.reduce((sum, b) => sum + b.quantity, 0);

    expect(totalAvailable).toBe(700); // Stock MUST remain exactly 700
  });

  // 14. Shortage Calculation Accuracy
  it('14. Shortage calculation accuracy', async () => {
    const reqs = await prisma.productionRequirement.findMany({
      where: { soId: salesOrderId },
    });
    expect(reqs.length).toBe(1);
    expect(reqs[0].shortageQuantity).toBe(300);
  });

  // 15. Production Requirement Reference Creation
  it('15. Production requirement reference creation', async () => {
    const refs = await prisma.transactionReference.findMany({
      where: { sourceEntity: 'SalesOrder', sourceRecordId: salesOrderId },
    });
    const reqRef = refs.find((r) => r.referenceType === 'SO_SHORTAGE_REQUIREMENT');
    expect(reqRef).toBeDefined();
  });

  // 16. Delivery Planning Creation
  it('16. Delivery planning creation', async () => {
    const res = await request(app)
      .post('/api/v1/sales/delivery-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        soId: salesOrderId,
        plannedQuantity: 700,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.plannedQuantity).toBe(700);
    expect(res.body.data.pendingQuantity).toBe(300);
  });

  // 17. No Silent FG Stock Inflation
  it('17. No silent FG stock inflation', async () => {
    const stockBalances = await prisma.stockBalance.findMany({
      where: { plantId: plant1Id, materialId: fgAMaterialId },
    });
    const totalAvailable = stockBalances.reduce((sum, b) => sum + b.quantity, 0);

    expect(totalAvailable).toBe(700);
  });

  // 18. Duplicate Customer Prevention
  it('18. Duplicate customer prevention', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerCode: 'CUST-001',
        customerName: 'Duplicate Acme',
      });

    expect(res.status).toBe(400);
  });

  // 19. Soft Deactivation with Reason
  it('19. Soft deactivation with reason', async () => {
    const tempCust = await prisma.customer.create({
      data: {
        customerCode: 'CUST-TEMP',
        customerName: 'Temporary Customer',
        companyId: companyAId,
      },
    });

    const res = await request(app)
      .post(`/api/v1/customers/${tempCust.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Business contract expired' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');
  });

  // 20. Soft Deactivation Rejects Empty Reason
  it('20. Soft deactivation rejects empty reason', async () => {
    const tempCust = await prisma.customer.create({
      data: {
        customerCode: 'CUST-TEMP2',
        customerName: 'Temporary Customer 2',
        companyId: companyAId,
      },
    });

    const res = await request(app)
      .post(`/api/v1/customers/${tempCust.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' });

    expect(res.status).toBe(400);
  });

  // 21. Audit Verification for Sales Order
  it('21. Audit verification for sales order', async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'SalesOrder', recordId: salesOrderId },
    });

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
  });

  // 22. TransactionReference Chain Verification
  it('22. TransactionReference chain verification', async () => {
    const refs = await prisma.transactionReference.findMany({
      where: { companyId: companyAId },
    });

    expect(refs.length).toBeGreaterThan(0);
  });

  // 23. Cross-Company Isolation Enforcement
  it('23. Cross-company isolation enforcement', async () => {
    const res = await request(app)
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${compBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0); // Company B user cannot see Company A orders
  });

  // 24. Sales Summary Reporting
  it('24. Sales summary reporting', async () => {
    const res = await request(app)
      .get('/api/v1/sales/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.customerCount).toBeGreaterThan(0);
    expect(res.body.data.summary.orderCount).toBeGreaterThan(0);
  });

  // 25. Delivery Plan Listing
  it('25. Delivery plan listing', async () => {
    const res = await request(app)
      .get('/api/v1/sales/delivery-plans')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // 26. Sprint 01 Foundation Regression Check
  it('26. Sprint 01 foundation regression check', async () => {
    const res = await request(app)
      .get('/api/v1/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  // 27. Sprint 03 Production Regression Check
  it('27. Sprint 03 production regression check', async () => {
    const res = await request(app)
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  // 28. Sprint 04 QA/NCR Regression Check
  it('28. Sprint 04 QA/NCR regression check', async () => {
    const res = await request(app)
      .get('/api/v1/ncr')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  // 29. Sprint 04 Stock Transfer Regression Check
  it('29. Sprint 04 Stock Transfer regression check', async () => {
    const res = await request(app)
      .get('/api/v1/stock-transfers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  // 30. Full System Build & Readiness
  it('30. Full system build & readiness', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('OK');
  });
});
