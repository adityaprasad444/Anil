const RolePermission = require('../models/RolePermission');
const AppError = require('../utils/AppError');

exports.checkPermissions = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const { roles: userRoles } = req.user;
      
      if (!userRoles || userRoles.length === 0) {
        throw new AppError('Access Denied. You have no assigned roles.', 403);
      }

      // Aggregate all permissions from user's assigned roles
      const rolePermissions = await RolePermission.find({ role_id: { $in: userRoles } })
        .populate('permission_id', 'code')
        .lean();

      // Merge and extract flat permission codes
      const userPermissionCodes = new Set(
        rolePermissions.map(rp => rp.permission_id?.code).filter(Boolean)
      );

      // Check for privilege (Must have ALL required perms)
      const hasAllRequired = requiredPermissions.every(code => userPermissionCodes.has(code));

      if (!hasAllRequired) {
        throw new AppError('Forbidden. Insufficient permissions to perform this action.', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
