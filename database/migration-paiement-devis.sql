/* Informations justificatives du paiement d'un devis */
IF COL_LENGTH('Devis', 'numero_recu') IS NULL
  ALTER TABLE Devis ADD numero_recu NVARCHAR(50) NULL;
IF COL_LENGTH('Devis', 'numero_cheque') IS NULL
  ALTER TABLE Devis ADD numero_cheque NVARCHAR(50) NULL;
IF COL_LENGTH('Devis', 'numero_versement') IS NULL
  ALTER TABLE Devis ADD numero_versement NVARCHAR(50) NULL;
IF COL_LENGTH('Devis', 'banque') IS NULL
  ALTER TABLE Devis ADD banque NVARCHAR(150) NULL;
GO