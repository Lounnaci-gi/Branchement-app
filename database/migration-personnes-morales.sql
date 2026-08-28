USE BranchementAEP;
GO

IF COL_LENGTH('Demandeurs', 'est_personne_morale') IS NULL
BEGIN
    ALTER TABLE Demandeurs ADD est_personne_morale BIT NOT NULL CONSTRAINT DF_Demandeurs_EstPersonneMorale DEFAULT 0;
END;
GO

IF COL_LENGTH('Demandeurs', 'raison_sociale') IS NULL
BEGIN
    ALTER TABLE Demandeurs ADD raison_sociale NVARCHAR(150) NULL;
END;
GO

ALTER TABLE Demandeurs ALTER COLUMN nom NVARCHAR(80) NULL;
ALTER TABLE Demandeurs ALTER COLUMN prenom NVARCHAR(80) NULL;
ALTER TABLE Demandeurs ALTER COLUMN telephone NVARCHAR(20) NULL;
GO

EXEC sp_executesql N'
ALTER VIEW vw_DemandesSynthese AS
SELECT
    d.id_demande,
    d.numero_demande,
    CASE WHEN dem.est_personne_morale = 1 THEN dem.raison_sociale ELSE dem.nom + '' '' + dem.prenom END AS demandeur,
    dem.telephone,
    a.nom_agence,
    c.nom_commune,
    t.libelle AS type_branchement,
    d.statut_actuel,
    s.libelle AS statut_libelle,
    s.ordre AS statut_ordre,
    d.date_depot,
    d.date_maj,
    dv.montant AS montant_devis,
    dv.statut_paiement
FROM Demandes d
JOIN Demandeurs dem ON dem.id_demandeur = d.id_demandeur
JOIN Agences a ON a.id_agence = d.id_agence
JOIN Communes c ON c.id_commune = d.id_commune
JOIN TypesBranchement t ON t.id_type = d.id_type
JOIN Statuts s ON s.code_statut = d.statut_actuel
LEFT JOIN Devis dv ON dv.id_demande = d.id_demande;
';
GO
