const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.use(verifierToken, autoriserRoles('admin'));

router.get('/tva', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT type_tva, taux, CONVERT(varchar(10), date_effet, 23) AS date_effet
      FROM HistoriqueTva
      ORDER BY date_effet DESC, type_tva
    `);
    const historique = result.recordset.map((ligne) => ({
      type: ligne.type_tva,
      taux: Number(ligne.taux),
      dateEffet: ligne.date_effet
    }));
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const valeurApplicable = (type) => historique.find((ligne) => ligne.type === type && ligne.dateEffet <= aujourdHui);
    res.json({
      tvaPrestation: valeurApplicable('PRESTATION')?.taux ?? 19,
      tvaTravaux: valeurApplicable('TRAVAUX')?.taux ?? 19,
      historique
    });
  } catch (err) {
    console.error('Erreur lecture paramètres TVA:', err);
    res.status(500).json({ erreur: 'Impossible de charger les paramètres TVA.' });
  }
});

router.put('/tva', async (req, res) => {
  const tvaPrestation = Number(req.body.tvaPrestation);
  const tvaTravaux = Number(req.body.tvaTravaux);
  const dateEffet = String(req.body.dateEffet || '').trim();
  const correspondanceDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateEffet);
  const dateObjet = correspondanceDate
    ? new Date(Date.UTC(
        Number(correspondanceDate[1]),
        Number(correspondanceDate[2]) - 1,
        Number(correspondanceDate[3])
      ))
    : null;
  const dateValide = Boolean(dateObjet)
    && dateObjet.toISOString().slice(0, 10) === dateEffet;
  if (![tvaPrestation, tvaTravaux].every((taux) => Number.isFinite(taux) && taux >= 0 && taux <= 100) || !dateValide) {
    return res.status(400).json({ erreur: 'Les taux de TVA doivent être compris entre 0 et 100.' });
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input('tvaPrestation', sql.Decimal(5, 2), tvaPrestation)
      .input('tvaTravaux', sql.Decimal(5, 2), tvaTravaux)
      .input('dateEffet', sql.Date, dateObjet)
      .query(`
        MERGE HistoriqueTva AS cible
        USING (VALUES
          (N'PRESTATION', @tvaPrestation, @dateEffet),
          (N'TRAVAUX', @tvaTravaux, @dateEffet)
        ) AS source(type_tva, taux, date_effet)
        ON cible.type_tva = source.type_tva AND cible.date_effet = source.date_effet
        WHEN MATCHED THEN UPDATE SET taux = source.taux
        WHEN NOT MATCHED THEN INSERT (type_tva, taux, date_effet)
          VALUES (source.type_tva, source.taux, source.date_effet);
      `);
    res.json({ tvaPrestation, tvaTravaux, dateEffet });
  } catch (err) {
    console.error('Erreur mise à jour paramètres TVA:', err);
    res.status(500).json({ erreur: 'Impossible d’enregistrer les paramètres TVA.' });
  }
});

module.exports = router;