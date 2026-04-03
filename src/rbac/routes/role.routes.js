const express = require('express');
const roleController = require('../controllers/role.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { checkPermissions } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(verifyToken);

router
  .route('/')
  .get(checkPermissions(['ROLE_READ']), roleController.getRoles)
  .post(checkPermissions(['ROLE_CREATE']), roleController.createRole);

router
  .route('/:id')
  .delete(checkPermissions(['ROLE_DELETE']), roleController.deleteRole);

// Permission assignment on a role
router
  .route('/:id/permissions')
  .get(checkPermissions(['ROLE_READ']), roleController.getRolePermissions)
  .put(checkPermissions(['ROLE_CREATE']), roleController.setRolePermissions);

module.exports = router;
