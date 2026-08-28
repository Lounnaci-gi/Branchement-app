/* Ajoute un second numéro de téléphone facultatif au demandeur. */
IF COL_LENGTH('Demandeurs', 'telephone_secondaire') IS NULL
BEGIN
    ALTER TABLE Demandeurs ADD telephone_secondaire NVARCHAR(20) NULL;
END;

GO

CREATE OR ALTER VIEW vw_DemandesSynthese AS
SELECT
    d.id_demande,
    d.numero_demande,
    CASE WHEN dem.est_personne_morale = 1 THEN dem.raison_sociale ELSE dem.nom + ' ' + dem.prenom END AS demandeur,
    dem.telephone,
    dem.telephone_secondaire,
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
