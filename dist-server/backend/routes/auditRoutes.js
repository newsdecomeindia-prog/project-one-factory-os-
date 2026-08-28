"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../database/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/v1/audit-logs (Tenant Isolated)
router.get('/', auth_1.requireAuth, (0, auth_1.requirePermission)('audit:read'), async (req, res) => {
    try {
        const { entity, recordId, userId, action, limit = 100 } = req.query;
        const whereClause = {
            ...(!req.user.isSuperAdmin && req.user.companyId && { companyId: req.user.companyId }),
        };
        if (entity)
            whereClause.entity = String(entity);
        if (recordId)
            whereClause.recordId = String(recordId);
        if (userId)
            whereClause.userId = String(userId);
        if (action)
            whereClause.action = String(action);
        const logs = await prisma_1.prisma.auditLog.findMany({
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
