/**
 * scripts/seedAdminRole.js
 * Creates a global 'Super Admin' role and assigns ALL existing permissions to it.
 * Also assigns this role to the root 'admin' user.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');

// Models
const Role = require('../src/rbac/models/Role');
const Permission = require('../src/rbac/models/Permission');
const RolePermission = require('../src/rbac/models/RolePermission');
const User = require('../models/User');

async function seedAdminRole() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected to MongoDB');

  // 1. Create or Find Super Admin Role
  let adminRole = await Role.findOne({ name: 'Super Admin', is_system_role: true });
  if (!adminRole) {
    adminRole = await Role.create({
      name: 'Super Admin',
      description: 'Full system access with all permissions',
      is_system_role: true,
      tenant_id: null // Global role
    });
    console.log('✅ Created Super Admin role');
  }

  // 2. Get All Permissions
  const allPermissions = await Permission.find({});
  console.log(`📊 Found ${allPermissions.length} permissions to assign`);

  // 3. Clear and Re-assign all permissions to Super Admin
  await RolePermission.deleteMany({ role_id: adminRole._id });
  const rolePermDocs = allPermissions.map(p => ({
    role_id: adminRole._id,
    permission_id: p._id
  }));
  await RolePermission.insertMany(rolePermDocs);
  console.log(`✅ Assigned ${rolePermDocs.length} permissions to Super Admin role`);

  // 4. Find the root 'admin' user and assign this role
  const rootAdmin = await User.findOne({ username: 'admin' });
  if (rootAdmin) {
    // Check if the role is already assigned (using string comparison for IDs)
    const hasRole = rootAdmin.roles && rootAdmin.roles.some(r => r.toString() === adminRole._id.toString());
    
    if (!hasRole) {
      if (!rootAdmin.roles) rootAdmin.roles = [];
      rootAdmin.roles.push(adminRole._id);
      await rootAdmin.save();
      console.log('✅ Assigned Super Admin role to the "admin" user');
    } else {
       console.log('⏭  "admin" user already has the Super Admin role');
    }
  } else {
    console.warn('⚠️ Root "admin" user not found in database. Please log in once to create it.');
  }

  await mongoose.disconnect();
  console.log('🎉 Admin seeding complete!');
}

seedAdminRole().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
