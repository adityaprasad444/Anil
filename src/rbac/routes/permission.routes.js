const express = require('express');
const permissionController = require('../controllers/permission.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { checkPermissions } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(verifyToken);

router
  .route('/')
  .get(checkPermissions(['PERMISSION_READ']), permissionController.getPermissions)
  .post(checkPermissions(['PERMISSION_CREATE']), permissionController.createPermission);

module.exports = router;
