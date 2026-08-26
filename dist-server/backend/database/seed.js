"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- Starting Database Seeding (Sprint 01 Hardened) ---');
    // 1. Seed Permissions
    const permissionsData = [
        // Auth & Dashboard
        { permissionCode: 'dashboard:view', module: 'Dashboard', action: 'view', description: 'View Dashboard' },
        // Company Master
        { permissionCode: 'company:read', module: 'Company', action: 'read', description: 'Read Companies' },
        { permissionCode: 'company:create', module: 'Company', action: 'create', description: 'Create Company' },
        { permissionCode: 'company:update', module: 'Company', action: 'update', description: 'Update Company' },
        { permissionCode: 'company:deactivate', module: 'Company', action: 'deactivate', description: 'Deactivate Company' },
        { permissionCode: 'company:reverse', module: 'Company', action: 'reverse', description: 'Authorized Reversal of Company' },
        // Plant Master
        { permissionCode: 'plant:read', module: 'Plant', action: 'read', description: 'Read Plants' },
        { permissionCode: 'plant:create', module: 'Plant', action: 'create', description: 'Create Plant' },
        { permissionCode: 'plant:update', module: 'Plant', action: 'update', description: 'Update Plant' },
        { permissionCode: 'plant:deactivate', module: 'Plant', action: 'deactivate', description: 'Deactivate Plant' },
        { permissionCode: 'plant:reverse', module: 'Plant', action: 'reverse', description: 'Authorized Reversal of Plant' },
        // Department Master
        { permissionCode: 'department:read', module: 'Department', action: 'read', description: 'Read Departments' },
        { permissionCode: 'department:create', module: 'Department', action: 'create', description: 'Create Department' },
        { permissionCode: 'department:update', module: 'Department', action: 'update', description: 'Update Department' },
        { permissionCode: 'department:deactivate', module: 'Department', action: 'deactivate', description: 'Deactivate Department' },
        { permissionCode: 'department:reverse', module: 'Department', action: 'reverse', description: 'Authorized Reversal of Department' },
        // User Management
        { permissionCode: 'user:read', module: 'User', action: 'read', description: 'Read Users' },
        { permissionCode: 'user:create', module: 'User', action: 'create', description: 'Create User' },
        { permissionCode: 'user:update', module: 'User', action: 'update', description: 'Update User' },
        { permissionCode: 'user:manage', module: 'User', action: 'manage', description: 'Manage User Roles & Access' },
        // Role & Permission Management
        { permissionCode: 'role:read', module: 'Role', action: 'read', description: 'Read Roles & Permissions' },
        { permissionCode: 'role:manage', module: 'Role', action: 'manage', description: 'Manage Roles & Assign Permissions' },
        // Audit Trail
        { permissionCode: 'audit:read', module: 'Audit', action: 'read', description: 'Read Audit Logs' },
    ];
    const permissionsMap = new Map();
    for (const p of permissionsData) {
        const perm = await prisma.permission.upsert({
            where: { permissionCode: p.permissionCode },
            update: { description: p.description },
            create: p,
        });
        permissionsMap.set(p.permissionCode, perm.id);
    }
    console.log(`Seeded ${permissionsMap.size} permissions.`);
    // 2. Seed Roles
    const rolesData = [
        { roleName: 'Super Admin', description: 'Full System Access across all Companies, Plants, and Departments' },
        { roleName: 'CEO', description: 'Executive level access to all plants and reports' },
        { roleName: 'Plant Head', description: 'Managerial access for assigned plants' },
        { roleName: 'Department Head', description: 'Managerial access for assigned department' },
        { roleName: 'Manager', description: 'Operational management access' },
        { roleName: 'Officer', description: 'Standard operational execution access' },
        { roleName: 'Operator', description: 'Floor execution access' },
        { roleName: 'Viewer', description: 'Read-only access' },
    ];
    const rolesMap = new Map();
    for (const r of rolesData) {
        const role = await prisma.role.upsert({
            where: { roleName: r.roleName },
            update: { description: r.description },
            create: r,
        });
        rolesMap.set(r.roleName, role.id);
    }
    console.log(`Seeded ${rolesMap.size} roles.`);
    // Assign ALL permissions to Super Admin role
    const superAdminRoleId = rolesMap.get('Super Admin');
    for (const permId of permissionsMap.values()) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: superAdminRoleId, permissionId: permId } },
            update: {},
            create: { roleId: superAdminRoleId, permissionId: permId },
        });
    }
    // Assign standard operational permissions to Plant Head role
    const plantHeadRoleId = rolesMap.get('Plant Head');
    const plantHeadPermCodes = [
        'dashboard:view', 'company:read', 'plant:read', 'plant:update', 'plant:deactivate', 'plant:reverse',
        'department:read', 'department:create', 'department:update', 'user:read', 'audit:read'
    ];
    for (const code of plantHeadPermCodes) {
        const permId = permissionsMap.get(code);
        if (permId) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: plantHeadRoleId, permissionId: permId } },
                update: {},
                create: { roleId: plantHeadRoleId, permissionId: permId },
            });
        }
    }
    // 3. Seed Multi-Tenant Companies (Company A & Company B)
    const companyA = await prisma.company.upsert({
        where: { companyCode: 'COMP-01' },
        update: {},
        create: {
            companyCode: 'COMP-01',
            legalName: 'Apex Manufacturing Private Limited',
            displayName: 'Apex Manufacturing (Company A)',
            legalDetails: 'GSTIN: 27AAAAA0000A1Z5 | CIN: U12345MH2024PTC123456',
            status: 'ACTIVE',
        },
    });
    const companyB = await prisma.company.upsert({
        where: { companyCode: 'COMP-02' },
        update: {},
        create: {
            companyCode: 'COMP-02',
            legalName: 'Bharat Components Private Limited',
            displayName: 'Bharat Components (Company B)',
            legalDetails: 'GSTIN: 24BBBBB0000B1Z8 | CIN: U67890GJ2024PTC654321',
            status: 'ACTIVE',
        },
    });
    const plant1 = await prisma.plant.upsert({
        where: { plantCode: 'PLANT-01' },
        update: {},
        create: {
            plantCode: 'PLANT-01',
            companyId: companyA.id,
            plantName: 'Chakan Unit 1 Assembly Plant',
            location: 'Chakan, Pune, MH',
            address: 'Plot 42, MIDC Phase II, Chakan, Pune - 410501',
            timezone: 'Asia/Kolkata',
            status: 'ACTIVE',
        },
    });
    const plant2 = await prisma.plant.upsert({
        where: { plantCode: 'PLANT-02' },
        update: {},
        create: {
            plantCode: 'PLANT-02',
            companyId: companyB.id,
            plantName: 'Sanand Unit 2 Component Factory',
            location: 'Sanand, Ahmedabad, GJ',
            address: 'GIDC Industrial Estate, Sanand, Gujarat - 382110',
            timezone: 'Asia/Kolkata',
            status: 'ACTIVE',
        },
    });
    const dept1 = await prisma.department.upsert({
        where: { departmentCode: 'DEPT-PROD-01' },
        update: {},
        create: {
            departmentCode: 'DEPT-PROD-01',
            plantId: plant1.id,
            departmentName: 'Main Assembly Line 1',
            status: 'ACTIVE',
        },
    });
    // 4. Seed Users for Multi-Tenant Isolation Verification
    const passwordHash = await bcryptjs_1.default.hash('Admin@123', 12);
    // Super Admin User (Global)
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@factory.com' },
        update: { companyId: companyA.id },
        create: {
            email: 'admin@factory.com',
            companyId: companyA.id,
            passwordHash,
            firstName: 'System',
            lastName: 'SuperAdmin',
            phone: '+91 9876543210',
            status: 'ACTIVE',
        },
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRoleId } },
        update: {},
        create: { userId: adminUser.id, roleId: superAdminRoleId },
    });
    await prisma.userPlantAccess.upsert({
        where: { userId_plantId: { userId: adminUser.id, plantId: plant1.id } },
        update: {},
        create: { userId: adminUser.id, plantId: plant1.id },
    });
    // Company A User
    const compAUser = await prisma.user.upsert({
        where: { email: 'plant1.manager@factory.com' },
        update: { companyId: companyA.id },
        create: {
            email: 'plant1.manager@factory.com',
            companyId: companyA.id,
            passwordHash,
            firstName: 'Rajesh',
            lastName: 'Kumar',
            phone: '+91 9876543211',
            status: 'ACTIVE',
        },
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: compAUser.id, roleId: plantHeadRoleId } },
        update: {},
        create: { userId: compAUser.id, roleId: plantHeadRoleId },
    });
    await prisma.userPlantAccess.upsert({
        where: { userId_plantId: { userId: compAUser.id, plantId: plant1.id } },
        update: {},
        create: { userId: compAUser.id, plantId: plant1.id },
    });
    // Company B User (Tenant Isolation Test User)
    const compBUser = await prisma.user.upsert({
        where: { email: 'compb.manager@factory.com' },
        update: { companyId: companyB.id },
        create: {
            email: 'compb.manager@factory.com',
            companyId: companyB.id,
            passwordHash,
            firstName: 'Amit',
            lastName: 'Shah',
            phone: '+91 9876543212',
            status: 'ACTIVE',
        },
    });
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: compBUser.id, roleId: plantHeadRoleId } },
        update: {},
        create: { userId: compBUser.id, roleId: plantHeadRoleId },
    });
    await prisma.userPlantAccess.upsert({
        where: { userId_plantId: { userId: compBUser.id, plantId: plant2.id } },
        update: {},
        create: { userId: compBUser.id, plantId: plant2.id },
    });
    console.log('--- Database Seeding Completed Successfully ---');
}
main()
    .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
