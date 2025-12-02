import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Define permissions for each role
const ROLE_PERMISSIONS = {
  admin: [
    'projects.addEdit',
    'projects.delete',
    'repositories.addEdit',
    'repositories.delete',
    'testSuites.addEdit',
    'testSuites.delete',
    'testCases.addEdit',
    'testCases.delete',
    'testPlans.addEdit',
    'testPlans.delete',
    'testRuns.addEdit',
    'testRuns.delete',
    'documents.addEdit',
    'documents.delete',
    'userManagement.manage',
    'systemSettings.access',
    'systemSettings.manageMenu',
  ],
  manager: [
    'projects.addEdit',
    'projects.delete',
    'repositories.addEdit',
    'repositories.delete',
    'testSuites.addEdit',
    'testSuites.delete',
    'testCases.addEdit',
    'testCases.delete',
    'testPlans.addEdit',
    'testPlans.delete',
    'testRuns.addEdit',
    'testRuns.delete',
    'documents.addEdit',
    'documents.delete',
    'systemSettings.access',
    'systemSettings.manageMenu',
  ],
  tester: [
    'projects.addEdit',
    'repositories.addEdit',
    'testSuites.addEdit',
    'testSuites.delete',
    'testCases.addEdit',
    'testCases.delete',
    'testPlans.addEdit',
    'testPlans.delete',
    'testRuns.addEdit',
    'testRuns.delete',
    'documents.addEdit',
    'documents.delete',
  ],
  developer: [
    'documents.addEdit',
    'documents.delete',
  ],
  guest: [],
};

async function main() {
  console.log('🌱 Starting database seed...');

  // Create roles and permissions
  console.log('📋 Creating roles and permissions...');
  const guardName = 'web'; // Default guard name
  
  const roles: Record<string, any> = {};
  const permissions: Record<string, any> = {};

  // Create all permissions first
  const allPermissions = new Set<string>();
  Object.values(ROLE_PERMISSIONS).forEach(perms => {
    perms.forEach(perm => allPermissions.add(perm));
  });

  for (const permName of allPermissions) {
    const permission = await prisma.permission.upsert({
      where: {
        name_guardName: {
          name: permName,
          guardName,
        },
      },
      update: {},
      create: {
        name: permName,
        guardName,
      },
    });
    permissions[permName] = permission;
    console.log(`  ✅ Permission: ${permName}`);
  }

  // Create roles and assign permissions
  for (const [roleName, rolePerms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: {
        name_guardName: {
          name: roleName,
          guardName,
        },
      },
      update: {},
      create: {
        name: roleName,
        guardName,
      },
    });
    roles[roleName] = role;
    console.log(`  ✅ Role: ${roleName}`);

    // Assign permissions to role
    for (const permName of rolePerms) {
      const permission = permissions[permName];
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            permissionId_roleId: {
              permissionId: permission.id,
              roleId: role.id,
            },
          },
          update: {},
          create: {
            permissionId: permission.id,
            roleId: role.id,
          },
        });
      }
    }
    console.log(`    ✅ Assigned ${rolePerms.length} permissions to ${roleName}`);
  }

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Tenant',
      slug: 'default',
      plan: 'free',
      status: 'active',
      maxUsers: 5,
      maxProjects: 3,
      features: {
        analytics: true,
        api_access: false,
        sso: false,
      },
    },
  });

  console.log('✅ Created default tenant:', tenant.slug);

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const now = new Date();
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@qahub.com' },
    update: {
      // Update fields if user already exists to ensure they have correct values
      name: 'Admin User',
      password: hashedPassword,
      authProvider: 'email',
      isActive: true,
      emailVerifiedAt: now,
      role: 'admin',
      passwordChangedAt: now,
      // Don't update lastLoginAt if it's already set (preserve login history)
    },
    create: {
      name: 'Admin User',
      email: 'admin@qahub.com',
      password: hashedPassword,
      authProvider: 'email',
      isActive: true,
      emailVerifiedAt: now,
      role: 'admin',
      passwordChangedAt: now,
    },
  });

  console.log('✅ Created/Updated admin user:', admin.email);

  // Assign admin role to admin user via RBAC
  if (roles.admin) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: roles.admin.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: roles.admin.id,
      },
    });
    console.log('✅ Assigned admin role to admin user via RBAC');
  }

  // Link admin to tenant
  await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: admin.id,
      role: 'owner',
    },
  });

  console.log('✅ Linked admin to tenant');

  // Create default project
  const project = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      title: 'Default Project',
      description: 'Default project for testing',
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  console.log('✅ Created default project:', project.title);

  // Create default repository
  const repository = await prisma.repository.create({
    data: {
      tenantId: tenant.id,
      projectId: project.id,
      title: 'Default Repository',
      prefix: 'DEF',
      description: 'Default repository for test cases',
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  console.log('✅ Created default repository:', repository.title);

  // Create default suite
  const suite = await prisma.suite.create({
    data: {
      repositoryId: repository.id,
      title: 'Default Suite',
      order: 1,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  console.log('✅ Created default suite:', suite.title);

  // Create sample test case
  const testCase = await prisma.testCase.create({
    data: {
      tenantId: tenant.id,
      suiteId: suite.id,
      title: 'Sample Test Case',
      description: 'This is a sample test case',
      automated: false,
      priority: 2,
      regression: true,
      severity: 'Moderate',
      version: 1,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  console.log('✅ Created sample test case:', testCase.title);

  console.log('🎉 Database seed completed successfully!');
  console.log('\n📝 Default credentials:');
  console.log('   Email: admin@qahub.com');
  console.log('   Password: admin123');
  console.log('   Tenant: default');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

