import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission, enforcePlantAccess } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/plants (Tenant Isolated)
router.get('/', requireAuth, requirePermission('plant:read'), async (req: Request, res: Response) => {
  try {
    let plants;
    if (req.user!.isSuperAdmin) {
      plants = await prisma.plant.findMany({
        include: { company: true, departments: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      plants = await prisma.plant.findMany({
        where: {
          ...(req.user!.companyId && { companyId: req.user!.companyId }),
          id: { in: req.user!.plantIds },
        },
        include: { company: true, departments: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    res.json({ success: true, data: plants });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/plants/:id (Tenant Isolated)
router.get('/:id', requireAuth, requirePermission('plant:read'), enforcePlantAccess('params', 'id'), async (req: Request, res: Response) => {
  try {
    const plantId = req.params.id as string;
    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
      include: { company: true, departments: true },
    });

    if (!plant) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }

    if (!req.user!.isSuperAdmin && req.user!.companyId && plant.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant plant access denied.' });
    }

    res.json({ success: true, data: plant });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/plants
router.post('/', requireAuth, requirePermission('plant:create'), async (req: Request, res: Response) => {
  try {
    const { plantCode, companyId, plantName, location, address, timezone } = req.body;

    const targetCompanyId = req.user!.isSuperAdmin ? companyId : req.user!.companyId;

    if (!plantCode || !targetCompanyId || !plantName) {
      return res.status(400).json({ success: false, error: 'plantCode, companyId, and plantName are required' });
    }

    const companyExists = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!companyExists) {
      return res.status(400).json({ success: false, error: `Company ID '${targetCompanyId}' does not exist.` });
    }

    const existingCode = await prisma.plant.findUnique({ where: { plantCode } });
    if (existingCode) {
      return res.status(400).json({ success: false, error: `Plant code '${plantCode}' already exists.` });
    }

    const plant = await prisma.plant.create({
      data: {
        plantCode,
        companyId: targetCompanyId,
        plantName,
        location,
        address,
        timezone: timezone || 'Asia/Kolkata',
      },
    });

    await prisma.userPlantAccess.create({
      data: { userId: req.user!.id, plantId: plant.id },
    }).catch(() => {});

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: targetCompanyId,
      plantId: plant.id,
      entity: 'Plant',
      recordId: plant.id,
      action: 'CREATE',
      newValues: plant,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.status(201).json({ success: true, data: plant });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/plants/:id
router.put('/:id', requireAuth, requirePermission('plant:update'), enforcePlantAccess('params', 'id'), async (req: Request, res: Response) => {
  try {
    const { plantName, location, address, timezone } = req.body;
    const plantId = req.params.id as string;

    const existing = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }

    if (!req.user!.isSuperAdmin && req.user!.companyId && existing.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant mutation denied.' });
    }

    const updated = await prisma.plant.update({
      where: { id: plantId },
      data: {
        plantName: plantName !== undefined ? plantName : existing.plantName,
        location: location !== undefined ? location : existing.location,
        address: address !== undefined ? address : existing.address,
        timezone: timezone !== undefined ? timezone : existing.timezone,
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: updated.companyId,
      plantId: updated.id,
      entity: 'Plant',
      recordId: updated.id,
      action: 'UPDATE',
      oldValues: existing,
      newValues: updated,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/plants/:id/deactivate (With Reversal Authorization Check)
router.post('/:id/deactivate', requireAuth, enforcePlantAccess('params', 'id'), async (req: Request, res: Response) => {
  try {
    const plantId = req.params.id as string;
    const { reason, actionType } = req.body;

    const isReversal = actionType === 'REVERSED';
    const requiredPermission = isReversal ? 'plant:reverse' : 'plant:deactivate';

    if (!req.user!.isSuperAdmin && !req.user!.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Authorized approval requires permission: '${requiredPermission}'`,
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'A mandatory reason is required to deactivate/reverse a Plant.' });
    }

    const targetStatus = isReversal ? 'REVERSED' : 'INACTIVE';

    const existing = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }

    if (!req.user!.isSuperAdmin && req.user!.companyId && existing.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant mutation denied.' });
    }

    const updated = await prisma.plant.update({
      where: { id: plantId },
      data: { status: targetStatus },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: updated.companyId,
      plantId: updated.id,
      entity: 'Plant',
      recordId: updated.id,
      action: isReversal ? 'REVERSE' : 'DEACTIVATE',
      oldValues: existing,
      newValues: updated,
      reason,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.json({ success: true, data: updated, message: `Plant state set to ${targetStatus}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Block hard DELETE
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  res.status(405).json({
    success: false,
    error: 'Destructive DELETE is forbidden. Use POST /plants/:id/deactivate with a mandatory reason instead.',
  });
});

export default router;
