"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const prisma_1 = require("../database/prisma");
class AuditService {
    static async log(params) {
        try {
            return await prisma_1.prisma.auditLog.create({
                data: {
                    userId: params.userId || null,
                    userEmail: params.userEmail || null,
                    companyId: params.companyId || null,
                    plantId: params.plantId || null,
                    departmentId: params.departmentId || null,
                    entity: params.entity,
                    recordId: params.recordId,
                    action: params.action,
                    oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
                    newValues: params.newValues ? JSON.stringify(params.newValues) : null,
                    reason: params.reason || null,
                    ipAddress: params.ipAddress || null,
                    userAgent: params.userAgent || null,
                    correlationId: params.correlationId || null,
                },
            });
        }
        catch (err) {
            console.error('Audit Service Error:', err);
        }
    }
}
exports.AuditService = AuditService;
