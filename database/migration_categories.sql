/* ============================================================
   MIGRATION : Ajout des Catégories d'Articles
   Base    : BranchementAEP
   Auteur  : Antigravity
   Date    : 2026-09-05
   But     : Ajouter la hiérarchie Catégorie → Famille → Article
   Idempotent : peut être relancé sans créer de doublons
   ============================================================ */
USE BranchementAEP;
GO

/* ------------------------------------------------------------
   1. CREATION DE LA TABLE CategoriesArticles
      (uniquement si elle n'existe pas déjà)
   ------------------------------------------------------------ */
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = N'CategoriesArticles' AND type = 'U'
)
BEGIN
    CREATE TABLE CategoriesArticles (
        id_categorie    INT IDENTITY(1,1) PRIMARY KEY,
        code_categorie  NVARCHAR(50) NOT NULL UNIQUE,
        libelle         NVARCHAR(100) NOT NULL,
        actif           BIT NOT NULL DEFAULT 1
    );
    PRINT 'Table CategoriesArticles créée.';
END
ELSE
BEGIN
    PRINT 'Table CategoriesArticles existe déjà.';
END
GO

/* ------------------------------------------------------------
   2. AJOUT DE LA COLONNE id_categorie DANS FamillesArticles
      (nullable pour rétrocompatibilité avec les données existantes)
   ------------------------------------------------------------ */
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'FamillesArticles') AND name = N'id_categorie'
)
BEGIN
    ALTER TABLE FamillesArticles
    ADD id_categorie INT NULL
        CONSTRAINT FK_FamillesArticles_Categorie
        REFERENCES CategoriesArticles(id_categorie);
    PRINT 'Colonne id_categorie ajoutée à FamillesArticles.';
END
ELSE
BEGIN
    PRINT 'Colonne id_categorie existe déjà dans FamillesArticles.';
END
GO

/* ------------------------------------------------------------
   3. SEED : CATEGORIES DE REFERENCE
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM CategoriesArticles WHERE code_categorie = N'TRAVAUX-TERRASSEMENT')
    INSERT INTO CategoriesArticles (code_categorie, libelle) VALUES (N'TRAVAUX-TERRASSEMENT', N'Travaux & Terrassement');
IF NOT EXISTS (SELECT 1 FROM CategoriesArticles WHERE code_categorie = N'CANALISATIONS-RACCORDS')
    INSERT INTO CategoriesArticles (code_categorie, libelle) VALUES (N'CANALISATIONS-RACCORDS', N'Canalisations & Raccords');
IF NOT EXISTS (SELECT 1 FROM CategoriesArticles WHERE code_categorie = N'ROBINETTERIE-ACCESSOIRES')
    INSERT INTO CategoriesArticles (code_categorie, libelle) VALUES (N'ROBINETTERIE-ACCESSOIRES', N'Robinetterie & Accessoires');
IF NOT EXISTS (SELECT 1 FROM CategoriesArticles WHERE code_categorie = N'COMPTAGE')
    INSERT INTO CategoriesArticles (code_categorie, libelle) VALUES (N'COMPTAGE', N'Comptage');
IF NOT EXISTS (SELECT 1 FROM CategoriesArticles WHERE code_categorie = N'FRAIS-PRESTATIONS')
    INSERT INTO CategoriesArticles (code_categorie, libelle) VALUES (N'FRAIS-PRESTATIONS', N'Frais & Prestations');
IF NOT EXISTS (SELECT 1 FROM CategoriesArticles WHERE code_categorie = N'MATERIAUX-GENERIQUES')
    INSERT INTO CategoriesArticles (code_categorie, libelle) VALUES (N'MATERIAUX-GENERIQUES', N'Matériaux génériques');
GO

/* ------------------------------------------------------------
   4. AFFECTATION DES FAMILLES EXISTANTES AUX CATEGORIES
      (uniquement pour les familles dont id_categorie est encore NULL)
   ------------------------------------------------------------ */

-- Travaux & Terrassement
UPDATE fa SET fa.id_categorie = c.id_categorie
FROM FamillesArticles fa
CROSS JOIN CategoriesArticles c
WHERE c.code_categorie = N'TRAVAUX-TERRASSEMENT'
  AND fa.code_famille IN (N'TERRASSEMENT-BR')
  AND fa.id_categorie IS NULL;

-- Canalisations & Raccords
UPDATE fa SET fa.id_categorie = c.id_categorie
FROM FamillesArticles fa
CROSS JOIN CategoriesArticles c
WHERE c.code_categorie = N'CANALISATIONS-RACCORDS'
  AND fa.code_famille IN (N'CANALISATION-PEHD', N'COLLIER-PRISE-CHARGE', N'PIECES-PEHD-PP', N'RACCORDEMENTS')
  AND fa.id_categorie IS NULL;

-- Robinetterie & Accessoires
UPDATE fa SET fa.id_categorie = c.id_categorie
FROM FamillesArticles fa
CROSS JOIN CategoriesArticles c
WHERE c.code_categorie = N'ROBINETTERIE-ACCESSOIRES'
  AND fa.code_famille IN (N'ROBINETTERIE-ARRET', N'ACCESSOIRES-BRANCHEMENT')
  AND fa.id_categorie IS NULL;

-- Comptage
UPDATE fa SET fa.id_categorie = c.id_categorie
FROM FamillesArticles fa
CROSS JOIN CategoriesArticles c
WHERE c.code_categorie = N'COMPTAGE'
  AND fa.code_famille IN (N'COMPTAGE-BR')
  AND fa.id_categorie IS NULL;

-- Frais & Prestations
UPDATE fa SET fa.id_categorie = c.id_categorie
FROM FamillesArticles fa
CROSS JOIN CategoriesArticles c
WHERE c.code_categorie = N'FRAIS-PRESTATIONS'
  AND fa.code_famille IN (N'ABONNEMENT', N'CAUTIONNEMENT', N'COUPURE-RETAB', N'PIQUAGE-ILLICITE', N'VENTE-CITERNE')
  AND fa.id_categorie IS NULL;

-- Matériaux génériques (familles seed initiales)
UPDATE fa SET fa.id_categorie = c.id_categorie
FROM FamillesArticles fa
CROSS JOIN CategoriesArticles c
WHERE c.code_categorie = N'MATERIAUX-GENERIQUES'
  AND fa.code_famille IN (N'MATERIEL', N'TRAVAUX')
  AND fa.id_categorie IS NULL;

PRINT 'Affectation des familles aux catégories terminée.';
GO

/* ------------------------------------------------------------
   5. VERIFICATION : familles sans catégorie après migration
   ------------------------------------------------------------ */
SELECT f.id_famille, f.code_famille, f.libelle, f.id_categorie
FROM FamillesArticles f
WHERE f.id_categorie IS NULL AND f.actif = 1;
GO

/* ------------------------------------------------------------
   6. GRANT (même approche que schema.sql section sécurité)
      Adapter le nom de l'utilisateur applicatif si besoin.
   ------------------------------------------------------------ */
-- GRANT SELECT, INSERT, UPDATE ON CategoriesArticles TO [AppBranchementAEP];
-- (Décommentez et adaptez selon votre configuration de sécurité)
GO

PRINT '=== Migration Catégories terminée avec succès. ===';
GO
