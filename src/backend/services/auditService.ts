import { prisma } from '../database/prisma';

export interface AuditParams {
  userId?: string;
  userEmail?: string;
  companyId?: string;
  plantId?: string;
  departmentId?: string;
  entity: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'REVERSE' | 'CANCEL' | 'RELEASE' | 'ISSUE' | 'EXECUTE' | 'RECEIVE' | 'LOGIN' | 'LOGOUT' | 'PERMISSION_CHANGE' | 'SECURITY_UNLOCK';
  oldValues?: any;
  newValues?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class AuditService {
  static async log(params: AuditParams) {
    try {
      return await prisma.auditLog.create({
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
    } catch (err) {
      console.error('Audit Service Error:', err);
    }
  }
}
