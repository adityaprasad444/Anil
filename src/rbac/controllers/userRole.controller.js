const userRoleService = require('../services/userRole.service');
const catchAsync = require('../utils/catchAsync');

exports.assignRoleToUser = catchAsync(async (req, res, next) => {
  const { tenant_id } = req.user;
  const { userId } = req.params;
  const { roleId } = req.body;

  const user = await userRoleService.assignRoleToUser(userId, roleId, tenant_id);

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});
