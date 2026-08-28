/* Champs facultatifs d'identite des personnes physiques */
IF COL_LENGTH('Demandeurs', 'fils_de') IS NULL
    ALTER TABLE Demandeurs ADD fils_de NVARCHAR(150) NULL;

IF COL_LENGTH('Demandeurs', 'ne_le') IS NULL
    ALTER TABLE Demandeurs ADD ne_le DATE NULL;

IF COL_LENGTH('Demandeurs', 'type_piece_identite') IS NULL
    ALTER TABLE Demandeurs ADD type_piece_identite NVARCHAR(10) NULL;

IF COL_LENGTH('Demandeurs', 'cin_delivre_le') IS NULL
    ALTER TABLE Demandeurs ADD cin_delivre_le DATE NULL;

IF COL_LENGTH('Demandeurs', 'cin_delivre_par') IS NULL
    ALTER TABLE Demandeurs ADD cin_delivre_par NVARCHAR(150) NULL;
