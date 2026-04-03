const User = require('../../../models/User');
const Role = require('../models/Role');
const AppError = require('../utils/AppError');

exports.assignRoleToUser = async (userId, roleId, tenant_id) => {
  // 1. Find the role - it could be a global role (tenant_id: null) or a regular role (tenant_id exists)
  const role = await Role.findOne({ 
    _id: roleId, 
    $or: [ { tenant_id }, { tenant_id: null } ] 
  }).lean();
  
  if (!role) {
    throw new AppError('Invalid Role or access denied for this tenant.', 404);
  }

  // 2. Find and update the user - they could be a global user (tenant_id: null) or a tenant-specific user
  // Super Admins (tenant_id: null) can assign roles to any user. Regular admins can only assign to their tenant's users.
  const userFilter = { _id: userId };
  if (tenant_id) {
    userFilter.tenant_id = tenant_id;
  }

  const user = await User.findOneAndUpdate(
    userFilter,
    { $addToSet: { roles: roleId } },
    { new: true }
  ).populate('roles');

  if (!user) throw new AppError('User not found or access denied for this tenant.', 404);
  return user;
};
