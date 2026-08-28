/* Numero d'ordre d'execution des travaux, format 0001/2026 */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

IF COL_LENGTH('Travaux', 'numero_ordre_execution') IS NULL
  ALTER TABLE Travaux ADD numero_ordre_execution NVARCHAR(15) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UX_Travaux_NumeroOrdreExecution' AND object_id = OBJECT_ID('Travaux')
)
  CREATE UNIQUE INDEX UX_Travaux_NumeroOrdreExecution
  ON Travaux(numero_ordre_execution)
  WHERE numero_ordre_execution IS NOT NULL;
GO