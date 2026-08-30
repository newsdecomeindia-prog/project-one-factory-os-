import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/foundation/history/:entity/:recordId (Record History Timeline API)
router.get('/history/:entity/:recordId', requireAuth, async (req: Request, res: Response) => {
  try {
    const entity = req.params.entity as string;
    const recordId = req.params.recordId as string;

    const history = await prisma.auditLog.findMany({
      where: {
        entity,
        recordId,
        ...(!req.user!.isSuperAdmin && req.user!.companyId && { companyId: req.user!.companyId }),
      },
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Transaction Reference API Foundation
router.get('/transactions/references', requireAuth, async (req: Request, res: Response) => {
  const references = await prisma.transactionReference.findMany({
    where: {
      ...(!req.user!.isSuperAdmin && req.user!.companyId && { companyId: req.user!.companyId }),
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: references });
});

router.post('/transactions/references', requireAuth, async (req: Request, res: Response) => {
  const { sourceEntity, sourceRecordId, targetEntity, targetRecordId, referenceType, referenceNumber, companyId, plantId, departmentId } = req.body;

  const targetCompanyId = req.user!.isSuperAdmin ? companyId : req.user!.companyId;

  const ref = await prisma.transactionReference.create({
    data: {
      sourceEntity,
      sourceRecordId,
      targetEntity,
      targetRecordId,
      referenceType,
      referenceNumber,
      companyId: targetCompanyId,
      plantId,
      departmentId,
      createdBy: req.user!.id,
    },
  });

  await AuditService.log({
    userId: req.user!.id,
    userEmail: req.user!.email,
    companyId: targetCompanyId,
    entity: 'TransactionReference',
    recordId: ref.id,
    action: 'CREATE',
    newValues: ref,
  });

  res.status(201).json({ success: true, data: ref });
});

// Universal Search API Foundation (Tenant Filtered)
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.json({ success: true, data: [] });
  }

  const q = query.trim();
  const tenantCompanyFilter = (!req.user!.isSuperAdmin && req.user!.companyId) ? { id: req.user!.companyId } : {};
  const plantCompanyFilter = (!req.user!.isSuperAdmin && req.user!.companyId) ? { companyId: req.user!.companyId } : {};

  const [companies, plants, departments, users] = await Promise.all([
    prisma.company.findMany({ where: { ...tenantCompanyFilter, OR: [{ companyCode: { contains: q } }, { displayName: { contains: q } }] }, take: 5 }),
    prisma.plant.findMany({ where: { ...plantCompanyFilter, OR: [{ plantCode: { contains: q } }, { plantName: { contains: q } }] }, take: 5 }),
    prisma.department.findMany({ where: { plant: plantCompanyFilter, OR: [{ departmentCode: { contains: q } }, { departmentName: { contains: q } }] }, take: 5 }),
    prisma.user.findMany({ where: { ...plantCompanyFilter, OR: [{ email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }] }, select: { id: true, email: true, firstName: true, lastName: true }, take: 5 }),
  ]);

  res.json({
    success: true,
    data: {
      companies,
      plants,
      departments,
      users,
    },
  });
});

// GET /api/v1/foundation/materials
router.get('/materials', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const materials = await prisma.material.findMany({
      where: {
        ...(!req.user!.isSuperAdmin && companyId && { companyId }),
        status: 'ACTIVE',
      },
      include: { category: true, uom: true },
    });
    res.json({ success: true, data: materials });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/foundation/uoms
router.get('/uoms', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const uoms = await prisma.uom.findMany({
      where: {
        ...(!req.user!.isSuperAdmin && companyId && { companyId }),
        status: 'ACTIVE',
      },
    });
    res.json({ success: true, data: uoms });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
