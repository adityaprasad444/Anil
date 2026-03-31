const tenantService = require('../services/tenant.service');
const catchAsync = require('../utils/catchAsync');

exports.createTenant = catchAsync(async (req, res, next) => {
  const tenant = await tenantService.createTenant(req.body);
  res.status(201).json({
    status: 'success',
    data: { tenant }
  });
});

exports.getTenants = catchAsync(async (req, res, next) => {
  const tenants = await tenantService.getTenants();
  res.status(200).json({
    status: 'success',
    results: tenants.length,
    data: { tenants }
  });
});
