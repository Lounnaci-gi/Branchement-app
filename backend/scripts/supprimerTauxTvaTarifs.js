require('dotenv').config();
const { getPool } = require('../config/db');

async function supprimerTauxTvaTarifs() {
  const pool = await getPool();
  await pool.request().query(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TarifsArticlesDevis') AND name = 'taux_tva')
    BEGIN
      DECLARE @dropConstraints NVARCHAR(MAX) = N'';
      SELECT @dropConstraints += N'ALTER TABLE dbo.TarifsArticlesDevis DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
      FROM sys.default_constraints dc
      INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
      WHERE c.object_id = OBJECT_ID('dbo.TarifsArticlesDevis') AND c.name = 'taux_tva';
      SELECT @dropConstraints += N'ALTER TABLE dbo.TarifsArticlesDevis DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
      FROM sys.check_constraints cc
      WHERE cc.parent_object_id = OBJECT_ID('dbo.TarifsArticlesDevis')
        AND cc.definition LIKE '%taux_tva%';
      IF @dropConstraints <> N'' EXEC sp_executesql @dropConstraints;
      ALTER TABLE dbo.TarifsArticlesDevis DROP COLUMN taux_tva;
    END;
  `);
  console.log('Colonne TarifsArticlesDevis.taux_tva supprimée ou déjà absente.');
  process.exit(0);
}

supprimerTauxTvaTarifs().catch((err) => {
  console.error('Erreur lors de la suppression de TarifsArticlesDevis.taux_tva:', err.message || err);
  process.exit(1);
});