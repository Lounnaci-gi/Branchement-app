USE BranchementAEP;
GO

IF COL_LENGTH('Demandes', 'type_autre') IS NULL
BEGIN
    ALTER TABLE Demandes ADD type_autre NVARCHAR(150) NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM TypesBranchement WHERE libelle = N'Extension de r' + NCHAR(233) + N'seau AEP')
BEGIN
    INSERT INTO TypesBranchement (libelle, diametre_defaut)
    VALUES (N'Extension de r' + NCHAR(233) + N'seau AEP', NULL);
END;
GO

IF NOT EXISTS (SELECT 1 FROM TypesBranchement WHERE libelle = N'Autre')
BEGIN
    INSERT INTO TypesBranchement (libelle, diametre_defaut)
    VALUES (N'Autre', NULL);
END;
GO
