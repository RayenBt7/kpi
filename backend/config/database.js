const sql = require('mssql');

// Tedious expects a named instance separately from its host name.
// DB_SERVER accepts either `host` or `host\\instance`; DB_INSTANCE overrides it.
const configuredServer = process.env.DB_SERVER || 'LAPTOP-H585I2BV\\SQLEXPRESS02';
const [serverHost, serverInstance] = configuredServer.split('\\', 2);
const instanceName = process.env.DB_INSTANCE || serverInstance;

const baseConfig = {
    server: serverHost,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'rayen123',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        ...(instanceName ? { instanceName } : {})
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
        console.log('Connected to SQL Server successfully. ?');
        return pool;
    })
    .catch((err) => {
        console.error('Database connection error:', err);
        process.exit(1);
    });

const dwPoolPromise = new sql.ConnectionPool(dwConfig)
    .connect()
    .then((pool) => {
        console.log('Connected to Data Warehouse successfully. ?');
        return pool;
    })
    .catch((err) => {
        console.error('Data Warehouse connection error:', err);
    });

const readOnlyPoolPromise = new sql.ConnectionPool(readOnlyConfig)
    .connect()
    .then((pool) => {
        console.log('Connected to SQL Server read-only pool successfully. ?');
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
