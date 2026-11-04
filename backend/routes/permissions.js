const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const {
    getAllPermissions,
    getAllUsersForPermissions,
    getAllProcessus,
    getIndicateursByProcessus,
    addPermission,
    removePermission,
    getUsersByPermission
} = require('../controllers/permissionController');

// All permission routes require authentication
router.use(authMiddleware);

// GET /api/admin/permissions - Get all permissions with user info
router.get('/', adminMiddleware, getAllPermissions);

// GET /api/admin/permissions/users - Get all users for permission assignment
router.get('/users', adminMiddleware, getAllUsersForPermissions);

// GET /api/admin/permissions/processus - Get all unique processus
router.get('/processus', adminMiddleware, getAllProcessus);

// GET /api/admin/permissions/indicateurs/:processus - Get indicateurs for a specific processus
router.get('/indicateurs/:processus', adminMiddleware, getIndicateursByProcessus);

// POST /api/admin/permissions - Add permission for user
router.post('/', adminMiddleware, addPermission);

// DELETE /api/admin/permissions/:id - Remove permission
router.delete('/:id', adminMiddleware, removePermission);

// GET /api/admin/permissions/users/:processus/:indicateur - Get users with specific permission
router.get('/users/:processus/:indicateur', adminMiddleware, getUsersByPermission);

module.exports = router;