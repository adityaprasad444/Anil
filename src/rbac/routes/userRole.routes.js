const express = require('express');
const userRoleController = require('../controllers/userRole.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { checkPermissions } = require('../middleware/rbac.middleware');

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

// Assuming mount path like /api/users/:userId/roles
router
  .route('/')
  .post(checkPermissions(['USER_ROLE_ASSIGN']), userRoleController.assignRoleToUser);

module.exports = router;
