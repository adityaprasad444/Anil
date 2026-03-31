const express = require('express');
const tenantController = require('../controllers/tenant.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { checkPermissions } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(verifyToken);

router
  .route('/')
  .get(checkPermissions(['TENANT_READ']), tenantController.getTenants)
  .post(checkPermissions(['TENANT_CREATE']), tenantController.createTenant);

module.exports = router;
