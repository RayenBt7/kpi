const UserPermission = require('../models/UserPermission');
const User = require('../models/User');

// GET /api/admin/permissions - Get all permissions with user info
const getAllPermissions = async (req, res) => {
    try {
        const permissions = await UserPermission.getAllWithUsers();
        res.json({ permissions });
    } catch (error) {
        console.error('Error getting permissions:', error);
        res.status(500).json({ error: 'Failed to get permissions', details: error.message });
    }
};

// GET /api/admin/permissions/users - Get all users for permission assignment
const getAllUsersForPermissions = async (req, res) => {
    try {
        const users = await User.getAll();
        res.json({ users });
    } catch (error) {
        console.error('Error getting users for permissions:', error);
        res.status(500).json({ error: 'Failed to get users', details: error.message });
    }
};

// GET /api/admin/permissions/processus - Get all unique processus
const getAllProcessus = async (req, res) => {
    try {
        const processusList = await UserPermission.getAllProcessus();
        res.json({ processus: processusList });
    } catch (error) {
        console.error('Error getting processus:', error);
        res.status(500).json({ error: 'Failed to get processus', details: error.message });
    }
};

// GET /api/admin/permissions/indicateurs/:processus - Get indicateurs for a specific processus
const getIndicateursByProcessus = async (req, res) => {
    try {
        const { processus } = req.params;
        const indicateurs = await UserPermission.getIndicateursByProcessus(processus);
        res.json({ indicateurs });
    } catch (error) {
        console.error('Error getting indicateurs:', error);
        res.status(500).json({ error: 'Failed to get indicateurs', details: error.message });
    }
};

// POST /api/admin/permissions - Add permission for user
const addPermission = async (req, res) => {
    try {
        const { userId, processus, indicateur } = req.body;

        // Validate required fields
        if (!userId || !processus || !indicateur) {
            return res.status(400).json({ error: 'User ID, processus, and indicateur are required' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Add permission
        await UserPermission.addPermission(userId, processus, indicateur);

        res.json({ message: 'Permission added successfully' });
    } catch (error) {
        console.error('Error adding permission:', error);
        res.status(500).json({ error: 'Failed to add permission', details: error.message });
    }
};

// DELETE /api/admin/permissions/:id - Remove permission
const removePermission = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get permission details before deleting
        const permissions = await UserPermission.getAllWithUsers();
        const permission = permissions.find(p => p.id === parseInt(id));
        
        if (!permission) {
            return res.status(404).json({ error: 'Permission not found' });
        }

        // Remove permission
        await UserPermission.removePermission(permission.user_id, permission.processus, permission.indicateur);

        res.json({ message: 'Permission removed successfully' });
    } catch (error) {
        console.error('Error removing permission:', error);
        res.status(500).json({ error: 'Failed to remove permission', details: error.message });
    }
};

// GET /api/admin/permissions/users/:processus/:indicateur - Get users with specific permission
const getUsersByPermission = async (req, res) => {
    try {
        const { processus, indicateur } = req.params;
        const users = await UserPermission.getUsersByPermission(processus, indicateur);
        res.json({ users });
    } catch (error) {
        console.error('Error getting users by permission:', error);
        res.status(500).json({ error: 'Failed to get users', details: error.message });
    }
};

module.exports = {
    getAllPermissions,
    getAllUsersForPermissions,
    getAllProcessus,
    getIndicateursByProcessus,
    addPermission,
    removePermission,
    getUsersByPermission
};