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
