const sql = require('mssql');

const config = {
    server: 'LAPTOP-H585I2BV\\SQLEXPRESS02',
    database: 'kpi',
    user: 'sa',
    password: 'rayen123',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function createNotificationsTables() {
    try {
        const pool = await sql.connect(config);
        console.log('Connected to SQL Server ✅');

        // Create notifications table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
            BEGIN
                CREATE TABLE dbo.notifications (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    indicateur NVARCHAR(500) NULL,
                    processus NVARCHAR(255) NULL,
                    type NVARCHAR(50) NOT NULL,
                    destinataire_type NVARCHAR(50) NOT NULL,
                    destinataire_id INT NULL,
                    message NVARCHAR(MAX) NULL,
                    date_creation DATETIME DEFAULT GETDATE(),
                    date_lecture DATETIME NULL,
                    statut NVARCHAR(20) DEFAULT 'non_lue',
                    related_object_id INT NULL,
                    related_object_type NVARCHAR(50) NULL,
                    priorite NVARCHAR(20) DEFAULT 'normale',
                    created_at DATETIME DEFAULT GETDATE(),
                    updated_at DATETIME DEFAULT GETDATE()
                );
                PRINT 'Table dbo.notifications created successfully';
            END
            ELSE
            BEGIN
                PRINT 'Table dbo.notifications already exists';
            END
        `);

        // Create notification_settings table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notification_settings')
            BEGIN
                CREATE TABLE dbo.notification_settings (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    jours_rappel INT DEFAULT 3,
                    jours_action INT DEFAULT 3,
                    jours_escalade INT DEFAULT 3,
                    activer_rappel BIT DEFAULT 1,
                    activer_non_saisie BIT DEFAULT 1,
                    objectif_non_atteint BIT DEFAULT 1,
                    delai_depasse BIT DEFAULT 1,
                    created_at DATETIME DEFAULT GETDATE(),
                    updated_at DATETIME DEFAULT GETDATE()
                );
                
                -- Insert default settings
                INSERT INTO dbo.notification_settings (jours_rappel, jours_action, jours_escalade, activer_rappel, activer_non_saisie, objectif_non_atteint, delai_depasse)
                VALUES (3, 3, 3, 1, 1, 1, 1);
                
                PRINT 'Table dbo.notification_settings created successfully';
            END
            ELSE
            BEGIN
                PRINT 'Table dbo.notification_settings already exists';
            END
        `);

        // Create notification_logs table for tracking
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notification_logs')
            BEGIN
                CREATE TABLE dbo.notification_logs (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    notification_id INT NULL,
                    action NVARCHAR(100) NOT NULL,
                    user_id INT NULL,
                    details NVARCHAR(MAX) NULL,
                    created_at DATETIME DEFAULT GETDATE()
                );
                PRINT 'Table dbo.notification_logs created successfully';
            END
            ELSE
            BEGIN
                PRINT 'Table dbo.notification_logs already exists';
            END
        `);

        console.log('All notification tables created successfully! ✅');
        
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        sql.close();
    }
}

createNotificationsTables();
