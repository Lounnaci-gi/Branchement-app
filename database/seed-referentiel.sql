/* Données de référence minimales pour démarrer (à adapter à ta structure ADE réelle) */
USE BranchementAEP;
GO

INSERT INTO Centres (nom_centre) VALUES (N'Centre Berrouaghia');
GO

INSERT INTO Agences (id_centre, nom_agence, code_agence) VALUES
(1, N'Agence Berrouaghia', N'CB');
GO

INSERT INTO Communes (id_agence, nom_commune, wilaya) VALUES
(1, N'Berrouaghia', N'Medea')
GO
