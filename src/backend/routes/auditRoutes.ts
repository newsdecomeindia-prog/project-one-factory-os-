import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

// GET /api/v1/audit-logs (Tenant Isolated)
router.get('/', requireAuth, requirePermission('audit:read'), async (req: Request, res: Response) => {
  try {
    const { entity, recordId, userId, action, limit = 100 } = req.query;

    const whereClause: any = {
      ...(!req.user!.isSuperAdmin && req.user!.companyId && { companyId: req.user!.companyId }),
    };

    if (entity) whereClause.entity = String(entity);
    if (recordId) whereClause.recordId = String(recordId);
    if (userId) whereClause.userId = String(userId);
    if (action) whereClause.action = String(action);

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { companyCode: true, displayName: true } },
        plant: { select: { plantCode: true, plantName: true } },
        department: { select: { departmentCode: true, departmentName: true } },
      },
    });

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
