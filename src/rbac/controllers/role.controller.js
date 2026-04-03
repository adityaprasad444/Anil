const roleService = require('../services/role.service');
const catchAsync = require('../utils/catchAsync');

exports.createRole = catchAsync(async (req, res, next) => {
  // SuperAdmin can pass tenant_id in body; regular users use their own tenant
  const tenant_id = req.user.tenant_id || req.body.tenant_id;
  
  const role = await roleService.createRole(req.body, tenant_id);

  res.status(201).json({
    status: 'success',
    data: { role }
  });
});

exports.deleteRole = catchAsync(async (req, res, next) => {
  const tenant_id = req.user.tenant_id || req.body.tenant_id;
  const { id } = req.params;

  await roleService.deleteRole(id, tenant_id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getRoles = catchAsync(async (req, res, next) => {
  // SuperAdmin (role === 'admin') usually sees all roles globally, 
  // but can filter by tenant_id if provided.
  // Regular users are strictly limited to their own tenant_id.
  
  let roles;
  if (req.user.role === 'admin') {
    const tenant_id = req.query.tenant_id || null;
    roles = tenant_id 
      ? await roleService.getRolesByTenant(tenant_id) 
      : await roleService.getAllRoles();
  } else {
    // Regular tenant users only see their own tenant's roles
    roles = await roleService.getRolesByTenant(req.user.tenant_id);
  }
  
  res.status(200).json({
    status: 'success',
    results: roles.length,
    data: { roles }
  });
});

exports.getRolePermissions = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const permissions = await roleService.getPermissionsForRole(id);
  res.status(200).json({
    status: 'success',
    data: { permissions }
  });
});

exports.setRolePermissions = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { permissionIds } = req.body; // array of permission _id values
  const permissions = await roleService.setPermissionsForRole(id, permissionIds);
  res.status(200).json({
    status: 'success',
    data: { permissions }
  });
});
