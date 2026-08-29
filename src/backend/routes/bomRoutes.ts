import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { AuditService } from '../services/auditService';

const router = Router();

// GET /api/v1/boms - List BOMs (Filtered by company/plant scope)
router.get('/', requireAuth, requirePermission('bom:read'), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.isSuperAdmin ? (req.query.companyId as string) : req.user!.companyId;
    const plantId = req.query.plantId as string;

    const boms = await prisma.bomHeader.findMany({
      where: {
        ...(companyId && { companyId }),
        ...(plantId && { plantId }),
      },
      include: {
        finishedMaterial: { select: { id: true, materialCode: true, description: true } },
        plant: { select: { id: true, plantCode: true, plantName: true } },
        company: { select: { id: true, companyCode: true, displayName: true } },
        components: {
          include: {
            componentMaterial: { select: { id: true, materialCode: true, description: true } },
            uom: { select: { id: true, uomCode: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: boms });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/boms/:id - Single BOM Details
router.get('/:id', requireAuth, requirePermission('bom:read'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bom = await prisma.bomHeader.findUnique({
      where: { id: id as string },
      include: {
        finishedMaterial: true,
        plant: true,
        company: true,
        components: {
          include: {
            componentMaterial: true,
            uom: true,
          },
        },
      },
    });

    if (!bom) {
      return res.status(404).json({ success: false, error: 'BOM not found' });
    }

    if (!req.user!.isSuperAdmin && bom.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
    }

    res.json({ success: true, data: bom });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/boms - Create New BOM
router.post('/', requireAuth, requirePermission('bom:create'), async (req: Request, res: Response) => {
  try {
    const { finishedMaterialId, plantId, companyId, components, status } = req.body;

    const targetCompanyId = req.user!.isSuperAdmin ? (companyId || req.user!.companyId) : req.user!.companyId;

    if (!finishedMaterialId || !plantId || !components || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ success: false, error: 'Finished material, plant, and components are required' });
    }

    // Verify finished material
    const finishedMat = await prisma.material.findUnique({ where: { id: finishedMaterialId } });
    if (!finishedMat || finishedMat.companyId !== targetCompanyId) {
      return res.status(400).json({ success: false, error: 'Invalid finished material for target tenant' });
    }

    // Verify plant
    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant || plant.companyId !== targetCompanyId) {
      return res.status(400).json({ success: false, error: 'Invalid plant for target tenant' });
    }

    // Generate unique BOM Number
    const bomCount = await prisma.bomHeader.count();
    const bomNumber = `BOM-${String(bomCount + 1).padStart(5, '0')}`;

    const newBom = await prisma.$transaction(async (tx) => {
      const header = await tx.bomHeader.create({
        data: {
          bomNumber,
          finishedMaterialId,
          version: 1,
          companyId: targetCompanyId!,
          plantId,
          status: status || 'ACTIVE',
          createdBy: req.user!.id,
        },
      });

      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        if (comp.quantityPerUnit <= 0) {
          throw new Error('Component quantity per unit must be greater than zero');
        }

        const compMat = await tx.material.findUnique({ where: { id: comp.componentMaterialId } });
        if (!compMat || compMat.companyId !== targetCompanyId) {
          throw new Error(`Invalid component material ${comp.componentMaterialId}`);
        }

        await tx.bomComponent.create({
          data: {
            bomHeaderId: header.id,
            componentMaterialId: comp.componentMaterialId,
            quantityPerUnit: comp.quantityPerUnit,
            uomId: comp.uomId || compMat.uomId,
            scrapFactor: comp.scrapFactor || 0,
            sequence: i + 1,
            companyId: targetCompanyId!,
            plantId,
            createdBy: req.user!.id,
          },
        });
      }

      return tx.bomHeader.findUnique({
        where: { id: header.id },
        include: { components: true },
      });
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: targetCompanyId,
      plantId,
      entity: 'BomHeader',
      recordId: newBom!.id,
      action: 'CREATE',
      newValues: newBom,
    });

    res.status(201).json({ success: true, data: newBom });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/boms/:id - Update BOM (Creates Revision/Version if already active)
router.put('/:id', requireAuth, requirePermission('bom:update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { components, status } = req.body;

    const existingBom = await prisma.bomHeader.findUnique({
      where: { id: id as string },
      include: { components: true },
    });

    if (!existingBom) {
      return res.status(404).json({ success: false, error: 'BOM not found' });
    }

    if (!req.user!.isSuperAdmin && existingBom.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
    }

    // Controlled revision logic: if existing BOM was ACTIVE and components changed, bump version
    const updated = await prisma.$transaction(async (tx) => {
      let newVersion = existingBom.version;
      if (existingBom.status === 'ACTIVE' && components && components.length > 0) {
        newVersion = existingBom.version + 1;
      }

      const updatedHeader = await tx.bomHeader.update({
        where: { id: id as string },
        data: {
          version: newVersion,
          status: status || existingBom.status,
        },
      });

      if (components && Array.isArray(components)) {
        await tx.bomComponent.deleteMany({ where: { bomHeaderId: id as string } });
        for (let i = 0; i < components.length; i++) {
          const comp = components[i];
          const compMat = await tx.material.findUnique({ where: { id: comp.componentMaterialId } });
          await tx.bomComponent.create({
            data: {
              bomHeaderId: id as string,
              componentMaterialId: comp.componentMaterialId,
              quantityPerUnit: comp.quantityPerUnit,
              uomId: comp.uomId || compMat?.uomId,
              scrapFactor: comp.scrapFactor || 0,
              sequence: i + 1,
              companyId: existingBom.companyId,
              plantId: existingBom.plantId,
              createdBy: req.user!.id,
            },
          });
        }
      }

      return tx.bomHeader.findUnique({
        where: { id: id as string },
        include: { components: true },
      });
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: existingBom.companyId,
      plantId: existingBom.plantId,
      entity: 'BomHeader',
      recordId: id as string,
      action: 'UPDATE',
      oldValues: existingBom,
      newValues: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/v1/boms/:id/deactivate - Deactivate BOM (No Direct Delete)
router.post('/:id/deactivate', requireAuth, requirePermission('bom:deactivate'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return res.status(400).json({ success: false, error: 'Mandatory reason is required for BOM deactivation' });
    }

    const bom = await prisma.bomHeader.findUnique({ where: { id: id as string } });
    if (!bom) {
      return res.status(404).json({ success: false, error: 'BOM not found' });
    }

    if (!req.user!.isSuperAdmin && bom.companyId !== req.user!.companyId) {
      return res.status(403).json({ success: false, error: 'Tenant isolation boundary violation' });
    }

    const updated = await prisma.bomHeader.update({
      where: { id: id as string },
      data: { status: 'INACTIVE' },
    });

    await AuditService.log({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: bom.companyId,
      plantId: bom.plantId,
      entity: 'BomHeader',
      recordId: id as string,
      action: 'DEACTIVATE',
      oldValues: bom,
      newValues: updated,
      reason,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
