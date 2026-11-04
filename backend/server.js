require('dotenv').config();

const express = require('express');
const cron = require('node-cron');
const { poolPromise } = require('./config/database');

const notificationService = require('./services/notificationService');
const mlPipelineService = require('./services/mlPipelineService');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const indicateursRoutes = require('./routes/indicateurs');
const indicateurAnneeRoutes = require('./routes/dashboard');
const objectivesRoutes = require('./routes/objectives');
const realisesRoutes = require('./routes/realises');
const actionsRoutes = require('./routes/actions');
const responsabilitesRoutes = require('./routes/responsabilites');
const dashboardRoutes = require('./routes/dashboard');
const permissionRoutes = require('./routes/permissions');
const passwordResetRoutes = require('./routes/passwordReset');
const notificationsRoutes = require('./routes/notifications');
const mlRoutes = require('./routes/ml');
const ollamaRoutes = require('./routes/ollama');
const Dw_mlRoutes = require('./routes/Dw_ml');
const contactRoutes = require('./routes/contact');
const app = express();
const PORT = process.env.PORT || 4000;

// Run automatic notification checks every day at 01:35.
//            min:hr 
cron.schedule('08 12 * * *', async () => {
    console.log('Execution des verifications de notification automatiques...');

    try {
        await notificationService.runAllChecks();
    } catch (error) {
        console.error('Notification cron failed:', error);
    }
});

const mlEtlCron = process.env.ML_ETL_CRON || '45 02 * * *';
if (mlEtlCron.toLowerCase() !== 'disabled') {
    cron.schedule(mlEtlCron, async () => {
        console.log('Execution du cron ETL ML...');

        try {
            await mlPipelineService.runEtl();
        } catch (error) {
            console.error('ML ETL cron failed:', error);
        }
    });
}
      
 
// Optional startup run kept disabled to avoid heavy work on every reboot.
/*
setTimeout(() => {
    console.log('Execution initiale des verifications de notification...');
    notificationService.runAllChecks();
}, 10000);
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }

    next();
});

app.get('/api/test-db', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            throw new Error('Aucune connexion a la base de donnees');
        }

        const result = await pool.request().query('SELECT 1 AS test');
        res.json({
            message: 'Connexion a la base de donnees reussie',
            result: result.recordset
        });
    } catch (error) {
        console.error('Erreur lors du test DB :', error);
        res.status(500).json({
            error: 'Echec de la connexion ou de la requete',
            details: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Le serveur tourne' });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/permissions', permissionRoutes);
app.use('/api/indicateurs', indicateursRoutes);
app.use('/api/dashboard', indicateurAnneeRoutes);
app.use('/api/objectives', objectivesRoutes);
app.use('/api/realises', realisesRoutes);
app.use('/api/actions', actionsRoutes);
app.use('/api/responsables', responsabilitesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/ollama', ollamaRoutes);
app.use('/api/Dw_ml', Dw_mlRoutes);
app.use('/api', contactRoutes);
app.listen(PORT, () => {
    console.log(`Serveur demarre sur http://localhost:${PORT}`);
    console.log('Environnement :', process.env.NODE_ENV || 'development');
});

module.exports = app;
