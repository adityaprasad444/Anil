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

module.exports = router;
