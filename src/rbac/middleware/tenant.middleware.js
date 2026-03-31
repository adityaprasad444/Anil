const AppError = require('../utils/AppError');
const Tenant = require('../models/Tenant');

exports.resolveTenant = async (req, res, next) => {
  try {
    // 1. JWT Decoded User takes highest precedence payload
    if (req.user?.tenant_id) {
      req.tenant_id = req.user.tenant_id;
      return next();
    }

    // 2. Fallback to API Header (used typically pre-authentication like login/signup)
    const tenantId = req.headers['x-tenant-id'];
    if (tenantId) {
      const tenant = await Tenant.findById(tenantId).lean();
      if (!tenant || tenant.status !== 'active') {
        throw new AppError('Invalid or inactive tenant ID in headers.', 401);
      }
      req.tenant_id = tenant._id;
      return next();
    }

    throw new AppError('Tenant context is missing. Please provide a valid X-Tenant-ID header or authenticate.', 400);
  } catch (error) {
    next(error);
  }
};
