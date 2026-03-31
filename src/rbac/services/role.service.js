const mongoose = require('mongoose');
const Role = require('../models/Role');
const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const AppError = require('../utils/AppError');

exports.createRole = async (data, tenant_id) => {
  const existingRole = await Role.findOne({ name: data.name, tenant_id }).lean();
  if (existingRole) {
    throw new AppError(`A role named ${data.name} already exists for this tenant.`, 400);
  }
  
  const role = await Role.create({ ...data, tenant_id });
  return role;
};

exports.deleteRole = async (roleId, tenant_id) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const role = await Role.findOne({ _id: roleId, tenant_id }).session(session);
    
    if (!role) throw new AppError('Role not found or access denied.', 404);
    if (role.is_system_role) throw new AppError('Critical system roles cannot be deleted.', 403);
    
    const usersWithRole = await User.exists({ roles: roleId, tenant_id }).session(session);
    if (usersWithRole) {
      throw new AppError('Cannot delete role. It is currently assigned to one or more users.', 400);
    }
    
    await RolePermission.deleteMany({ role_id: roleId }).session(session);
    await Role.deleteOne({ _id: roleId }).session(session);
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

exports.getRolesByTenant = async (tenant_id) => {
  return await Role.find({ tenant_id }).lean();
};
