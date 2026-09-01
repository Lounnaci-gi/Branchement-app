/* ============================================================
   SCRIPT : Configuration de sécurité SQL Server - Moindre Privilège
   Application : Suivi des Demandes de Branchement AEP
   SGBD : Microsoft SQL Server
   Objectif : Créer un compte de connexion dédié avec les droits
              strictement nécessaires (DML + EXEC) et sans droits
              d'administration (sysadmin / db_owner révoqués).
   ============================================================ */

USE master;
GO

-- 1. Création du Login SQL Server au niveau instance (si non existant)
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

-- 2. Création de l'utilisateur de base de données associé
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'ade_app_user')
BEGIN
    CREATE USER ade_app_user FOR LOGIN ade_app_user;
END
GO

-- 3. Création d'un rôle d'application dédié
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'db_aep_app_role' AND type = 'R')
BEGIN
    CREATE ROLE db_aep_app_role;
END
GO

-- 4. Attribution des permissions DML (Lecture / Écriture) sur les tables nécessaires
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Demandes TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Demandeurs TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.EtudesTechniques TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Devis TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Travaux TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.MarquesCompteur TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.PiecesJointes TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.HistoriqueStatuts TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.Agents TO db_aep_app_role;

-- 5. Attribution des permissions en lecture sur les référentiels et vues
GRANT SELECT ON OBJECT::dbo.Centres TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.Agences TO db_aep_app_role;
GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.Communes TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.TypesBranchement TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.Statuts TO db_aep_app_role;
GRANT SELECT ON OBJECT::dbo.vw_DemandesSynthese TO db_aep_app_role;

-- 6. Attribution du droit d'exécution sur les procédures stockées
GRANT EXECUTE ON OBJECT::dbo.sp_ChangerStatutDemande TO db_aep_app_role;

-- 7. Ajout de l'utilisateur au rôle applicatif
ALTER ROLE db_aep_app_role ADD MEMBER ade_app_user;
GO
