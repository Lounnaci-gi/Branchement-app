USE BranchementAEP;
GO

IF COL_LENGTH('Demandeurs', 'qualite_demandeur') IS NULL
BEGIN
    ALTER TABLE Demandeurs ADD qualite_demandeur NVARCHAR(20) NULL;
END;
GO
