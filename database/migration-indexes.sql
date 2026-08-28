-- ============================================================
--  Index manquants — performance des recherches et jointures
--  À appliquer sur la base BranchementAEP
--  Date : 2026-08
-- ============================================================
USE BranchementAEP;
GO

-- Index sur Demandeurs(id_commune) : utilisé dans la vue vw_DemandesSynthese (JOIN)
-- et dans la recherche des demandeurs
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Demandeurs') AND name = 'IX_Demandeurs_Commune'
)
  CREATE INDEX IX_Demandeurs_Commune ON Demandeurs(id_commune);
GO

-- Index sur Demandeurs(nom, prenom) : utilisé dans les recherches par nom dans GET /demandeurs/recherche
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Demandeurs') AND name = 'IX_Demandeurs_Nom_Prenom'
)
  CREATE INDEX IX_Demandeurs_Nom_Prenom ON Demandeurs(nom, prenom);
GO

-- Index sur Demandeurs(telephone) : utilisé dans les recherches par téléphone
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Demandeurs') AND name = 'IX_Demandeurs_Telephone'
)
  CREATE INDEX IX_Demandeurs_Telephone ON Demandeurs(telephone);
GO

-- Index sur Demandeurs(raison_sociale) : utilisé dans les recherches de personnes morales
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Demandeurs') AND name = 'IX_Demandeurs_RaisonSociale'
)
  CREATE INDEX IX_Demandeurs_RaisonSociale ON Demandeurs(raison_sociale);
GO

-- Index sur Devis(id_demande) : utilisé dans les jointures de la vue et des routes
-- (id_demande est FK mais SQL Server ne crée pas automatiquement l'index sur la colonne FK)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Devis') AND name = 'IX_Devis_Demande'
)
  CREATE INDEX IX_Devis_Demande ON Devis(id_demande);
GO

-- Index sur Devis(statut_paiement) : utilisé dans le dashboard (WHERE statut_paiement = 'IMPAYE')
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Devis') AND name = 'IX_Devis_StatutPaiement'
)
  CREATE INDEX IX_Devis_StatutPaiement ON Devis(statut_paiement);
GO

-- Index sur Demandes(numero_demande) : recherche par numéro dans la liste des demandes
-- (numero_demande est déjà UNIQUE donc l'index existe, on s'assure juste qu'il y a un index dédié)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Demandes') AND name = 'IX_Demandes_NumeroDemande'
)
  CREATE INDEX IX_Demandes_NumeroDemande ON Demandes(numero_demande);
GO
