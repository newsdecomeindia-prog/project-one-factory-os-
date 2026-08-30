import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

    // Sprint 03 Permissions
    { permissionCode: 'bom:read', module: 'BOM', action: 'read', description: 'Read Bill of Materials' },
    { permissionCode: 'bom:create', module: 'BOM', action: 'create', description: 'Create Bill of Materials' },
    { permissionCode: 'bom:update', module: 'BOM', action: 'update', description: 'Update Bill of Materials' },
    { permissionCode: 'bom:deactivate', module: 'BOM', action: 'deactivate', description: 'Deactivate Bill of Materials' },

    { permissionCode: 'workorder:read', module: 'WorkOrder', action: 'read', description: 'Read Work Orders' },
    { permissionCode: 'workorder:create', module: 'WorkOrder', action: 'create', description: 'Create Work Order' },
    { permissionCode: 'workorder:release', module: 'WorkOrder', action: 'release', description: 'Release Work Order' },
    { permissionCode: 'workorder:cancel', module: 'WorkOrder', action: 'cancel', description: 'Cancel Work Order' },

    { permissionCode: 'materialissue:read', module: 'MaterialIssue', action: 'read', description: 'Read Material Issues' },
    { permissionCode: 'materialissue:create', module: 'MaterialIssue', action: 'create', description: 'Create Material Issue' },

    { permissionCode: 'productionexecution:read', module: 'ProductionExecution', action: 'read', description: 'Read Production Executions' },
    { permissionCode: 'productionexecution:create', module: 'ProductionExecution', action: 'create', description: 'Create Production Execution' },

    { permissionCode: 'productionreceipt:read', module: 'ProductionReceipt', action: 'read', description: 'Read Production Receipts' },
    { permissionCode: 'productionreceipt:create', module: 'ProductionReceipt', action: 'create', description: 'Create Production Receipt' },

    { permissionCode: 'stock:read', module: 'Stock', action: 'read', description: 'Read Stock Balances and Transactions' },

    // Sprint 04 Permissions
    { permissionCode: 'ipqc:read', module: 'IPQC', action: 'read', description: 'Read In-Process QA Inspections' },
    { permissionCode: 'ipqc:create', module: 'IPQC', action: 'create', description: 'Create In-Process QA Inspection' },

    { permissionCode: 'ncr:read', module: 'NCR', action: 'read', description: 'Read Non-Conformance Reports' },
    { permissionCode: 'ncr:create', module: 'NCR', action: 'create', description: 'Create Non-Conformance Report' },
    { permissionCode: 'ncr:disposition', module: 'NCR', action: 'disposition', description: 'Execute NCR Disposition' },

    { permissionCode: 'stocktransfer:read', module: 'StockTransfer', action: 'read', description: 'Read Stock Transfer Orders' },
    { permissionCode: 'stocktransfer:create', module: 'StockTransfer', action: 'create', description: 'Create Stock Transfer Requisition' },
    { permissionCode: 'stocktransfer:approve', module: 'StockTransfer', action: 'approve', description: 'Approve Stock Transfer Requisition' },
    { permissionCode: 'stocktransfer:issue', module: 'StockTransfer', action: 'issue', description: 'Issue Stock Transfer' },
    { permissionCode: 'stocktransfer:receive', module: 'StockTransfer', action: 'receive', description: 'Receive Stock Transfer' },

    // Sprint 05 Permissions
    { permissionCode: 'customer:read', module: 'Customer', action: 'read', description: 'Read Customers' },
    { permissionCode: 'customer:create', module: 'Customer', action: 'create', description: 'Create Customer' },
    { permissionCode: 'customer:update', module: 'Customer', action: 'update', description: 'Update Customer' },

    { permissionCode: 'sales:enquiry', module: 'Sales', action: 'enquiry', description: 'Manage Sales Enquiries' },
    { permissionCode: 'sales:quotation', module: 'Sales', action: 'quotation', description: 'Manage Sales Quotations' },
    { permissionCode: 'sales:order', module: 'Sales', action: 'order', description: 'Manage Sales Orders' },
    { permissionCode: 'sales:approve', module: 'Sales', action: 'approve', description: 'Approve Sales Orders' },
    { permissionCode: 'sales:availability', module: 'Sales', action: 'availability', description: 'Check FG Availability' },
    { permissionCode: 'sales:delivery', module: 'Sales', action: 'delivery', description: 'Manage Delivery Planning' },
    { permissionCode: 'sales:report', module: 'Sales', action: 'report', description: 'Access Sales Reports' },
  ];

  const permissionsMap = new Map<string, string>();
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

  const rolesMap = new Map<string, string>();
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
  const superAdminRoleId = rolesMap.get('Super Admin')!;
  for (const permId of permissionsMap.values()) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRoleId, permissionId: permId } },
      update: {},
      create: { roleId: superAdminRoleId, permissionId: permId },
    });
  }

  // Assign standard operational permissions to Plant Head role
  const plantHeadRoleId = rolesMap.get('Plant Head')!;
  const plantHeadPermCodes = [
    'dashboard:view', 'company:read', 'plant:read', 'plant:update', 'plant:deactivate', 'plant:reverse',
    'department:read', 'department:create', 'department:update', 'user:read', 'audit:read',
    'bom:read', 'bom:create', 'bom:update', 'bom:deactivate',
    'workorder:read', 'workorder:create', 'workorder:release', 'workorder:cancel',
    'materialissue:read', 'materialissue:create',
    'productionexecution:read', 'productionexecution:create',
    'productionreceipt:read', 'productionreceipt:create',
    'stock:read',
    'ipqc:read', 'ipqc:create',
    'ncr:read', 'ncr:create', 'ncr:disposition',
    'stocktransfer:read', 'stocktransfer:create', 'stocktransfer:approve', 'stocktransfer:issue', 'stocktransfer:receive',
    'customer:read', 'customer:create', 'customer:update',
    'sales:enquiry', 'sales:quotation', 'sales:order', 'sales:approve', 'sales:availability', 'sales:delivery', 'sales:report'
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
  const passwordHash = await bcrypt.hash('Admin@123', 12);

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

  // 5. Seed Sprint 03 Master Data for Company A & Plant 1
  const uomPcs = await prisma.uom.upsert({
    where: { companyId_uomCode: { companyId: companyA.id, uomCode: 'PCS' } },
    update: {},
    create: {
      companyId: companyA.id,
      uomCode: 'PCS',
      name: 'Pieces',
      description: 'Standard unit of count',
      status: 'ACTIVE',
    },
  });

  const catRaw = await prisma.materialCategory.upsert({
    where: { companyId_categoryCode: { companyId: companyA.id, categoryCode: 'RAW_MAT' } },
    update: {},
    create: {
      companyId: companyA.id,
      categoryCode: 'RAW_MAT',
      categoryName: 'Raw Materials',
      description: 'Raw components and materials',
      status: 'ACTIVE',
    },
  });

  const catFG = await prisma.materialCategory.upsert({
    where: { companyId_categoryCode: { companyId: companyA.id, categoryCode: 'FINISHED' } },
    update: {},
    create: {
      companyId: companyA.id,
      categoryCode: 'FINISHED',
      categoryName: 'Finished Goods',
      description: 'Finished products ready for stock',
      status: 'ACTIVE',
    },
  });

  const fgA = await prisma.material.upsert({
    where: { companyId_materialCode: { companyId: companyA.id, materialCode: 'FG-A' } },
    update: {},
    create: {
      companyId: companyA.id,
      materialCode: 'FG-A',
      description: 'Finished Assembly Product A',
      categoryId: catFG.id,
      uomId: uomPcs.id,
      materialType: 'FINISHED_GOODS',
      isPurchaseApplicable: false,
      isQaApplicable: true,
      isStockApplicable: true,
      status: 'ACTIVE',
    },
  });

  const rmA = await prisma.material.upsert({
    where: { companyId_materialCode: { companyId: companyA.id, materialCode: 'RM-A' } },
    update: {},
    create: {
      companyId: companyA.id,
      materialCode: 'RM-A',
      description: 'Raw Component Material A',
      categoryId: catRaw.id,
      uomId: uomPcs.id,
      materialType: 'RAW_MATERIAL',
      isPurchaseApplicable: true,
      isQaApplicable: true,
      isStockApplicable: true,
      status: 'ACTIVE',
    },
  });

  const rmB = await prisma.material.upsert({
    where: { companyId_materialCode: { companyId: companyA.id, materialCode: 'RM-B' } },
    update: {},
    create: {
      companyId: companyA.id,
      materialCode: 'RM-B',
      description: 'Raw Component Material B',
      categoryId: catRaw.id,
      uomId: uomPcs.id,
      materialType: 'RAW_MATERIAL',
      isPurchaseApplicable: true,
      isQaApplicable: true,
      isStockApplicable: true,
      status: 'ACTIVE',
    },
  });

  const whMain = await prisma.warehouse.upsert({
    where: { plantId_warehouseCode: { plantId: plant1.id, warehouseCode: 'WH-MAIN' } },
    update: {},
    create: {
      plantId: plant1.id,
      companyId: companyA.id,
      warehouseCode: 'WH-MAIN',
      name: 'Main Plant Warehouse',
      status: 'ACTIVE',
    },
  });

  const whSec = await prisma.warehouse.upsert({
    where: { plantId_warehouseCode: { plantId: plant1.id, warehouseCode: 'WH-SECONDARY' } },
    update: {},
    create: {
      plantId: plant1.id,
      companyId: companyA.id,
      warehouseCode: 'WH-SECONDARY',
      name: 'Secondary Plant Warehouse',
      status: 'ACTIVE',
    },
  });

  const binA1 = await prisma.storageBin.upsert({
    where: { warehouseId_binCode: { warehouseId: whMain.id, binCode: 'BIN-A1' } },
    update: {},
    create: {
      warehouseId: whMain.id,
      plantId: plant1.id,
      companyId: companyA.id,
      binCode: 'BIN-A1',
      name: 'Rack A Bin 1',
      status: 'ACTIVE',
    },
  });

  const binB1 = await prisma.storageBin.upsert({
    where: { warehouseId_binCode: { warehouseId: whSec.id, binCode: 'BIN-B1' } },
    update: {},
    create: {
      warehouseId: whSec.id,
      plantId: plant1.id,
      companyId: companyA.id,
      binCode: 'BIN-B1',
      name: 'Rack B Bin 1',
      status: 'ACTIVE',
    },
  });

  // Seed Initial Stock Balances for RM-A (500) and RM-B (500)
  await prisma.stockBalance.upsert({
    where: { plantId_warehouseId_materialId: { plantId: plant1.id, warehouseId: whMain.id, materialId: rmA.id } },
    update: { quantity: 500 },
    create: {
      companyId: companyA.id,
      plantId: plant1.id,
      warehouseId: whMain.id,
      binId: binA1.id,
      materialId: rmA.id,
      quantity: 500,
    },
  });

  await prisma.stockBalance.upsert({
    where: { plantId_warehouseId_materialId: { plantId: plant1.id, warehouseId: whMain.id, materialId: rmB.id } },
    update: { quantity: 500 },
    create: {
      companyId: companyA.id,
      plantId: plant1.id,
      warehouseId: whMain.id,
      binId: binA1.id,
      materialId: rmB.id,
      quantity: 500,
    },
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
