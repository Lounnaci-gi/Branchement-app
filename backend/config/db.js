const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  connectionString: [
    'Driver={ODBC Driver 18 for SQL Server}',
    `Server=${process.env.DB_SERVER}\\${process.env.DB_INSTANCE}`,
    `Database=${process.env.DB_NAME}`,
    'Trusted_Connection=Yes',
    'TrustServerCertificate=Yes'
  ].join(';'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    trustedConnection: process.env.DB_TRUSTED_CONNECTION === 'true',
    instanceName: process.env.DB_INSTANCE
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log('Connecté à SQL Server');
        return pool;
      })
      .catch(err => {
        console.error('Erreur de connexion SQL Server:', err);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
