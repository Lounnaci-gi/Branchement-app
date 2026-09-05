/* ============================================================
   RECONSTRUCTION COMPLETE — BASE DE DONNEES BranchementAEP
   SGBD : Microsoft SQL Server
   Assemblage de : schema.sql + seed-referentiel.sql
                   + securite-moindre-privilege.sql
   Corrections apportées lors de l'assemblage :
     1) schema.sql ligne ~423 : N'Borne d\'incendie' utilisait un
        antislash pour échapper le guillemet (invalide en T-SQL,
        provoque une erreur de syntaxe). Corrigé en N'Borne d''incendie'.
     2) securite-moindre-privilege.sql n'accordait aucun droit sur
        LignesDevis, FamillesArticles, ArticlesDevis,
        TarifsArticlesDevis, HistoriqueModificationsDemandes.
        Ces GRANT ont été ajoutés (section 4bis) car l'application
        en a besoin (détail des devis, catalogue d'articles/tarifs,
        journal de modifications).
   Date : 2026-09-05
   ============================================================ */

/* ============================================================
   ETAPE 0 — (RE)CREATION DE LA BASE
   ATTENTION : DROP DATABASE supprime définitivement les données
   existantes. Commentez ce bloc si vous ne voulez pas repartir
   de zéro.
   ============================================================ */
USE master;
GO
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = N'BranchementAEP')
BEGIN
    ALTER DATABASE BranchementAEP SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE BranchementAEP;
END
GO

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
('SCELLEE',             N'Demande scellée',            8, 1),
('REJETEE',             N'Demande rejetée',            9, 1),
('ANNULEE',             N'Demande annulée',            10, 1);

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
    observations        NVARCHAR(MAX) NULL,
    est_verrouillee     BIT NOT NULL DEFAULT 0
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

