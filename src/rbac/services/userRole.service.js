const User = require('../models/User');
const Role = require('../models/Role');
const AppError = require('../utils/AppError');

exports.assignRoleToUser = async (userId, roleId, tenant_id) => {
  const role = await Role.findOne({ _id: roleId, tenant_id }).lean();
  if (!role) throw new AppError('Invalid Role or access denied.', 404);

  const user = await User.findOneAndUpdate(
    { _id: userId, tenant_id },
    { $addToSet: { roles: roleId } },
    { new: true }
  ).populate('roles');

  if (!user) throw new AppError('User not found.', 404);
  return user;
};
