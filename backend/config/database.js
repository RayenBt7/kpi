const sql = require('mssql');

const baseConfig = {
    server: process.env.DB_SERVER || 'LAPTOP-H585I2BV\\SQLEXPRESS02',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'rayen123',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const config = {
    ...baseConfig,
    database: process.env.DB_DATABASE || 'kpi'
};

const dwConfig = {
    ...baseConfig,
    database: process.env.DW_DATABASE || 'KPI_DataWarehouse'
};

const readOnlyConfig = {
    ...baseConfig,
    user: process.env.DB_READONLY_USER || process.env.DB_USER || 'sa',
    password: process.env.DB_READONLY_PASSWORD || process.env.DB_PASSWORD || 'rayen123',
    database: process.env.DB_READONLY_DATABASE || process.env.DB_DATABASE || 'kpi',
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then((pool) => {
        console.log('Connected to SQL Server successfully. ✅');
        return pool;
    })
    .catch((err) => {
        console.error('Database connection error:', err);
        process.exit(1);
    });

const dwPoolPromise = new sql.ConnectionPool(dwConfig)
    .connect()
    .then((pool) => {
        console.log('Connected to Data Warehouse successfully. ✅');
        return pool;
    })
    .catch((err) => {
        console.error('Data Warehouse connection error:', err);
    });

const readOnlyPoolPromise = new sql.ConnectionPool(readOnlyConfig)
    .connect()
    .then((pool) => {
        console.log('Connected to SQL Server read-only pool successfully. ✅');
        return pool;
    })
    .catch((err) => {
        console.error('Read-only database connection error:', err);
        return null;
    });

module.exports = {
    sql,
    poolPromise,
    dwPoolPromise,
    readOnlyPoolPromise
};
