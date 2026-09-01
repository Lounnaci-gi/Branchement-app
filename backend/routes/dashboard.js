const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken);

// GET /api/dashboard - indicateurs clés
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const agenceFilter = req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence';
    const demandeRequest = pool.request();
    if (req.agent.role !== 'admin') demandeRequest.input('id_agence', sql.Int, req.agent.id_agence);

    const parStatut = await demandeRequest.query(`
      SELECT s.code_statut, s.libelle, s.ordre, COUNT(d.id_demande) AS total
      FROM Statuts s
      LEFT JOIN Demandes d ON d.statut_actuel = s.code_statut${agenceFilter}
      GROUP BY s.code_statut, s.libelle, s.ordre
      ORDER BY s.ordre
    `);

    const ceMoisRequest = pool.request();
    if (req.agent.role !== 'admin') ceMoisRequest.input('id_agence', sql.Int, req.agent.id_agence);
    const ceMois = await ceMoisRequest.query(`
      SELECT COUNT(*) AS total FROM Demandes
      WHERE MONTH(date_depot) = MONTH(GETDATE()) AND YEAR(date_depot) = YEAR(GETDATE())${req.agent.role === 'admin' ? '' : ' AND id_agence = @id_agence'}
    `);

    const paiementRequest = pool.request();
    if (req.agent.role !== 'admin') paiementRequest.input('id_agence', sql.Int, req.agent.id_agence);
    const enAttentePaiement = await paiementRequest.query(`
      SELECT COUNT(*) AS total, ISNULL(SUM(montant), 0) AS montant_total
      FROM Devis dv JOIN Demandes d ON d.id_demande = dv.id_demande
      WHERE dv.statut_paiement = 'IMPAYE'${req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence'}
    `);

    const delaiRequest = pool.request();
    if (req.agent.role !== 'admin') delaiRequest.input('id_agence', sql.Int, req.agent.id_agence);
    const delaiMoyenJours = await delaiRequest.query(`
      SELECT AVG(DATEDIFF(day, date_depot, date_maj)) AS delai_moyen
      FROM Demandes
      WHERE statut_actuel = 'TRAVAUX_TERMINES'${req.agent.role === 'admin' ? '' : ' AND id_agence = @id_agence'}
    `);

    res.json({
      parStatut: parStatut.recordset,
      demandesCeMois: ceMois.recordset[0].total,
      enAttentePaiement: enAttentePaiement.recordset[0],
      delaiMoyenJours: delaiMoyenJours.recordset[0].delai_moyen || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement du tableau de bord.' });
  }
});

module.exports = router;
