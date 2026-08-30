import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/companies
router.get('/', requireAuth, requirePermission('company:read'), async (req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      where: {
        ...(!req.user!.isSuperAdmin && req.user!.companyId && { id: req.user!.companyId }),
      },
      orderBy: { createdAt: 'desc' },
      include: { plants: true },
    });
    res.json({ success: true, data: companies });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/companies/:id
router.get('/:id', requireAuth, requirePermission('company:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;

    if (!req.user!.isSuperAdmin && req.user!.companyId && companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant company access denied.' });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { plants: true },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    res.json({ success: true, data: company });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/companies
router.post('/', requireAuth, requirePermission('company:create'), async (req: Request, res: Response) => {
  try {
    const { companyCode, legalName, displayName, legalDetails } = req.body;

    if (!companyCode || !legalName || !displayName) {
      return res.status(400).json({ success: false, error: 'companyCode, legalName, and displayName are required' });
    }

    const existingCode = await prisma.company.findUnique({ where: { companyCode } });
    if (existingCode) {
      return res.status(400).json({ success: false, error: `Company code '${companyCode}' already exists.` });
    }

    const company = await prisma.company.create({
      data: {
        companyCode,
        legalName,
        displayName,
        legalDetails,
        createdBy: req.user!.id,
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: company.id,
      entity: 'Company',
      recordId: company.id,
      action: 'CREATE',
      newValues: company,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.status(201).json({ success: true, data: company });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/companies/:id
router.put('/:id', requireAuth, requirePermission('company:update'), async (req: Request, res: Response) => {
  try {
    const { legalName, displayName, legalDetails } = req.body;
    const companyId = req.params.id as string;

    if (!req.user!.isSuperAdmin && req.user!.companyId && companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant company mutation denied.' });
    }

    const existing = await prisma.company.findUnique({ where: { id: companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        legalName: legalName !== undefined ? legalName : existing.legalName,
        displayName: displayName !== undefined ? displayName : existing.displayName,
        legalDetails: legalDetails !== undefined ? legalDetails : existing.legalDetails,
        updatedBy: req.user!.id,
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: updated.id,
      entity: 'Company',
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

// POST /api/v1/companies/:id/deactivate (With Reversal Authorization Check)
router.post('/:id/deactivate', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const { reason, actionType } = req.body;

    const isReversal = actionType === 'REVERSED';
    const requiredPermission = isReversal ? 'company:reverse' : 'company:deactivate';

    if (!req.user!.isSuperAdmin && !req.user!.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Authorized approval requires permission: '${requiredPermission}'`,
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'A mandatory reason is required to deactivate/reverse a Company.' });
    }

    const targetStatus = isReversal ? 'REVERSED' : 'INACTIVE';

    if (!req.user!.isSuperAdmin && req.user!.companyId && companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant company mutation denied.' });
    }

    const existing = await prisma.company.findUnique({ where: { id: companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        status: targetStatus,
        updatedBy: req.user!.id,
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: updated.id,
      entity: 'Company',
      recordId: updated.id,
      action: isReversal ? 'REVERSE' : 'DEACTIVATE',
      oldValues: existing,
      newValues: updated,
      reason,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      correlationId: req.correlationId,
    });

    res.json({ success: true, data: updated, message: `Company state set to ${targetStatus}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Block hard DELETE
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  res.status(405).json({
    success: false,
    error: 'Destructive DELETE is forbidden. Use POST /companies/:id/deactivate with a mandatory reason instead.',
  });
});

export default router;
