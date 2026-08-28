import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma';

export const JWT_SECRET = process.env.JWT_SECRET || 'project_one_super_secret_jwt_key_2026';

export interface AuthUserPayload {
  id: string;
  email: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  plantIds: string[];
  departmentIds: string[];
  isSuperAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      correlationId?: string;
    }
  }
}

// Helper to extract param/query/body as string
export const extractStringParam = (req: Request, source: 'params' | 'body' | 'query', key: string): string | undefined => {
  const val = req[source]?.[key];
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
};

// Simple In-Memory Rate Limiter Foundation
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
export const rateLimiter = (maxRequests = 100, windowMs = 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (typeof req.ip === 'string' ? req.ip : '127.0.0.1');
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Rate limit exceeded.',
      });
    }

    record.count++;
    next();
  };
};

// Attach Request Correlation ID middleware
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const headerVal = req.headers['x-correlation-id'];
  const correlationId = typeof headerVal === 'string' ? headerVal : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};

// Require JWT Authentication Middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        userPlantAccess: true,
        userDepartmentAccess: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, error: 'User account is inactive or invalid' });
    }

    const roles = user.userRoles.map((ur: any) => ur.role.roleName);
    const isSuperAdmin = roles.includes('Super Admin');

    const permissionSet = new Set<string>();
    user.userRoles.forEach((ur: any) => {
      ur.role.rolePermissions.forEach((rp: any) => {
        permissionSet.add(rp.permission.permissionCode);
      });
    });

    const plantIds = user.userPlantAccess.map((pa: any) => pa.plantId);
    const departmentIds = user.userDepartmentAccess.map((da: any) => da.departmentId);

    req.user = {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions: Array.from(permissionSet),
      plantIds,
      departmentIds,
      isSuperAdmin,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

// RBAC Middleware: Require specific permission
export const requirePermission = (permissionCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.isSuperAdmin || req.user.permissions.includes(permissionCode)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access denied. Required permission: '${permissionCode}'`,
    });
  };
};

// Plant Access Isolation Middleware
export const enforcePlantAccess = (plantIdSource: 'params' | 'body' | 'query' = 'params', paramKey = 'plantId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const targetPlantId = extractStringParam(req, plantIdSource, paramKey);
    if (!targetPlantId) {
      return next();
    }

    if (!req.user.plantIds.includes(targetPlantId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: You do not have access authorization for Plant ID '${targetPlantId}'`,
      });
    }

    next();
  };
};

// Department Access Isolation Middleware
export const enforceDepartmentAccess = (deptIdSource: 'params' | 'body' | 'query' = 'params', paramKey = 'departmentId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const targetDeptId = extractStringParam(req, deptIdSource, paramKey);
    if (!targetDeptId) {
      return next();
    }

    if (!req.user.departmentIds.includes(targetDeptId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: You do not have access authorization for Department ID '${targetDeptId}'`,
      });
    }

    next();
  };
};
