const sql = require('mssql');
const { poolPromise } = require('../../config/database');

async function createPermissionsTable() {
  try {
    const pool = await poolPromise;
    
    // Create the user_permissions table
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_permissions' AND xtype='U')
      BEGIN
        CREATE TABLE user_permissions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
          processus VARCHAR(255) NOT NULL,
          indicateur VARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          UNIQUE(user_id, processus, indicateur)
        )
        PRINT 'Table user_permissions créée avec succès !'
      END
      ELSE
      BEGIN
        PRINT 'Table user_permissions existe déjà !'
      END
    `;
    
    await pool.request().query(createTableQuery);
    
    // Verify the table was created
    const verifyQuery = `
      SELECT 
        t.name AS table_name,
        c.name AS column_name,
        ty.name AS data_type,
        c.max_length,
        c.is_nullable
      FROM sys.tables t
      INNER JOIN sys.columns c ON t.object_id = c.object_id
      INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      WHERE t.name = 'user_permissions'
      ORDER BY c.column_id
    `;
    
    const result = await pool.request().query(verifyQuery);
    
    console.log('Structure de la table user_permissions :');
    result.recordset.forEach(row => {
      console.log(`${row.column_name} (${row.data_type})`);
    });
    
    console.log('\n✅ Table user_permissions prête à l\'emploi !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table :', error);
  }
}

createPermissionsTable();
