USE BranchementAEP;
GO

-- ============================================================
-- 0. Nettoyage de compatibilite : suppression des structures legacy
-- ============================================================
DECLARE @dropLegacyFk NVARCHAR(MAX) = N'';

SELECT @dropLegacyFk += N'ALTER TABLE dbo.ArticlesDevis DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID(N'dbo.ArticlesDevis')
  AND fk.referenced_object_id <> OBJECT_ID(N'dbo.CategoriesArticles');

IF @dropLegacyFk <> N''
    EXEC sys.sp_executesql @dropLegacyFk;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ArticlesDevis') AND name = N'id_famille')
    ALTER TABLE dbo.ArticlesDevis DROP COLUMN id_famille;

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.FamillesArticles') AND type = 'U')
    DROP TABLE dbo.FamillesArticles;
GO

-- ============================================================
-- 1. Categories de reference
-- ============================================================
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

-- ============================================================
-- 2. Catalogue d articles : model categorie -> article
--    (chaque article appartient a une categorie)
-- ============================================================
INSERT INTO ArticlesDevis (
    id_categorie, code_article, libelle, unite, mode_prix,
    prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, actif
)
SELECT cat.id_categorie,
       v.code_article,
       v.libelle,
       v.unite,
       v.mode_prix,
       v.prix_unitaire,
       v.prix_fourniture,
       v.prix_pose,
       v.type_tva,
       v.taux_tva,
       1
FROM (VALUES
    (N'TRAVAUX-TERRASSEMENT', N'TR-RE', N'Reprise de terrassement', N'M3', N'PRESTATION', 2500.00, NULL, NULL, N'TRAVAUX', 19.00),
    (N'TRAVAUX-TERRASSEMENT', N'TR-EX', N'Excavation tranchée', N'M3', N'PRESTATION', 2100.00, NULL, NULL, N'TRAVAUX', 19.00),
    (N'TRAVAUX-TERRASSEMENT', N'TR-REB', N'Remblais compacté', N'M3', N'PRESTATION', 1400.00, NULL, NULL, N'TRAVAUX', 19.00),

    (N'CANALISATIONS-RACCORDS', N'CAN-025', N'Canalisation PEHD Ø25', N'ML', N'FOURNITURE_POSE', 260.00, 182.00, 78.00, N'TRAVAUX', 19.00),
    (N'CANALISATIONS-RACCORDS', N'CAN-032', N'Canalisation PEHD Ø32', N'ML', N'FOURNITURE_POSE', 420.00, 294.00, 126.00, N'TRAVAUX', 19.00),
    (N'CANALISATIONS-RACCORDS', N'CAN-040', N'Canalisation PEHD Ø40', N'ML', N'FOURNITURE_POSE', 640.00, 448.00, 192.00, N'TRAVAUX', 19.00),
    (N'CANALISATIONS-RACCORDS', N'RAC-001', N'Raccord coude Ø25', N'U', N'FOURNITURE_POSE', 240.00, 168.00, 72.00, N'TRAVAUX', 19.00),
    (N'CANALISATIONS-RACCORDS', N'RAC-002', N'Raccord coude Ø32', N'U', N'FOURNITURE_POSE', 300.00, 210.00, 90.00, N'TRAVAUX', 19.00),
    (N'CANALISATIONS-RACCORDS', N'RAC-003', N'Raccord tee Ø40', N'U', N'FOURNITURE_POSE', 520.00, 364.00, 156.00, N'TRAVAUX', 19.00),

    (N'ROBINETTERIE-ACCESSOIRES', N'ROB-010', N'Robinet d''arrêt Ø25', N'U', N'FOURNITURE_POSE', 3200.00, 2240.00, 960.00, N'TRAVAUX', 19.00),
    (N'ROBINETTERIE-ACCESSOIRES', N'ROB-020', N'Robinet d''arrêt Ø40', N'U', N'FOURNITURE_POSE', 4600.00, 3220.00, 1380.00, N'TRAVAUX', 19.00),
    (N'ROBINETTERIE-ACCESSOIRES', N'ACC-015', N'Collier de prise en charge', N'U', N'FOURNITURE_POSE', 980.00, 686.00, 294.00, N'TRAVAUX', 19.00),
    (N'ROBINETTERIE-ACCESSOIRES', N'ACC-020', N'Bouchon de protection', N'U', N'PRESTATION', 360.00, NULL, NULL, N'TRAVAUX', 19.00),

    (N'COMPTAGE', N'CPT-001', N'Pose compteur DN15', N'U', N'PRESTATION', 6950.00, NULL, NULL, N'TRAVAUX', 19.00),
    (N'COMPTAGE', N'CPT-002', N'Pose compteur DN20', N'U', N'PRESTATION', 7500.00, NULL, NULL, N'TRAVAUX', 19.00),
    (N'COMPTAGE', N'CPT-003', N'Pose compteur DN40', N'U', N'PRESTATION', 34000.00, NULL, NULL, N'TRAVAUX', 19.00),

    (N'FRAIS-PRESTATIONS', N'ABO-001', N'Frais d''abonnement', N'U', N'PRESTATION', 1500.00, NULL, NULL, N'PRESTATION', 19.00),
    (N'FRAIS-PRESTATIONS', N'COU-001', N'Coupure et rétablissement', N'U', N'PRESTATION', 4200.00, NULL, NULL, N'PRESTATION', 19.00),
    (N'FRAIS-PRESTATIONS', N'PIQ-001', N'Piquage illicite', N'U', N'PRESTATION', 3200.00, NULL, NULL, N'PRESTATION', 19.00),

    (N'MATERIAUX-GENERIQUES', N'MAT-DA', N'Matériau drain', N'ENS', N'FOURNITURE_POSE', 1800.00, 1260.00, 540.00, N'PRESTATION', 19.00),
    (N'MATERIAUX-GENERIQUES', N'MAT-SB', N'Matériau support', N'ENS', N'FOURNITURE_POSE', 1400.00, 980.00, 420.00, N'PRESTATION', 19.00),
    (N'MATERIAUX-GENERIQUES', N'MAT-CI', N'Matériau ciment', N'ENS', N'FOURNITURE_POSE', 1200.00, 840.00, 360.00, N'PRESTATION', 19.00)
) AS v(code_categorie, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva)
JOIN CategoriesArticles AS cat
  ON cat.code_categorie = v.code_categorie
WHERE NOT EXISTS (
    SELECT 1 FROM ArticlesDevis ad WHERE ad.code_article = v.code_article
);
GO

PRINT N'Catalogue d''articles chargé avec la structure categorie -> article.';
GO
