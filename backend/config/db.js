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

async function verifierEtMigrerBase(pool) {
  try {
    const migrationDevisSQL = `
      DECLARE @sql NVARCHAR(MAX) = N'';
      SELECT @sql += N'ALTER TABLE Devis DROP CONSTRAINT ' + QUOTENAME(kc.name) + N';'
      FROM sys.key_constraints kc
      JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
      JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
      WHERE kc.parent_object_id = OBJECT_ID('Devis')
        AND col.name = 'id_demande';

      SELECT @sql += N'DROP INDEX ' + QUOTENAME(i.name) + N' ON Devis;'
      FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
      WHERE i.object_id = OBJECT_ID('Devis')
        AND i.is_unique = 1
        AND i.is_primary_key = 0
        AND i.is_unique_constraint = 0
        AND col.name = 'id_demande';

      IF @sql <> N'' EXEC sp_executesql @sql;
    `;
    await pool.request().query(migrationDevisSQL);

    const migrationTravauxSQL = `
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Travaux') AND name = 'marque_compteur')
        ALTER TABLE Travaux ADD marque_compteur NVARCHAR(50) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Travaux') AND name = 'type_compteur')
        ALTER TABLE Travaux ADD type_compteur NVARCHAR(50) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Travaux') AND name = 'diametre_compteur')
        ALTER TABLE Travaux ADD diametre_compteur NVARCHAR(20) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('MarquesCompteur'))
        CREATE TABLE MarquesCompteur (
          id_marque INT IDENTITY(1,1) PRIMARY KEY,
          libelle NVARCHAR(50) NOT NULL UNIQUE,
          date_creation DATETIME2 NOT NULL DEFAULT SYSDATETIME()
        );
    `;
    await pool.request().query(migrationTravauxSQL);

    const updateViewSQL = `
      CREATE OR ALTER VIEW vw_DemandesSynthese AS
      SELECT
          d.id_demande,
          d.numero_demande,
          d.id_agence,
          d.id_commune,
          d.id_type,
          d.id_demandeur,
          CASE WHEN dem.est_personne_morale = 1 THEN dem.raison_sociale ELSE dem.nom + ' ' + dem.prenom END AS demandeur,
          dem.telephone,
          dem.telephone_secondaire,
          dem.adresse AS adresse_residence,
          a.nom_agence,
          c_res.nom_commune AS nom_commune_residence,
          c.nom_commune AS nom_commune_branchement,
          c.nom_commune,
          d.adresse_branchement,
          d.observations,
          t.libelle AS type_branchement,
          d.statut_actuel,
          s.libelle AS statut_libelle,
          s.ordre AS statut_ordre,
          d.date_depot,
          d.date_maj,
          dv_agg.montant_total AS montant_devis,
          dv_agg.statut_paiement_global AS statut_paiement
      FROM Demandes d
      JOIN Demandeurs dem ON dem.id_demandeur = d.id_demandeur
      JOIN Agences a ON a.id_agence = d.id_agence
      JOIN Communes c ON c.id_commune = d.id_commune
      JOIN Communes c_res ON c_res.id_commune = dem.id_commune
      JOIN TypesBranchement t ON t.id_type = d.id_type
      JOIN Statuts s ON s.code_statut = d.statut_actuel
      LEFT JOIN (
          SELECT
              id_demande,
              SUM(montant) AS montant_total,
              CASE
                  WHEN COUNT(CASE WHEN statut_paiement <> 'PAYE' THEN 1 END) = 0 THEN 'PAYE'
                  ELSE 'IMPAYE'
              END AS statut_paiement_global
          FROM Devis
          GROUP BY id_demande
      ) dv_agg ON dv_agg.id_demande = d.id_demande;
    `;
    await pool.request().query(updateViewSQL);
  } catch (err) {
    console.warn('Avertissement vérification/migration base:', err.message);
  }
}

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(async pool => {
        console.log('Connecté à SQL Server');
        await verifierEtMigrerBase(pool);
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
