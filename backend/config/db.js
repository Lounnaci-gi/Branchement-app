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

    const migrationArticlesSQL = `
      IF OBJECT_ID('dbo.FamillesArticles', 'U') IS NULL
      BEGIN
        CREATE TABLE FamillesArticles (
          id_famille INT IDENTITY(1,1) PRIMARY KEY,
          code_famille NVARCHAR(50) NOT NULL UNIQUE,
          libelle NVARCHAR(100) NOT NULL,
          actif BIT NOT NULL DEFAULT 1
        );
      END;
      IF OBJECT_ID('dbo.ArticlesDevis', 'U') IS NULL
      BEGIN
        CREATE TABLE ArticlesDevis (
          id_article INT IDENTITY(1,1) PRIMARY KEY,
          id_famille INT NOT NULL REFERENCES FamillesArticles(id_famille),
          code_article NVARCHAR(50) NOT NULL UNIQUE,
          libelle NVARCHAR(150) NOT NULL,
          matiere NVARCHAR(50) NULL,
          couleur NVARCHAR(50) NULL,
          unite NVARCHAR(20) NOT NULL,
          mode_prix NVARCHAR(20) NOT NULL DEFAULT N'FOURNITURE_POSE' CONSTRAINT CK_ArticlesDevis_ModePrix CHECK (mode_prix IN (N'PRESTATION', N'FOURNITURE_POSE')),
          prix_unitaire DECIMAL(12,2) NOT NULL CONSTRAINT CK_ArticlesDevis_Prix CHECK (prix_unitaire >= 0),
          prix_fourniture DECIMAL(12,2) NULL,
          prix_pose DECIMAL(12,2) NULL,
          type_tva NVARCHAR(20) NOT NULL DEFAULT N'PRESTATION',
          taux_tva DECIMAL(5,2) NOT NULL DEFAULT 19,
          actif BIT NOT NULL DEFAULT 1
        );
      END;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'matiere')
        ALTER TABLE ArticlesDevis ADD matiere NVARCHAR(50) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'couleur')
        ALTER TABLE ArticlesDevis ADD couleur NVARCHAR(50) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'mode_prix')
        ALTER TABLE ArticlesDevis ADD mode_prix NVARCHAR(20) NOT NULL CONSTRAINT DF_ArticlesDevis_ModePrix DEFAULT N'PRESTATION';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'prix_fourniture')
        ALTER TABLE ArticlesDevis ADD prix_fourniture DECIMAL(12,2) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'prix_pose')
        ALTER TABLE ArticlesDevis ADD prix_pose DECIMAL(12,2) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'type_tva')
        ALTER TABLE ArticlesDevis ADD type_tva NVARCHAR(20) NOT NULL CONSTRAINT DF_ArticlesDevis_TypeTva DEFAULT N'PRESTATION';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'taux_tva')
        ALTER TABLE ArticlesDevis ADD taux_tva DECIMAL(5,2) NOT NULL CONSTRAINT DF_ArticlesDevis_TauxTva DEFAULT 19;
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ArticlesDevis_ModePrix')
        ALTER TABLE ArticlesDevis ADD CONSTRAINT CK_ArticlesDevis_ModePrix CHECK (mode_prix IN (N'PRESTATION', N'FOURNITURE_POSE'));
      IF NOT EXISTS (SELECT 1 FROM FamillesArticles)
      BEGIN
        INSERT INTO FamillesArticles (code_famille, libelle) VALUES
          (N'RACCORDEMENTS', N'Raccordements'),
          (N'MATERIEL', N'Matériel de pose'),
          (N'TRAVAUX', N'Travaux / main d’œuvre');

        INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
        SELECT f.id_famille, a.code_article, a.libelle, a.unite, a.mode_prix, a.prix_unitaire, a.prix_fourniture, a.prix_pose
        FROM (VALUES
          (N'RACCORDEMENTS', N'RAC-110', N'Raccord 110 mm', N'U', N'FOURNITURE_POSE', CAST(25000 AS DECIMAL(12,2)), CAST(25000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
          (N'RACCORDEMENTS', N'RAC-160', N'Raccord 160 mm', N'U', N'FOURNITURE_POSE', CAST(32000 AS DECIMAL(12,2)), CAST(32000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
          (N'RACCORDEMENTS', N'VAN-050', N'Vanne 50 mm', N'U', N'FOURNITURE_POSE', CAST(18000 AS DECIMAL(12,2)), CAST(18000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
          (N'RACCORDEMENTS', N'VAN-100', N'Vanne 100 mm', N'U', N'FOURNITURE_POSE', CAST(26000 AS DECIMAL(12,2)), CAST(26000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
          (N'MATERIEL', N'MAT-C', N'Coffret de branchement', N'U', N'FOURNITURE_POSE', CAST(14500 AS DECIMAL(12,2)), CAST(14500 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
          (N'MATERIEL', N'MAT-P', N'Pieds / supports', N'U', N'FOURNITURE_POSE', CAST(7000 AS DECIMAL(12,2)), CAST(7000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
          (N'MATERIEL', N'MAT-S', N'Système de sécurité', N'U', N'FOURNITURE_POSE', CAST(12000 AS DECIMAL(12,2)), CAST(12000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
          (N'TRAVAUX', N'TR-FO', N'Fouille / terrassement', N'ML', N'FOURNITURE_POSE', CAST(5500 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2)), CAST(5500 AS DECIMAL(12,2))),
          (N'TRAVAUX', N'TR-RE', N'Réseau et branchement', N'ML', N'FOURNITURE_POSE', CAST(4200 AS DECIMAL(12,2)), CAST(2500 AS DECIMAL(12,2)), CAST(1700 AS DECIMAL(12,2))),
          (N'TRAVAUX', N'TR-PO', N'Pose / raccordement', N'U', N'FOURNITURE_POSE', CAST(18000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2)), CAST(18000 AS DECIMAL(12,2)))
        ) a(code_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
        INNER JOIN FamillesArticles f ON f.code_famille = a.code_famille;
      END;
      UPDATE ArticlesDevis
      SET unite = CASE UPPER(unite)
        WHEN N'U' THEN N'U'
        WHEN N'M' THEN N'ML'
        WHEN N'ML' THEN N'ML'
        WHEN N'M2' THEN N'M²'
        WHEN N'M3' THEN N'M3'
        WHEN N'KG' THEN N'KG'
        ELSE unite
      END;
      UPDATE ArticlesDevis
      SET mode_prix = N'FOURNITURE_POSE', prix_fourniture = 2500, prix_pose = 1700
      WHERE code_article = N'TR-RE';
      UPDATE ArticlesDevis SET type_tva = N'TRAVAUX' WHERE code_article = N'TR-RE';
      UPDATE ArticlesDevis
      SET mode_prix = N'FOURNITURE_POSE', prix_fourniture = 1800, prix_pose = 1000
      WHERE code_article = N'MAT-DA';
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ArticlesDevis_Unite')
        ALTER TABLE ArticlesDevis ADD CONSTRAINT CK_ArticlesDevis_Unite CHECK (unite IN (N'U', N'ML', N'M²', N'M3', N'KG', N'H', N'FF', N'ENS'));
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ArticlesDevis_Unite')
      BEGIN
        ALTER TABLE ArticlesDevis DROP CONSTRAINT CK_ArticlesDevis_Unite;
        ALTER TABLE ArticlesDevis ADD CONSTRAINT CK_ArticlesDevis_Unite CHECK (unite IN (N'U', N'ML', N'M²', N'M3', N'KG', N'H', N'FF', N'ENS'));
      END;
      INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
      SELECT f.id_famille, a.code_article, a.libelle, a.unite, a.mode_prix, a.prix_unitaire, a.prix_fourniture, a.prix_pose
      FROM (VALUES
        (N'MATERIEL', N'MAT-DA', N'Dalle de protection', N'M²', N'FOURNITURE_POSE', CAST(2800 AS DECIMAL(12,2)), CAST(1800 AS DECIMAL(12,2)), CAST(1000 AS DECIMAL(12,2))),
        (N'MATERIEL', N'MAT-SB', N'Sable de remblai', N'M3', N'FOURNITURE_POSE', CAST(3200 AS DECIMAL(12,2)), CAST(3200 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
        (N'MATERIEL', N'MAT-CI', N'Ciment', N'KG', N'FOURNITURE_POSE', CAST(95 AS DECIMAL(12,2)), CAST(95 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2)))
      ) a(code_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
      INNER JOIN FamillesArticles f ON f.code_famille = a.code_famille
      WHERE NOT EXISTS (SELECT 1 FROM ArticlesDevis d WHERE d.code_article = a.code_article);
      IF OBJECT_ID('dbo.TarifsArticlesDevis', 'U') IS NULL
      BEGIN
        CREATE TABLE TarifsArticlesDevis (
          id_tarif INT IDENTITY(1,1) PRIMARY KEY,
          id_article INT NOT NULL REFERENCES ArticlesDevis(id_article),
          mode_prix NVARCHAR(20) NOT NULL,
          prix_unitaire DECIMAL(12,2) NOT NULL,
          prix_fourniture DECIMAL(12,2) NULL,
          prix_pose DECIMAL(12,2) NULL,
          type_tva NVARCHAR(20) NOT NULL,
          taux_tva DECIMAL(5,2) NOT NULL,
          date_debut DATE NOT NULL,
          date_fin DATE NULL
        );
      END;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'avec_diametre')
      BEGIN
        ALTER TABLE ArticlesDevis ADD avec_diametre BIT NOT NULL CONSTRAINT DF_ArticlesDevis_AvecDiametre DEFAULT 0;
        -- Activer avec_diametre pour les articles de raccordement, vannes, tuyaux / conduites
        UPDATE ArticlesDevis
        SET avec_diametre = 1
        WHERE code_article LIKE 'RAC-%'
           OR code_article LIKE 'VAN-%'
           OR code_article LIKE 'TR-RE%'
           OR libelle LIKE '%Raccord%'
           OR libelle LIKE '%Vanne%'
           OR libelle LIKE '%Tuyau%'
           OR libelle LIKE '%Conduite%'
           OR libelle LIKE '%PEHD%'
           OR libelle LIKE '%Compteur%';
      END;
      IF NOT EXISTS (SELECT 1 FROM TarifsArticlesDevis)
      BEGIN
        INSERT INTO TarifsArticlesDevis (id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, date_debut)
        SELECT id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, CONVERT(date, GETDATE())
        FROM ArticlesDevis;
      END;
    `;
    await pool.request().query(migrationArticlesSQL);

    const migrationVerrouillageSQL = `
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Demandes') AND name = 'est_verrouillee')
        ALTER TABLE Demandes ADD est_verrouillee BIT NOT NULL DEFAULT 0;

      IF NOT EXISTS (SELECT 1 FROM Statuts WHERE code_statut = 'SCELLEE')
        INSERT INTO Statuts (code_statut, libelle, ordre, est_final)
        VALUES ('SCELLEE', N'Demande scellée', 8, 1);

      IF OBJECT_ID('dbo.HistoriqueModificationsDemandes', 'U') IS NULL
      BEGIN
        CREATE TABLE HistoriqueModificationsDemandes (
          id_historique_modification INT IDENTITY(1,1) PRIMARY KEY,
          id_demande INT NOT NULL REFERENCES Demandes(id_demande),
          id_agent INT NOT NULL REFERENCES Agents(id_agent),
          type_action NVARCHAR(50) NOT NULL DEFAULT 'MODIFICATION_DEMANDE',
          description NVARCHAR(255) NOT NULL,
          details NVARCHAR(MAX) NULL,
          date_modification DATETIME2 NOT NULL DEFAULT SYSDATETIME()
        );

        CREATE INDEX IX_HistoriqueModificationsDemande ON HistoriqueModificationsDemandes(id_demande);
      END
    `;
    await pool.request().query(migrationVerrouillageSQL);

    const migrationLignesDevisSQL = `
      IF OBJECT_ID('dbo.LignesDevis', 'U') IS NULL
      BEGIN
        CREATE TABLE LignesDevis (
          id_ligne INT IDENTITY(1,1) PRIMARY KEY,
          id_devis INT NOT NULL REFERENCES Devis(id_devis) ON DELETE CASCADE,
          code_article NVARCHAR(50) NOT NULL,
          libelle NVARCHAR(150) NOT NULL,
          unite NVARCHAR(20) NULL,
          diametre NVARCHAR(50) NULL,
          quantite DECIMAL(10,2) NOT NULL DEFAULT 1,
          prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
          montant_ht DECIMAL(12,2) NOT NULL DEFAULT 0,
          type_tva NVARCHAR(20) NULL,
          taux_tva DECIMAL(5,2) NOT NULL DEFAULT 19,
          ordre INT NOT NULL DEFAULT 0,
          choix_prix NVARCHAR(20) NULL,
          type_ligne NVARCHAR(20) NULL,
          prix_fourniture DECIMAL(12,2) NULL,
          prix_pose DECIMAL(12,2) NULL
        );

        CREATE INDEX IX_LignesDevis_Devis ON LignesDevis(id_devis);
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LignesDevis') AND name = 'choix_prix')
        ALTER TABLE LignesDevis ADD choix_prix NVARCHAR(20) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LignesDevis') AND name = 'type_ligne')
        ALTER TABLE LignesDevis ADD type_ligne NVARCHAR(20) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LignesDevis') AND name = 'prix_fourniture')
        ALTER TABLE LignesDevis ADD prix_fourniture DECIMAL(12,2) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LignesDevis') AND name = 'prix_pose')
        ALTER TABLE LignesDevis ADD prix_pose DECIMAL(12,2) NULL;
    `;
    await pool.request().query(migrationLignesDevisSQL);

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
