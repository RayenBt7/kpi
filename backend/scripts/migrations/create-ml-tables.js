const { poolPromise } = require('../../config/database');

async function createMlTables() {
  try {
    const pool = await poolPromise;

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ml_indicator_aliases')
      BEGIN
        CREATE TABLE dbo.ml_indicator_aliases (
          id INT PRIMARY KEY IDENTITY(1,1),
          alias_name NVARCHAR(255) NOT NULL,
          alias_norm NVARCHAR(255) NOT NULL,
          canonical_indicateur NVARCHAR(255) NULL,
          canonical_norm NVARCHAR(255) NULL,
          source_table NVARCHAR(50) NOT NULL DEFAULT 'all',
          status NVARCHAR(30) NOT NULL DEFAULT 'pending',
          note NVARCHAR(500) NULL,
          reviewed_by NVARCHAR(255) NULL,
          reviewed_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME NOT NULL DEFAULT GETDATE()
        );

        CREATE UNIQUE INDEX UX_ml_indicator_aliases_alias_source
          ON dbo.ml_indicator_aliases(alias_norm, source_table);

        CREATE INDEX IX_ml_indicator_aliases_status
          ON dbo.ml_indicator_aliases(status);
      END
    `);

    console.log('Table dbo.ml_indicator_aliases created (or already exists).');
    process.exit(0);
  } catch (err) {
    console.error('Error creating ML tables:', err);
    process.exit(1);
  }
}

createMlTables();
