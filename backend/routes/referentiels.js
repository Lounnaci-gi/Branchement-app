const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

function texteValide(valeur, { maxLength = 200, obligatoire = false } = {}) {
  const text = typeof valeur === 'string' ? valeur.trim() : '';
  if (!text && !obligatoire) return true;
  if (!text && obligatoire) return false;
  if (text.length > maxLength) return false;
  return !/[<>]|javascript:|on\w+\s*=|[\u0000-\u001F\u007F]/i.test(text);
}

router.use(verifierToken);

router.get('/communes', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT c.id_commune, c.nom_commune, c.wilaya, c.id_agence, a.nom_agence
      FROM Communes c
      INNER JOIN Agences a ON a.id_agence = c.id_agence
      ORDER BY c.nom_commune
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des communes.' });
  }
});

router.post('/communes', autoriserRoles('admin'), async (req, res) => {
  const { nom_commune, wilaya, id_agence } = req.body;
  if (!texteValide(nom_commune, { maxLength: 100, obligatoire: true }) || !texteValide(wilaya, { maxLength: 100, obligatoire: true }) || !Number.isInteger(Number(id_agence))) {
    return res.status(400).json({ erreur: 'Nom, wilaya et agence sont requis et valides.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('nom_commune', sql.NVarChar(100), nom_commune.trim())
      .input('wilaya', sql.NVarChar(100), wilaya.trim())
      .input('id_agence', sql.Int, Number(id_agence))
      .query(`
        INSERT INTO Communes (nom_commune, wilaya, id_agence)
        OUTPUT INSERTED.id_commune, INSERTED.nom_commune, INSERTED.wilaya, INSERTED.id_agence
        VALUES (@nom_commune, @wilaya, @id_agence)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    if (err.number === 547) {
      return res.status(400).json({ erreur: 'Cette agence n\u2019existe pas.' });
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de l\u2019ajout de la commune.' });
  }
});

router.get('/types-branchement', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT id_type, libelle, diametre_defaut FROM TypesBranchement ORDER BY libelle`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des types de branchement.' });
  }
});

router.get('/banques', async (req, res) => {
  try {
    const pool = await getPool();
    const agenceFilter = req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence';
    const request = pool.request();
    if (req.agent.role !== 'admin') request.input('id_agence', sql.Int, req.agent.id_agence);
    const result = await request.query(`
      SELECT DISTINCT d.banque
      FROM Devis d
      INNER JOIN Demandes dem ON dem.id_demande = d.id_demande
      WHERE NULLIF(LTRIM(RTRIM(d.banque)), '') IS NOT NULL${agenceFilter}
      ORDER BY d.banque
    `);
    res.json(result.recordset.map((banque) => banque.banque));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des banques.' });
  }
});

router.get('/marques-compteur', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT libelle
      FROM MarquesCompteur
      ORDER BY libelle
    `);
    res.json(result.recordset.map((marque) => marque.libelle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des marques de compteur.' });
  }
});

router.get('/statuts', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT code_statut, libelle, ordre, est_final FROM Statuts ORDER BY ordre`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des statuts.' });
  }
});

router.get('/agences', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT id_agence, nom_agence, code_agence, id_centre FROM Agences ORDER BY nom_agence`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des agences.' });
  }
});

module.exports = router;
