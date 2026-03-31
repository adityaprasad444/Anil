const permissionService = require('../services/permission.service');
const catchAsync = require('../utils/catchAsync');

exports.createPermission = catchAsync(async (req, res, next) => {
  const permission = await permissionService.createPermission(req.body);
  res.status(201).json({
    status: 'success',
    data: { permission }
  });
});

exports.getPermissions = catchAsync(async (req, res, next) => {
  const permissions = await permissionService.getAllPermissions();
  res.status(200).json({
    status: 'success',
    results: permissions.length,
    data: { permissions }
  });
});
