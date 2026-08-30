import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/roles
router.get('/', requireAuth, requirePermission('role:read'), async (req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = roles.map((r: any) => ({
      id: r.id,
      roleName: r.roleName,
      description: r.description,
      status: r.status,
      permissions: r.rolePermissions.map((rp: any) => ({
        id: rp.permission.id,
        code: rp.permission.permissionCode,
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/permissions
router.get('/permissions', requireAuth, requirePermission('role:read'), async (req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
    res.json({ success: true, data: permissions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/roles
router.post('/', requireAuth, requirePermission('role:manage'), async (req: Request, res: Response) => {
  try {
    const { roleName, description, permissionIds } = req.body;

    if (!roleName) {
      return res.status(400).json({ success: false, error: 'roleName is required' });
    }

    const existing = await prisma.role.findUnique({ where: { roleName } });
    if (existing) {
      return res.status(400).json({ success: false, error: `Role name '${roleName}' already exists.` });
    }

    const role = await prisma.role.create({
      data: { roleName, description },
    });

    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      for (const permissionId of permissionIds) {
        if (typeof permissionId === 'string') {
          await prisma.rolePermission.create({
            data: { roleId: role.id, permissionId },
          }).catch(() => {});
        }
      }
    }

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: req.user!.companyId || undefined,
      entity: 'Role',
      recordId: role.id,
      action: 'CREATE',
      newValues: { roleName, description, permissionIds },
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.status(201).json({ success: true, data: role });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/roles/:id/permissions
router.put('/:id/permissions', requireAuth, requirePermission('role:manage'), async (req: Request, res: Response) => {
  try {
    const roleId = req.params.id as string;
    const { permissionIds } = req.body;

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ success: false, error: 'permissionIds must be an array' });
    }

    await prisma.rolePermission.deleteMany({ where: { roleId } });

    for (const permissionId of permissionIds) {
      if (typeof permissionId === 'string') {
        await prisma.rolePermission.create({
          data: { roleId, permissionId },
        }).catch(() => {});
      }
    }

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: req.user!.companyId || undefined,
      entity: 'RolePermission',
      recordId: roleId,
      action: 'PERMISSION_CHANGE',
      newValues: { roleId, permissionIds },
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.json({ success: true, message: `Permissions updated for role '${role.roleName}'` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
