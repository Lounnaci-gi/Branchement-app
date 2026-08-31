/* ============================================================
   BASE DE DONNEES : Suivi des Demandes de Branchement AEP
   SGBD : SQL Server
   Script final consolidé — v2
   Intègre : schema.sql + migration-devis-complementaire.sql
             + migration-export-csv-demandes.sql
             + migration-telephone-secondaire.sql (+ historique v1)
   Date : 2026-08
   ============================================================ */

CREATE DATABASE BranchementAEP;
GO
USE BranchementAEP;
GO

/* ------------------------------------------------------------
   1. REFERENTIEL ORGANISATIONNEL (structure ADE)
   ------------------------------------------------------------ */
CREATE TABLE Centres (
    id_centre       INT IDENTITY(1,1) PRIMARY KEY,
    nom_centre      NVARCHAR(100) NOT NULL
);

CREATE TABLE Agences (
    id_agence       INT IDENTITY(1,1) PRIMARY KEY,
    id_centre       INT NOT NULL REFERENCES Centres(id_centre),
    nom_agence      NVARCHAR(100) NOT NULL,
    code_agence     NVARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE Communes (
    id_commune      INT IDENTITY(1,1) PRIMARY KEY,
    id_agence       INT NOT NULL REFERENCES Agences(id_agence),
    nom_commune     NVARCHAR(100) NOT NULL,
    wilaya          NVARCHAR(100) NOT NULL
);

/* ------------------------------------------------------------
   2. AGENTS (utilisateurs de l'application)
   ------------------------------------------------------------ */
CREATE TABLE Agents (
    id_agent        INT IDENTITY(1,1) PRIMARY KEY,
    nom             NVARCHAR(80) NULL,
    prenom          NVARCHAR(80) NULL,
    email           NVARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe    NVARCHAR(255) NOT NULL,  -- hash bcrypt
    role            NVARCHAR(30) NOT NULL DEFAULT 'agent_guichet' CONSTRAINT CK_Agents_Role CHECK (role IN ('agent_guichet', 'agent_technique', 'chef_agence', 'admin')),
        -- valeurs : agent_guichet, agent_technique, chef_agence, admin
    id_agence       INT NOT NULL REFERENCES Agences(id_agence),
    actif           BIT NOT NULL DEFAULT 1,
    date_creation   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

/* ------------------------------------------------------------
   3. DEMANDEURS (abonnes / clients)
   ------------------------------------------------------------ */
CREATE TABLE Demandeurs (
    id_demandeur        INT IDENTITY(1,1) PRIMARY KEY,
    est_personne_morale BIT NOT NULL CONSTRAINT DF_Demandeurs_EstPersonneMorale DEFAULT 0,
    qualite_demandeur   NVARCHAR(20) NULL CONSTRAINT CK_Demandeurs_Qualite CHECK (qualite_demandeur IS NULL OR qualite_demandeur IN ('PROPRIETAIRE', 'LOCATAIRE', 'MANDATAIRE')),
    raison_sociale      NVARCHAR(150) NULL,
    nom                 NVARCHAR(80) NULL,
    prenom              NVARCHAR(80) NULL,
    fils_de             NVARCHAR(150) NULL,
    ne_le               DATE NULL,
    type_piece_identite NVARCHAR(10) NULL CONSTRAINT CK_Demandeurs_TypePiece CHECK (type_piece_identite IS NULL OR type_piece_identite IN ('CIN', 'PC')),
    cin                 NVARCHAR(20) NULL,
    cin_delivre_le      DATE NULL,
    cin_delivre_par     NVARCHAR(150) NULL,
    telephone           NVARCHAR(20) NULL,
    telephone_secondaire NVARCHAR(20) NULL,
    email               NVARCHAR(150) NULL,
    adresse             NVARCHAR(255) NOT NULL,
    id_commune          INT NOT NULL REFERENCES Communes(id_commune),
    date_creation       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

/* ------------------------------------------------------------
   4. TYPES DE BRANCHEMENT (referentiel)
   ------------------------------------------------------------ */
CREATE TABLE TypesBranchement (
    id_type         INT IDENTITY(1,1) PRIMARY KEY,
    libelle         NVARCHAR(100) NOT NULL,
    diametre_defaut NVARCHAR(20) NULL
);

/* ------------------------------------------------------------
   5. STATUTS (referentiel du workflow - 6 etapes + rejets)
   ------------------------------------------------------------ */
CREATE TABLE Statuts (
    code_statut     NVARCHAR(30) PRIMARY KEY,
    libelle         NVARCHAR(100) NOT NULL,
    ordre           INT NOT NULL,
    est_final       BIT NOT NULL DEFAULT 0
);

INSERT INTO Statuts (code_statut, libelle, ordre, est_final) VALUES
('DEPOSEE',            N'Demande déposée',            1, 0),
('ETUDE_EN_COURS',      N'Étude technique en cours',   2, 0),
('ETUDE_TERMINEE',      N'Étude technique terminée',   3, 0),
('DEVIS_EMIS',          N'Devis émis',                 4, 0),
('DEVIS_PAYE',          N'Devis payé',                 5, 0),
('TRAVAUX_EN_COURS',    N'Travaux en cours',           6, 0),
('TRAVAUX_TERMINES',    N'Travaux terminés',           7, 0),
('MISE_EN_SERVICE',     N'Mise en service',            8, 1),
('REJETEE',             N'Demande rejetée',            9, 1),
('ANNULEE',             N'Demande annulée',           10, 1);

/* ------------------------------------------------------------
   6. DEMANDES DE BRANCHEMENT (table centrale)
   ------------------------------------------------------------ */
CREATE TABLE Demandes (
    id_demande          INT IDENTITY(1,1) PRIMARY KEY,
    numero_demande      NVARCHAR(30) NOT NULL UNIQUE,
    id_demandeur        INT NOT NULL REFERENCES Demandeurs(id_demandeur),
    id_agence           INT NOT NULL REFERENCES Agences(id_agence),
    id_type             INT NOT NULL REFERENCES TypesBranchement(id_type),
    type_autre          NVARCHAR(150) NULL,
    adresse_branchement NVARCHAR(255) NOT NULL,
    id_commune          INT NOT NULL REFERENCES Communes(id_commune),
    statut_actuel       NVARCHAR(30) NOT NULL REFERENCES Statuts(code_statut) DEFAULT 'DEPOSEE',
    id_agent_creation   INT NOT NULL REFERENCES Agents(id_agent),
    date_depot          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    date_maj            DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    observations        NVARCHAR(MAX) NULL
);

/* ------------------------------------------------------------
   7. HISTORIQUE DES STATUTS
   ------------------------------------------------------------ */
CREATE TABLE HistoriqueStatuts (
    id_historique   INT IDENTITY(1,1) PRIMARY KEY,
    id_demande      INT NOT NULL REFERENCES Demandes(id_demande),
    code_statut     NVARCHAR(30) NOT NULL REFERENCES Statuts(code_statut),
    id_agent        INT NOT NULL REFERENCES Agents(id_agent),
    date_changement DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    commentaire     NVARCHAR(500) NULL
);

/* ------------------------------------------------------------
   8. ETUDE TECHNIQUE (visite terrain)
   ------------------------------------------------------------ */
CREATE TABLE EtudesTechniques (
    id_etude            INT IDENTITY(1,1) PRIMARY KEY,
    id_demande          INT NOT NULL UNIQUE REFERENCES Demandes(id_demande),
    id_agent_technique  INT NOT NULL REFERENCES Agents(id_agent),
    date_visite         DATETIME2 NULL,
    distance_reseau_m   DECIMAL(6,2) NULL,
    diametre_conduite   NVARCHAR(20) NULL,
    faisabilite         NVARCHAR(30) NULL CONSTRAINT CK_Etudes_Faisabilite CHECK (faisabilite IS NULL OR faisabilite IN ('Faisable', 'Faisable_sous_reserve', 'Non_faisable')),
    observations        NVARCHAR(MAX) NULL,
    date_creation       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

/* ------------------------------------------------------------
   9. DEVIS ET PAIEMENT
   ------------------------------------------------------------ */
CREATE TABLE Devis (
    id_devis            INT IDENTITY(1,1) PRIMARY KEY,
    id_demande          INT NOT NULL REFERENCES Demandes(id_demande),
    numero_devis        NVARCHAR(30) NOT NULL UNIQUE,
    montant             DECIMAL(12,2) NOT NULL,
    date_emission       DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    statut_paiement     NVARCHAR(20) NOT NULL DEFAULT 'IMPAYE' CONSTRAINT CK_Devis_StatutPaiement CHECK (statut_paiement IN ('IMPAYE', 'PAYE')),
    date_paiement       DATETIME2 NULL,
    mode_paiement       NVARCHAR(30) NULL CONSTRAINT CK_Devis_ModePaiement CHECK (mode_paiement IS NULL OR mode_paiement IN ('Especes', 'Cheque', 'Versement_bancaire', 'Virement')),
    numero_recu         NVARCHAR(50) NULL,
    numero_cheque       NVARCHAR(50) NULL,
    numero_versement    NVARCHAR(50) NULL,
    banque              NVARCHAR(150) NULL
);

/* ------------------------------------------------------------
   10. TRAVAUX D'EXECUTION
   ------------------------------------------------------------ */
CREATE TABLE Travaux (
    id_travaux              INT IDENTITY(1,1) PRIMARY KEY,
    id_demande              INT NOT NULL UNIQUE REFERENCES Demandes(id_demande),
    numero_ordre_execution  NVARCHAR(15) NOT NULL UNIQUE,
    date_debut              DATETIME2 NULL,
    date_fin                DATETIME2 NULL,
    equipe_execution        NVARCHAR(100) NULL,
    numero_compteur         NVARCHAR(50) NULL,
    marque_compteur         NVARCHAR(50) NULL,
    type_compteur           NVARCHAR(50) NULL,
    diametre_compteur       NVARCHAR(20) NULL,
    observations            NVARCHAR(MAX) NULL
);

/* ------------------------------------------------------------
   11. MISE EN SERVICE
   ------------------------------------------------------------ */
CREATE TABLE MisesEnService (
    id_mise_service      INT IDENTITY(1,1) PRIMARY KEY,
    id_demande           INT NOT NULL UNIQUE REFERENCES Demandes(id_demande),
    date_mise_service     DATETIME2 NULL,
    numero_abonne         NVARCHAR(30) NULL,
    index_initial          DECIMAL(10,3) NULL
);

/* ------------------------------------------------------------
   12. PIECES JOINTES
   ------------------------------------------------------------ */
CREATE TABLE PiecesJointes (
    id_piece        INT IDENTITY(1,1) PRIMARY KEY,
    id_demande      INT NOT NULL REFERENCES Demandes(id_demande),
    type_piece      NVARCHAR(50) NOT NULL,
    nom_fichier     NVARCHAR(255) NOT NULL,
    chemin_fichier  NVARCHAR(500) NOT NULL,
    date_upload     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ============================================================
   INDEX
   ============================================================ */
CREATE INDEX IX_Demandes_Statut ON Demandes(statut_actuel);
CREATE INDEX IX_Demandes_Agence ON Demandes(id_agence);
CREATE INDEX IX_Demandes_Demandeur ON Demandes(id_demandeur);
CREATE INDEX IX_Demandes_Commune ON Demandes(id_commune);
CREATE INDEX IX_Demandes_Type ON Demandes(id_type);
CREATE INDEX IX_Demandes_Date ON Demandes(date_depot);

CREATE INDEX IX_Historique_Demande ON HistoriqueStatuts(id_demande);
CREATE INDEX IX_Historique_Agent ON HistoriqueStatuts(id_agent);

CREATE INDEX IX_Demandeurs_Commune ON Demandeurs(id_commune);
CREATE INDEX IX_Demandeurs_Nom_Prenom ON Demandeurs(nom, prenom);
CREATE INDEX IX_Demandeurs_Telephone ON Demandeurs(telephone);
CREATE INDEX IX_Demandeurs_TelephoneSecondaire ON Demandeurs(telephone_secondaire);
CREATE INDEX IX_Demandeurs_RaisonSociale ON Demandeurs(raison_sociale);
CREATE INDEX IX_Demandeurs_CIN ON Demandeurs(cin);

CREATE INDEX IX_Devis_Demande ON Devis(id_demande);
CREATE INDEX IX_Devis_StatutPaiement ON Devis(statut_paiement);

CREATE INDEX IX_Travaux_NumeroCompteur ON Travaux(numero_compteur);
CREATE INDEX IX_MisesEnService_NumeroAbonne ON MisesEnService(numero_abonne);
GO

/* ============================================================
   PROCEDURE STOCKEE : changement de statut avec historisation
   ============================================================ */
CREATE PROCEDURE sp_ChangerStatutDemande
    @id_demande INT,
    @nouveau_statut NVARCHAR(30),
    @id_agent INT,
    @commentaire NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    UPDATE Demandes
    SET statut_actuel = @nouveau_statut,
        date_maj = SYSDATETIME()
    WHERE id_demande = @id_demande;

    INSERT INTO HistoriqueStatuts (id_demande, code_statut, id_agent, commentaire)
    VALUES (@id_demande, @nouveau_statut, @id_agent, @commentaire);

    COMMIT TRANSACTION;
END
GO

/* ============================================================
   TRIGGER : historiser automatiquement la creation d'une demande
   ============================================================ */
CREATE TRIGGER trg_Demandes_HistoriqueInitial
ON Demandes
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO HistoriqueStatuts (id_demande, code_statut, id_agent, commentaire)
    SELECT id_demande, statut_actuel, id_agent_creation, N'Création de la demande'
    FROM inserted;
END
GO

/* ============================================================
   VUE : tableau de bord synthetique + champs export CSV
   Version finale (migration-export-csv-demandes.sql) :
   - agrège les devis par demande (dv_agg) au lieu d'un simple
     LEFT JOIN, INDISPENSABLE depuis que Devis.id_demande n'est
     plus unique — sinon une demande à 2 devis apparaîtrait en
     double dans la vue et fausserait le dashboard.
   NOTE (redondance à confirmer) : c.nom_commune est sélectionné
   deux fois — une fois aliasé nom_commune_branchement, une fois
   tel quel (nom_commune). Ce n'est pas une erreur SQL (les alias
   de sortie diffèrent), mais c'est probablement un copier-coller
   involontaire. Je l'ai gardé tel quel pour ne rien casser côté
   app si du code lit encore "nom_commune" — dis-moi si je le
   retire.
   ============================================================ */
CREATE VIEW vw_DemandesSynthese AS
SELECT
    d.id_demande,
    d.numero_demande,
    d.id_agence,
    d.id_commune,
    d.id_type,
    d.id_demandeur,
    CASE WHEN dem.est_personne_morale = 1 THEN dem.raison_sociale ELSE dem.nom + ' ' + dem.prenom END AS demandeur,
    dem.telephone,
    dem.telephone_secondaire,
    dem.adresse AS adresse_residence,
    a.nom_agence,
    c_res.nom_commune AS nom_commune_residence,
    c.nom_commune AS nom_commune_branchement,
    c.nom_commune,
    d.adresse_branchement,
    d.observations,
    t.libelle AS type_branchement,
    d.statut_actuel,
    s.libelle AS statut_libelle,
    s.ordre AS statut_ordre,
    d.date_depot,
    d.date_maj,
    dv_agg.montant_total AS montant_devis,
    dv_agg.statut_paiement_global AS statut_paiement
FROM Demandes d
JOIN Demandeurs dem ON dem.id_demandeur = d.id_demandeur
JOIN Agences a ON a.id_agence = d.id_agence
JOIN Communes c ON c.id_commune = d.id_commune
JOIN Communes c_res ON c_res.id_commune = dem.id_commune
JOIN TypesBranchement t ON t.id_type = d.id_type
JOIN Statuts s ON s.code_statut = d.statut_actuel
LEFT JOIN (
    SELECT
        id_demande,
        SUM(montant) AS montant_total,
        CASE
            WHEN COUNT(CASE WHEN statut_paiement <> 'PAYE' THEN 1 END) = 0 THEN 'PAYE'
            ELSE 'IMPAYE'
        END AS statut_paiement_global
    FROM Devis
    GROUP BY id_demande
) dv_agg ON dv_agg.id_demande = d.id_demande;
GO

/* ------------------------------------------------------------
   Donnees de reference minimales pour demarrer
   ------------------------------------------------------------ */
INSERT INTO TypesBranchement (libelle, diametre_defaut) VALUES
(N'Domestique', N'15mm'),
(N'Commercial', N'20mm'),
(N'Industriel', N'25mm'),
(N'Administratif', N'20mm'),
(N'Chantier', N'15mm'),
(N'Borne d\'incendie', NULL),
(N'Extension de réseau AEP', NULL),
(N'Autre', NULL);
GO