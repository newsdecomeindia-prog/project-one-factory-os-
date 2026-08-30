import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma';
import { requireAuth, JWT_SECRET } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        company: true,
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        userPlantAccess: { include: { plant: true } },
        userDepartmentAccess: { include: { department: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: jwt.sign({ userId: user.id, ts: Date.now() }, JWT_SECRET),
        ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const roles = user.userRoles.map((ur: any) => ur.role.roleName);
    const permissionSet = new Set<string>();
    user.userRoles.forEach((ur: any) => {
      ur.role.rolePermissions.forEach((rp: any) => {
        permissionSet.add(rp.permission.permissionCode);
      });
    });

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      companyId: user.companyId || undefined,
      entity: 'User',
      recordId: user.id,
      action: 'LOGIN',
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          companyId: user.companyId,
          companyName: user.company?.displayName || 'System Wide',
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          roles,
          permissions: Array.from(permissionSet),
          plants: user.userPlantAccess.map((pa: any) => ({ id: pa.plant.id, code: pa.plant.plantCode, name: pa.plant.plantName })),
          departments: user.userDepartmentAccess.map((da: any) => ({ id: da.department.id, code: da.department.departmentCode, name: da.department.departmentName })),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  if (req.user) {
    await AuditService.log({
      userId: req.user.id,
      userEmail: req.user.email,
      companyId: req.user.companyId || undefined,
      entity: 'User',
      recordId: req.user.id,
      action: 'LOGOUT',
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      correlationId: req.correlationId,
    });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/v1/auth/revoke-session
router.post('/revoke-session', requireAuth, async (req: Request, res: Response) => {
  const { targetUserId } = req.body;
  const targetId = targetUserId || req.user!.id;

  await prisma.userSession.updateMany({
    where: { userId: targetId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await AuditService.log({
    userId: req.user!.id,
    userEmail: req.user!.email,
    companyId: req.user!.companyId || undefined,
    entity: 'UserSession',
    recordId: targetId,
    action: 'DEACTIVATE',
    reason: 'Session revoked via security controller',
    correlationId: req.correlationId,
  });

  res.json({ success: true, message: `Active sessions revoked for user ${targetId}` });
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        company: true,
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        userPlantAccess: { include: { plant: true } },
        userDepartmentAccess: { include: { department: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const roles = user.userRoles.map((ur: any) => ur.role.roleName);
    const permissionSet = new Set<string>();
    user.userRoles.forEach((ur: any) => {
      ur.role.rolePermissions.forEach((rp: any) => {
        permissionSet.add(rp.permission.permissionCode);
      });
    });

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        companyId: user.companyId,
        companyName: user.company?.displayName || 'System Wide',
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        roles,
        permissions: Array.from(permissionSet),
        plants: user.userPlantAccess.map((pa: any) => ({ id: pa.plant.id, code: pa.plant.plantCode, name: pa.plant.plantName })),
        departments: user.userDepartmentAccess.map((da: any) => ({ id: da.department.id, code: da.department.departmentCode, name: da.department.departmentName })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