CREATE TABLE HistoriqueModificationsDemandes (
    id_historique_modification INT IDENTITY(1,1) PRIMARY KEY,
    id_demande                 INT NOT NULL REFERENCES Demandes(id_demande),
    id_agent                   INT NOT NULL REFERENCES Agents(id_agent),
    type_action                NVARCHAR(50) NOT NULL DEFAULT 'MODIFICATION_DEMANDE',
    description                NVARCHAR(255) NOT NULL,
    details                    NVARCHAR(MAX) NULL,
    date_modification          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
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

CREATE TABLE LignesDevis (
    id_ligne            INT IDENTITY(1,1) PRIMARY KEY,
    id_devis            INT NOT NULL REFERENCES Devis(id_devis) ON DELETE CASCADE,
    code_article        NVARCHAR(50) NOT NULL,
    libelle             NVARCHAR(150) NOT NULL,
    unite               NVARCHAR(20) NULL,
    diametre            NVARCHAR(50) NULL,
    quantite            DECIMAL(10,2) NOT NULL DEFAULT 1,
    prix_unitaire       DECIMAL(12,2) NOT NULL DEFAULT 0,
    montant_ht          DECIMAL(12,2) NOT NULL DEFAULT 0,
    type_tva            NVARCHAR(20) NULL,
    taux_tva            DECIMAL(5,2) NOT NULL DEFAULT 19,
    ordre               INT NOT NULL DEFAULT 0,
    choix_prix          NVARCHAR(20) NULL,
    type_ligne          NVARCHAR(20) NULL,
    prix_fourniture     DECIMAL(12,2) NULL,
    prix_pose           DECIMAL(12,2) NULL
);

/* ------------------------------------------------------------
   10. REFERENTIEL DES ARTICLES DE DEVIS
   ------------------------------------------------------------ */
CREATE TABLE FamillesArticles (
    id_famille      INT IDENTITY(1,1) PRIMARY KEY,
    code_famille    NVARCHAR(50) NOT NULL UNIQUE,
    libelle         NVARCHAR(100) NOT NULL,
    actif           BIT NOT NULL DEFAULT 1
);

CREATE TABLE ArticlesDevis (
    id_article      INT IDENTITY(1,1) PRIMARY KEY,
    id_famille      INT NOT NULL REFERENCES FamillesArticles(id_famille),
    code_article    NVARCHAR(50) NOT NULL UNIQUE,
    libelle         NVARCHAR(150) NOT NULL,
    matiere         NVARCHAR(50) NULL,
    couleur         NVARCHAR(50) NULL,
    unite           NVARCHAR(20) NOT NULL CONSTRAINT CK_ArticlesDevis_Unite CHECK (unite IN (N'U', N'ML', N'M²', N'M3', N'KG')),
    mode_prix       NVARCHAR(20) NOT NULL DEFAULT N'FOURNITURE_POSE' CONSTRAINT CK_ArticlesDevis_ModePrix CHECK (mode_prix IN (N'PRESTATION', N'FOURNITURE_POSE')),
    prix_unitaire   DECIMAL(12,2) NOT NULL CONSTRAINT CK_ArticlesDevis_Prix CHECK (prix_unitaire >= 0),
    prix_fourniture DECIMAL(12,2) NULL CONSTRAINT CK_ArticlesDevis_PrixFourniture CHECK (prix_fourniture IS NULL OR prix_fourniture >= 0),
    prix_pose       DECIMAL(12,2) NULL CONSTRAINT CK_ArticlesDevis_PrixPose CHECK (prix_pose IS NULL OR prix_pose >= 0),
    type_tva        NVARCHAR(20) NOT NULL DEFAULT N'PRESTATION' CONSTRAINT CK_ArticlesDevis_TypeTva CHECK (type_tva IN (N'PRESTATION', N'TRAVAUX')),
    taux_tva        DECIMAL(5,2) NOT NULL DEFAULT 19 CONSTRAINT CK_ArticlesDevis_TauxTva CHECK (taux_tva >= 0 AND taux_tva <= 100),
    avec_diametre   BIT NOT NULL DEFAULT 0,
    actif           BIT NOT NULL DEFAULT 1
);

CREATE TABLE TarifsArticlesDevis (
    id_tarif        INT IDENTITY(1,1) PRIMARY KEY,
    id_article      INT NOT NULL REFERENCES ArticlesDevis(id_article),
    mode_prix       NVARCHAR(20) NOT NULL CONSTRAINT CK_TarifsArticles_ModePrix CHECK (mode_prix IN (N'PRESTATION', N'FOURNITURE_POSE')),
    prix_unitaire   DECIMAL(12,2) NOT NULL CONSTRAINT CK_TarifsArticles_Prix CHECK (prix_unitaire >= 0),
    prix_fourniture DECIMAL(12,2) NULL CONSTRAINT CK_TarifsArticles_PrixFourniture CHECK (prix_fourniture IS NULL OR prix_fourniture >= 0),
    prix_pose       DECIMAL(12,2) NULL CONSTRAINT CK_TarifsArticles_PrixPose CHECK (prix_pose IS NULL OR prix_pose >= 0),
    type_tva        NVARCHAR(20) NOT NULL CONSTRAINT CK_TarifsArticles_TypeTva CHECK (type_tva IN (N'PRESTATION', N'TRAVAUX')),
    taux_tva        DECIMAL(5,2) NOT NULL CONSTRAINT CK_TarifsArticles_TauxTva CHECK (taux_tva >= 0 AND taux_tva <= 100),
    date_debut      DATE NOT NULL,
    date_fin        DATE NULL,
    CONSTRAINT CK_TarifsArticles_Periode CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

/* ------------------------------------------------------------
   11. TRAVAUX D'EXECUTION
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
    12. REFERENCES COMPTEURS
   ------------------------------------------------------------ */
CREATE TABLE MarquesCompteur (
    id_marque             INT IDENTITY(1,1) PRIMARY KEY,
    libelle               NVARCHAR(50) NOT NULL UNIQUE,
    date_creation         DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

/* ------------------------------------------------------------
    13. PIECES JOINTES
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
CREATE INDEX IX_HistoriqueModifications_Demande ON HistoriqueModificationsDemandes(id_demande);

CREATE INDEX IX_Demandeurs_Commune ON Demandeurs(id_commune);
CREATE INDEX IX_Demandeurs_Nom_Prenom ON Demandeurs(nom, prenom);
CREATE INDEX IX_Demandeurs_Telephone ON Demandeurs(telephone);
CREATE INDEX IX_Demandeurs_TelephoneSecondaire ON Demandeurs(telephone_secondaire);
CREATE INDEX IX_Demandeurs_RaisonSociale ON Demandeurs(raison_sociale);
CREATE INDEX IX_Demandeurs_CIN ON Demandeurs(cin);

CREATE INDEX IX_Devis_Demande ON Devis(id_demande);
CREATE INDEX IX_Devis_StatutPaiement ON Devis(statut_paiement);
CREATE INDEX IX_LignesDevis_Devis ON LignesDevis(id_devis);

CREATE INDEX IX_Travaux_NumeroCompteur ON Travaux(numero_compteur);
CREATE INDEX IX_MarquesCompteur_Libelle ON MarquesCompteur(libelle);
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
   CORRIGE : N'Borne d''incendie' (échappement par doublement du
   guillemet, l'antislash de schema.sql original était invalide)
   ------------------------------------------------------------ */
INSERT INTO TypesBranchement (libelle, diametre_defaut) VALUES
(N'Domestique', N'15mm'),
(N'Commercial', N'20mm'),
(N'Industriel', N'25mm'),
(N'Administratif', N'20mm'),
(N'Chantier', N'15mm'),
(N'Borne d''incendie', NULL),
(N'Extension de réseau AEP', NULL),
(N'Autre', NULL);
GO

/* ============================================================
   ETAPE 1 — DONNEES DE REFERENCE (seed-referentiel.sql)
   ============================================================ */
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

-- NOTE : TypesBranchement contient déjà 'Borne d'incendie' (inséré ci-dessus
-- dans schema.sql). Ce IF NOT EXISTS ne réinsère donc rien — conservé pour
-- rester fidèle au script d'origine.
IF NOT EXISTS (SELECT 1 FROM TypesBranchement WHERE libelle = N'Borne d''incendie')
BEGIN
    INSERT INTO TypesBranchement (libelle, diametre_defaut) VALUES
    (N'Borne d''incendie', NULL);
END
GO

IF NOT EXISTS (SELECT 1 FROM FamillesArticles)
BEGIN
        INSERT INTO FamillesArticles (code_famille, libelle) VALUES
            (N'RACCORDEMENTS', N'Raccordements'),
            (N'MATERIEL', N'Matériel de pose'),
            (N'TRAVAUX', N'Travaux / main d’œuvre');
END
GO

IF NOT EXISTS (SELECT 1 FROM ArticlesDevis)
BEGIN
        INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
        SELECT f.id_famille, a.code_article, a.libelle, a.unite, a.mode_prix, a.prix_unitaire, a.prix_fourniture, a.prix_pose
        FROM (VALUES
            (N'RACCORDEMENTS', N'RAC-110', N'Raccord 110 mm', N'U', N'FOURNITURE_POSE', CAST(25000 AS DECIMAL(12,2)), CAST(25000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
            (N'RACCORDEMENTS', N'RAC-160', N'Raccord 160 mm', N'U', N'FOURNITURE_POSE', CAST(32000 AS DECIMAL(12,2)), CAST(32000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
            (N'RACCORDEMENTS', N'VAN-050', N'Vanne 50 mm', N'U', N'FOURNITURE_POSE', CAST(18000 AS DECIMAL(12,2)), CAST(18000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
            (N'RACCORDEMENTS', N'VAN-100', N'Vanne 100 mm', N'U', N'FOURNITURE_POSE', CAST(26000 AS DECIMAL(12,2)), CAST(26000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
            (N'MATERIEL', N'MAT-C', N'Coffret de branchement', N'U', N'FOURNITURE_POSE', CAST(14500 AS DECIMAL(12,2)), CAST(14500 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
            (N'MATERIEL', N'MAT-P', N'Pieds / supports', N'U', N'FOURNITURE_POSE', CAST(7000 AS DECIMAL(12,2)), CAST(7000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
            (N'MATERIEL', N'MAT-S', N'Système de sécurité', N'U', N'FOURNITURE_POSE', CAST(12000 AS DECIMAL(12,2)), CAST(12000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2))),
            (N'TRAVAUX', N'TR-FO', N'Fouille / terrassement', N'ML', N'FOURNITURE_POSE', CAST(5500 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2)), CAST(5500 AS DECIMAL(12,2))),
            (N'TRAVAUX', N'TR-RE', N'Réseau et branchement', N'ML', N'FOURNITURE_POSE', CAST(4200 AS DECIMAL(12,2)), CAST(2500 AS DECIMAL(12,2)), CAST(1700 AS DECIMAL(12,2))),
            (N'TRAVAUX', N'TR-PO', N'Pose / raccordement', N'U', N'FOURNITURE_POSE', CAST(18000 AS DECIMAL(12,2)), CAST(0 AS DECIMAL(12,2)), CAST(18000 AS DECIMAL(12,2)))
        ) a(code_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
        INNER JOIN FamillesArticles f ON f.code_famille = a.code_famille;
END
GO

IF NOT EXISTS (SELECT 1 FROM ArticlesDevis WHERE code_article = N'MAT-DA')
BEGIN
    INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
    SELECT id_famille, N'MAT-DA', N'Dalle de protection', N'M²', N'FOURNITURE_POSE', 2800, 1800, 1000
    FROM FamillesArticles WHERE code_famille = N'MATERIEL';
END
IF NOT EXISTS (SELECT 1 FROM ArticlesDevis WHERE code_article = N'MAT-SB')
BEGIN
    INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
    SELECT id_famille, N'MAT-SB', N'Sable de remblai', N'M3', N'FOURNITURE_POSE', 3200, 3200, 0
    FROM FamillesArticles WHERE code_famille = N'MATERIEL';
END
IF NOT EXISTS (SELECT 1 FROM ArticlesDevis WHERE code_article = N'MAT-CI')
BEGIN
    INSERT INTO ArticlesDevis (id_famille, code_article, libelle, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose)
    SELECT id_famille, N'MAT-CI', N'Ciment', N'KG', N'FOURNITURE_POSE', 95, 95, 0
    FROM FamillesArticles WHERE code_famille = N'MATERIEL';
END
GO

UPDATE ArticlesDevis
SET mode_prix = N'FOURNITURE_POSE', prix_fourniture = 2500, prix_pose = 1700
WHERE code_article = N'TR-RE';
UPDATE ArticlesDevis
SET mode_prix = N'FOURNITURE_POSE', prix_fourniture = 1800, prix_pose = 1000
WHERE code_article = N'MAT-DA';
GO

IF NOT EXISTS (SELECT 1 FROM TarifsArticlesDevis)
BEGIN
    INSERT INTO TarifsArticlesDevis (id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, date_debut)
    SELECT id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, CONVERT(date, GETDATE())
    FROM ArticlesDevis;
END
GO

/* ============================================================
   ETAPE 2 — SECURITE / MOINDRE PRIVILEGE
   (securite-moindre-privilege.sql)
   ============================================================ */
USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'ade_app_user')
BEGIN
    CREATE LOGIN ade_app_user
    WITH PASSWORD = N'AEP_Complex_Password_2026!#ChangeMe',
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF;
END
GO

USE BranchementAEP;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'ade_app_user')
BEGIN
    CREATE USER ade_app_user FOR LOGIN ade_app_user;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'db_aep_app_role' AND type = 'R')
BEGIN
    CREATE ROLE db_aep_app_role;
END
GO

-- Permissions DML sur les tables principales
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Demandes TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Demandeurs TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.EtudesTechniques TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Devis TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Travaux TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.MarquesCompteur TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.PiecesJointes TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.HistoriqueStatuts TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.Agents TO db_aep_app_role;

-- AJOUTE : tables couvertes par le schéma mais absentes du script de sécurité d'origine
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.LignesDevis TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.HistoriqueModificationsDemandes TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.FamillesArticles TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.ArticlesDevis TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.TarifsArticlesDevis TO db_aep_app_role;

-- Permissions en lecture sur les référentiels et vues
GRANT SELECT ON OBJECT::dbo.Centres TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.Agences TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.Communes TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.TypesBranchement TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.Statuts TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.vw_DemandesSynthese TO db_aep_app_role;

-- Droit d'exécution sur les procédures stockées
GRANT EXECUTE ON OBJECT::dbo.sp_ChangerStatutDemande TO db_aep_app_role;

-- Ajout de l'utilisateur au rôle applicatif
ALTER ROLE db_aep_app_role ADD MEMBER ade_app_user;
GO

PRINT N'Reconstruction de BranchementAEP terminée.';
GO