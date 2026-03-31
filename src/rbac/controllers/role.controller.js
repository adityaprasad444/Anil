const roleService = require('../services/role.service');
const catchAsync = require('../utils/catchAsync');

exports.createRole = catchAsync(async (req, res, next) => {
  const { tenant_id } = req.user;
  
  const role = await roleService.createRole(req.body, tenant_id);

  res.status(201).json({
    status: 'success',
    data: { role }
  });
});

exports.deleteRole = catchAsync(async (req, res, next) => {
  const { tenant_id } = req.user;
  const { id } = req.params;

  await roleService.deleteRole(id, tenant_id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getRoles = catchAsync(async (req, res, next) => {
  const { tenant_id } = req.user;
  const roles = await roleService.getRolesByTenant(tenant_id);
  
  res.status(200).json({
    status: 'success',
    results: roles.length,
    data: { roles }
  });
});
