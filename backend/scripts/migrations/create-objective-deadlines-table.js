const { poolPromise } = require('../../config/database');

async function createObjectiveDeadlinesTable() {
  try {
    const pool = await poolPromise;

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='objective_deadlines' AND xtype='U')
      CREATE TABLE objective_deadlines (
        id INT IDENTITY(1,1) PRIMARY KEY,
        indicateur NVARCHAR(255) NOT NULL,
        period_type NVARCHAR(50),   -- month / quarter / year
        period_key  NVARCHAR(50),   -- janv / q1 / 2026
        utilis      NVARCHAR(50),   -- user name
        date_limite DATE,
        created_at  DATETIME DEFAULT GETDATE()
      )
    `);

    console.log('Table objective_deadlines created (or already exists).');
    process.exit(0);
  } catch (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
}

createObjectiveDeadlinesTable();
