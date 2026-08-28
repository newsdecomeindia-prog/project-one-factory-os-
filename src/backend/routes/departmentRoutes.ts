import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission, enforceDepartmentAccess } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/departments (Tenant & Plant Isolated)
router.get('/', requireAuth, requirePermission('department:read'), async (req: Request, res: Response) => {
  try {
    let departments;
    if (req.user!.isSuperAdmin) {
      departments = await prisma.department.findMany({
        include: { plant: { include: { company: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      departments = await prisma.department.findMany({
        where: {
          plant: {
            ...(req.user!.companyId && { companyId: req.user!.companyId }),
            id: { in: req.user!.plantIds },
          },
        },
        include: { plant: { include: { company: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }
    res.json({ success: true, data: departments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/departments/:id
router.get('/:id', requireAuth, requirePermission('department:read'), enforceDepartmentAccess('params', 'id'), async (req: Request, res: Response) => {
  try {
    const departmentId = req.params.id as string;
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { plant: { include: { company: true } } },
    });

    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }

    if (!req.user!.isSuperAdmin && req.user!.companyId && department.plant.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant department access denied.' });
    }

    res.json({ success: true, data: department });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/departments
router.post('/', requireAuth, requirePermission('department:create'), async (req: Request, res: Response) => {
  try {
    const { departmentCode, plantId, departmentName } = req.body;

    if (!departmentCode || !plantId || !departmentName) {
      return res.status(400).json({ success: false, error: 'departmentCode, plantId, and departmentName are required' });
    }

    const plantExists = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plantExists) {
      return res.status(400).json({ success: false, error: `Plant ID '${plantId}' does not exist.` });
    }

    if (!req.user!.isSuperAdmin) {
      if (req.user!.companyId && plantExists.companyId !== req.user!.companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant plant department creation denied.' });
      }
      if (!req.user!.plantIds.includes(plantId)) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to add departments to this plant' });
      }
    }

    const existingCode = await prisma.department.findUnique({ where: { departmentCode } });
    if (existingCode) {
      return res.status(400).json({ success: false, error: `Department code '${departmentCode}' already exists.` });
    }

    const department = await prisma.department.create({
      data: {
        departmentCode,
        plantId,
        departmentName,
      },
    });

    await prisma.userDepartmentAccess.create({
      data: { userId: req.user!.id, departmentId: department.id },
    }).catch(() => {});

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: plantExists.companyId,
      plantId: plantId,
      departmentId: department.id,
      entity: 'Department',
      recordId: department.id,
      action: 'CREATE',
      newValues: department,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.status(201).json({ success: true, data: department });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/departments/:id/deactivate (With Reversal Authorization Check)
router.post('/:id/deactivate', requireAuth, enforceDepartmentAccess('params', 'id'), async (req: Request, res: Response) => {
  try {
    const departmentId = req.params.id as string;
    const { reason, actionType } = req.body;

    const isReversal = actionType === 'REVERSED';
    const requiredPermission = isReversal ? 'department:reverse' : 'department:deactivate';

    if (!req.user!.isSuperAdmin && !req.user!.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Authorized approval requires permission: '${requiredPermission}'`,
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'A mandatory reason is required to deactivate/reverse a Department.' });
    }

    const targetStatus = isReversal ? 'REVERSED' : 'INACTIVE';

    const existing = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { plant: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }

    if (!req.user!.isSuperAdmin && req.user!.companyId && existing.plant.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant department mutation denied.' });
    }

    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: { status: targetStatus },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: existing.plant.companyId,
      plantId: existing.plantId,
      departmentId: updated.id,
      entity: 'Department',
      recordId: updated.id,
      action: isReversal ? 'REVERSE' : 'DEACTIVATE',
      oldValues: existing,
      newValues: updated,
      reason,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.json({ success: true, data: updated, message: `Department state set to ${targetStatus}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Block hard DELETE
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  res.status(405).json({
    success: false,
    error: 'Destructive DELETE is forbidden. Use POST /departments/:id/deactivate with a mandatory reason instead.',
  });
});

export default router;
