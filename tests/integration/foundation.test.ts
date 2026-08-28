import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/backend/server';

describe('Project ONE Sprint 01 — Hardened Foundation Tests', () => {
  let superAdminToken: string;
  let compAManagerToken: string;
  let compBManagerToken: string;
  let testPlantId: string;

  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    // 1. Login Super Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@factory.com', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    superAdminToken = adminRes.body.data.token;

    // 2. Login Company A Manager
    const compARes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'plant1.manager@factory.com', password: 'Admin@123' });
    expect(compARes.status).toBe(200);
    compAManagerToken = compARes.body.data.token;

    // 3. Login Company B Manager
    const compBRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'compb.manager@factory.com', password: 'Admin@123' });
    expect(compBRes.status).toBe(200);
    compBManagerToken = compBRes.body.data.token;
  });

  // 1. Multi-Tenant Company Isolation Tests
  describe('Multi-Tenant Isolation', () => {
    it('restricts Company B user from viewing Company A plants', async () => {
      const plantsResA = await request(app)
        .get('/api/v1/plants')
        .set('Authorization', `Bearer ${compAManagerToken}`);
      expect(plantsResA.status).toBe(200);
      const companyAPlant = plantsResA.body.data[0];

      // Company B user tries to access Company A's plant directly by ID
      const crossTenantAccessRes = await request(app)
        .get(`/api/v1/plants/${companyAPlant.id}`)
        .set('Authorization', `Bearer ${compBManagerToken}`);

      expect(crossTenantAccessRes.status).toBe(403);
      expect(crossTenantAccessRes.body.error).toContain('Forbidden');
    });

    it('prevents Company B user from deactivating Company A company record', async () => {
      const companiesRes = await request(app)
        .get('/api/v1/companies')
        .set('Authorization', `Bearer ${superAdminToken}`);

      const companyA = companiesRes.body.data.find((c: any) => c.companyCode === 'COMP-01');

      const crossTenantDeactivateRes = await request(app)
        .post(`/api/v1/companies/${companyA.id}/deactivate`)
        .set('Authorization', `Bearer ${compBManagerToken}`)
        .send({ reason: 'Malicious attempt', actionType: 'INACTIVE' });

      expect(crossTenantDeactivateRes.status).toBe(403);
      expect(crossTenantDeactivateRes.body.error).toBeDefined();
    });
  });

  // 2. Reversal Permission Authorization
  describe('Authorized Reversal Permission Enforcement', () => {
    it('denies reversal attempt if user lacks explicit reverse permission', async () => {
      const compRes = await request(app)
        .get('/api/v1/companies')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const companyA = compRes.body.data.find((c: any) => c.companyCode === 'COMP-01');

      const createPlantRes = await request(app)
        .post('/api/v1/plants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          plantCode: `PLANT-REV-${uniqueSuffix}`,
          companyId: companyA.id,
          plantName: 'Reversal Test Plant',
        });
      expect(createPlantRes.status).toBe(201);
      testPlantId = createPlantRes.body.data.id;

      // Attempt REVERSED action as Company B user who does not have access to Plant
      const revRes = await request(app)
        .post(`/api/v1/plants/${testPlantId}/deactivate`)
        .set('Authorization', `Bearer ${compBManagerToken}`)
        .send({ reason: 'Reversing erroneous entry', actionType: 'REVERSED' });

      expect(revRes.status).toBe(403);
      expect(revRes.body.error).toBeDefined();
    });

    it('allows reversal when performed by authorized Super Admin', async () => {
      const revRes = await request(app)
        .post(`/api/v1/plants/${testPlantId}/deactivate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Authorized Super Admin reversal', actionType: 'REVERSED' });

      expect(revRes.status).toBe(200);
      expect(revRes.body.data.status).toBe('REVERSED');
    });
  });

  // 3. Security, Session Revocation & Record History
  describe('Security & Record History Timeline', () => {
    it('retrieves record history timeline audit entries', async () => {
      const historyRes = await request(app)
        .get(`/api/v1/foundation/history/Plant/${testPlantId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(historyRes.body.data.length).toBeGreaterThan(0);
    });

    it('supports user session revocation API', async () => {
      const revokeRes = await request(app)
        .post('/api/v1/auth/revoke-session')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({});

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.message).toContain('Active sessions revoked');
    });
  });
});
