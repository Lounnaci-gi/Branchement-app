/* Données de référence minimales pour démarrer (à adapter à votre structure ADE réelle) */
USE BranchementAEP;
GO

IF NOT EXISTS (SELECT 1 FROM Centres WHERE nom_centre = N'Centre Berrouaghia')
BEGIN
    INSERT INTO Centres (nom_centre) VALUES (N'Centre Berrouaghia');
END
GO

IF NOT EXISTS (SELECT 1 FROM Agences WHERE code_agence = N'CB')
BEGIN
    INSERT INTO Agences (id_centre, nom_agence, code_agence) VALUES
    (1, N'Agence Berrouaghia', N'CB');
END
GO

IF NOT EXISTS (SELECT 1 FROM Communes WHERE nom_commune = N'Berrouaghia')
BEGIN
    INSERT INTO Communes (id_agence, nom_commune, wilaya) VALUES
    (1, N'Berrouaghia', N'Medea');
END
GO

IF NOT EXISTS (SELECT 1 FROM TypesBranchement WHERE libelle = N'Borne d''incendie')
BEGIN
    INSERT INTO TypesBranchement (libelle, diametre_defaut) VALUES
    (N'Borne d''incendie', NULL);
END
GO

IF NOT EXISTS (SELECT 1 FROM FamillesArticles)
BEGIN
        INSERT INTO FamillesArticles (code_famille, libelle) VALUES
            (N'RACCORDEMENTS', N'Raccordements'),
            (N'MATERIEL', N'Matériel de pose'),
            (N'TRAVAUX', N'Travaux / main d’œuvre');
END
GO

IF NOT EXISTS (SELECT 1 FROM ArticlesDevis)
BEGIN
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
END
GO

    IF NOT EXISTS (SELECT 1 FROM ArticlesDevis WHERE code_article = N'MAT-DA')
    BEGIN
        INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
        SELECT id_famille, N'MAT-DA', N'Dalle de protection', N'M²', N'FOURNITURE_POSE', 2800, 1800, 1000
        FROM FamillesArticles WHERE code_famille = N'MATERIEL';
    END
    IF NOT EXISTS (SELECT 1 FROM ArticlesDevis WHERE code_article = N'MAT-SB')
    BEGIN
        INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
        SELECT id_famille, N'MAT-SB', N'Sable de remblai', N'M3', N'FOURNITURE_POSE', 3200, 3200, 0
        FROM FamillesArticles WHERE code_famille = N'MATERIEL';
    END
    IF NOT EXISTS (SELECT 1 FROM ArticlesDevis WHERE code_article = N'MAT-CI')
    BEGIN
        INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
        SELECT id_famille, N'MAT-CI', N'Ciment', N'KG', N'FOURNITURE_POSE', 95, 95, 0
        FROM FamillesArticles WHERE code_famille = N'MATERIEL';
    END
    GO

    UPDATE ArticlesDevis
    SET mode_prix = N'FOURNITURE_POSE', prix_fourniture = 2500, prix_pose = 1700
    WHERE code_article = N'TR-RE';
    UPDATE ArticlesDevis
    SET mode_prix = N'FOURNITURE_POSE', prix_fourniture = 1800, prix_pose = 1000
    WHERE code_article = N'MAT-DA';
    GO

    IF NOT EXISTS (SELECT 1 FROM TarifsArticlesDevis)
    BEGIN
        INSERT INTO TarifsArticlesDevis (id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, date_debut)
        SELECT id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, CONVERT(date, GETDATE())
        FROM ArticlesDevis;
    END
    GO
