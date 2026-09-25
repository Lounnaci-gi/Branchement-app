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
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Travaux') AND name = 'numero_abonne')
        ALTER TABLE Travaux ADD numero_abonne NVARCHAR(6) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('MarquesCompteur'))
        CREATE TABLE MarquesCompteur (
          id_marque INT IDENTITY(1,1) PRIMARY KEY,
          libelle NVARCHAR(50) NOT NULL UNIQUE,
          date_creation DATETIME2 NOT NULL DEFAULT SYSDATETIME()
        );
    `;
    await pool.request().query(migrationTravauxSQL);

    const migrationArticlesSQL = `
      IF OBJECT_ID('dbo.CategoriesArticles', 'U') IS NULL
      BEGIN
        CREATE TABLE CategoriesArticles (
          id_categorie INT IDENTITY(1,1) PRIMARY KEY,
          code_categorie NVARCHAR(50) NOT NULL UNIQUE,
          libelle NVARCHAR(100) NOT NULL,
          actif BIT NOT NULL DEFAULT 1
        );
      END;

      IF OBJECT_ID('dbo.ArticlesDevis', 'U') IS NULL
      BEGIN
        CREATE TABLE ArticlesDevis (
          id_article INT IDENTITY(1,1) PRIMARY KEY,
          id_categorie INT NOT NULL REFERENCES CategoriesArticles(id_categorie),
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

      IF OBJECT_ID('dbo.FamillesArticles', 'U') IS NOT NULL
      BEGIN
        INSERT INTO CategoriesArticles (code_categorie, libelle, actif)
        SELECT f.code_famille, f.libelle, ISNULL(f.actif, 1)
        FROM FamillesArticles f
        WHERE NOT EXISTS (
          SELECT 1 FROM CategoriesArticles c WHERE c.code_categorie = f.code_famille
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'id_categorie')
      BEGIN
        ALTER TABLE ArticlesDevis ADD id_categorie INT NULL;
      END;

      IF OBJECT_ID('dbo.FamillesArticles', 'U') IS NOT NULL
         AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'id_famille')
      BEGIN
        UPDATE ad
        SET id_categorie = c.id_categorie
        FROM ArticlesDevis ad
        INNER JOIN FamillesArticles f ON f.id_famille = ad.id_famille
        INNER JOIN CategoriesArticles c ON c.code_categorie = f.code_famille
        WHERE ad.id_categorie IS NULL;
      END;

      DECLARE @dropFamilleFk NVARCHAR(MAX) = N'';
      SELECT @dropFamilleFk += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
        + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
        + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
      FROM sys.foreign_keys fk
      WHERE fk.referenced_object_id = OBJECT_ID('dbo.FamillesArticles');
      IF @dropFamilleFk <> N'' EXEC sp_executesql @dropFamilleFk;

      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'id_famille')
        ALTER TABLE ArticlesDevis DROP COLUMN id_famille;

      IF OBJECT_ID('dbo.FamillesArticles', 'U') IS NOT NULL
        DROP TABLE FamillesArticles;

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

      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ArticlesDevis') AND name = 'id_categorie')
         AND NOT EXISTS (SELECT 1 FROM ArticlesDevis WHERE id_categorie IS NULL)
      BEGIN
        ALTER TABLE ArticlesDevis ALTER COLUMN id_categorie INT NOT NULL;
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
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ArticlesDevis_Unite')
        ALTER TABLE ArticlesDevis ADD CONSTRAINT CK_ArticlesDevis_Unite CHECK (unite IN (N'U', N'ML', N'M²', N'M3', N'KG', N'H', N'FF', N'ENS'));
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ArticlesDevis_Unite')
      BEGIN
        ALTER TABLE ArticlesDevis DROP CONSTRAINT CK_ArticlesDevis_Unite;
        ALTER TABLE ArticlesDevis ADD CONSTRAINT CK_ArticlesDevis_Unite CHECK (unite IN (N'U', N'ML', N'M²', N'M3', N'KG', N'H', N'FF', N'ENS'));
      END;

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
          date_debut DATE NOT NULL,
          date_fin DATE NULL
        );
      END;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TarifsArticlesDevis') AND name = 'taux_tva')
      BEGIN
        DECLARE @dropTauxConstraints NVARCHAR(MAX) = N'';
        SELECT @dropTauxConstraints += N'ALTER TABLE dbo.TarifsArticlesDevis DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE c.object_id = OBJECT_ID('dbo.TarifsArticlesDevis') AND c.name = 'taux_tva';
        SELECT @dropTauxConstraints += N'ALTER TABLE dbo.TarifsArticlesDevis DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('dbo.TarifsArticlesDevis')
          AND cc.definition LIKE '%taux_tva%';
        IF @dropTauxConstraints <> N'' EXEC sp_executesql @dropTauxConstraints;
        ALTER TABLE dbo.TarifsArticlesDevis DROP COLUMN taux_tva;
      END;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ArticlesDevis') AND name = 'avec_diametre')
      BEGIN
        DECLARE @dropAvecDiametre NVARCHAR(MAX) = N'';
        SELECT @dropAvecDiametre += N'ALTER TABLE dbo.ArticlesDevis DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE c.object_id = OBJECT_ID('dbo.ArticlesDevis') AND c.name = 'avec_diametre';
        IF @dropAvecDiametre <> N'' EXEC sp_executesql @dropAvecDiametre;
        ALTER TABLE dbo.ArticlesDevis DROP COLUMN avec_diametre;
      END;
      IF NOT EXISTS (SELECT 1 FROM TarifsArticlesDevis)
      BEGIN
        INSERT INTO TarifsArticlesDevis (id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, date_debut)
        SELECT id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, CONVERT(date, GETDATE())
        FROM ArticlesDevis;
      END;

      UPDATE ArticlesDevis
      SET libelle = LTRIM(SUBSTRING(libelle, 5, LEN(libelle)))
      WHERE LEFT(libelle, 4) = N'F/P ';
    `;
    await pool.request().query(migrationArticlesSQL);

    const droitsReferentielArticlesSQL = `
      IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'db_aep_app_role' AND type = 'R')
      BEGIN
        IF OBJECT_ID(N'dbo.CategoriesArticles', N'U') IS NOT NULL
          GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.CategoriesArticles TO db_aep_app_role;
        IF OBJECT_ID(N'dbo.ArticlesDevis', N'U') IS NOT NULL
          GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.ArticlesDevis TO db_aep_app_role;
        IF OBJECT_ID(N'dbo.TarifsArticlesDevis', N'U') IS NOT NULL
          GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.TarifsArticlesDevis TO db_aep_app_role;
      END
    `;
    await pool.request().query(droitsReferentielArticlesSQL);

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

    const migrationWorkflowSQL = `
      -- Les dossiers historiques sortent de l'étape d'étude sans supprimer leurs données techniques.
      IF OBJECT_ID('dbo.Demandes', 'U') IS NOT NULL
      BEGIN
        DECLARE @migrations TABLE (
          id_demande INT,
          ancien_statut NVARCHAR(30),
          nouveau_statut NVARCHAR(30),
          id_agent INT
        );

        UPDATE d
        SET statut_actuel = CASE d.statut_actuel
          WHEN 'ETUDE_EN_COURS' THEN 'DEPOSEE'
          WHEN 'ETUDE_TERMINEE' THEN 'DEVIS_EMIS'
        END,
        date_maj = SYSDATETIME()
        OUTPUT inserted.id_demande, deleted.statut_actuel,
          inserted.statut_actuel, inserted.id_agent_creation
        INTO @migrations (id_demande, ancien_statut, nouveau_statut, id_agent)
        FROM Demandes AS d
        WHERE d.statut_actuel IN ('ETUDE_EN_COURS', 'ETUDE_TERMINEE');

        IF OBJECT_ID('dbo.HistoriqueStatuts', 'U') IS NOT NULL
        BEGIN
          INSERT INTO HistoriqueStatuts (id_demande, code_statut, id_agent, commentaire)
          SELECT id_demande, nouveau_statut, id_agent,
            CONCAT(N'Migration du statut historique ', ancien_statut, N' vers ', nouveau_statut)
          FROM @migrations;
        END;
      END;
    `;
    await pool.request().query(migrationWorkflowSQL);

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

    const migrationParametresSQL = `
      IF OBJECT_ID('dbo.HistoriqueTva', 'U') IS NULL
      BEGIN
        CREATE TABLE HistoriqueTva (
          id_tva INT IDENTITY(1,1) PRIMARY KEY,
          type_tva NVARCHAR(20) NOT NULL,
          taux DECIMAL(5,2) NOT NULL,
          date_effet DATE NOT NULL,
          date_creation DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          CONSTRAINT CK_HistoriqueTva_Type CHECK (type_tva IN (N'PRESTATION', N'TRAVAUX')),
          CONSTRAINT CK_HistoriqueTva_Taux CHECK (taux >= 0 AND taux <= 100),
          CONSTRAINT UQ_HistoriqueTva_TypeDate UNIQUE (type_tva, date_effet)
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM HistoriqueTva)
      BEGIN
        IF OBJECT_ID('dbo.ParametresApplication', 'U') IS NOT NULL
        BEGIN
          INSERT INTO HistoriqueTva (type_tva, taux, date_effet)
          SELECT N'PRESTATION', valeur, CONVERT(date, GETDATE())
          FROM ParametresApplication WHERE cle = N'TVA_PRESTATION';
          INSERT INTO HistoriqueTva (type_tva, taux, date_effet)
          SELECT N'TRAVAUX', valeur, CONVERT(date, GETDATE())
          FROM ParametresApplication WHERE cle = N'TVA_TRAVAUX';
        END;

        IF NOT EXISTS (SELECT 1 FROM HistoriqueTva)
        BEGIN
          INSERT INTO HistoriqueTva (type_tva, taux, date_effet) VALUES
          (N'PRESTATION', 19, CONVERT(date, GETDATE())),
          (N'TRAVAUX', 19, CONVERT(date, GETDATE()));
        END;
      END;

      IF OBJECT_ID('dbo.ParametresApplication', 'U') IS NOT NULL
        DROP TABLE ParametresApplication;

      IF OBJECT_ID('dbo.fn_PrixArticle', 'FN') IS NOT NULL
        DROP FUNCTION dbo.fn_PrixArticle;

      IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'db_aep_app_role' AND type = 'R')
         AND OBJECT_ID(N'dbo.HistoriqueTva', N'U') IS NOT NULL
        GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.HistoriqueTva TO db_aep_app_role;
    `;
    await pool.request().query(migrationParametresSQL);

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
