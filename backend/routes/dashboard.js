const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken);

// GET /api/dashboard - indicateurs clés
router.get('/', async (req, res) => {
  try {
    if (!req.agent?.role || (req.agent.role !== 'admin' && !Number.isInteger(req.agent.id_agence))) {
      return res.status(401).json({ erreur: 'Session invalide. Veuillez vous reconnecter.' });
    }

    const pool = await getPool();
    const agenceFilter = req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence';
    const demandeRequest = pool.request();
    if (req.agent.role !== 'admin') demandeRequest.input('id_agence', sql.Int, req.agent.id_agence);

    const parStatut = await demandeRequest.query(`
      WITH DemandesNormalisees AS (
        SELECT
          d.id_demande,
          d.id_agence,
          CASE d.statut_actuel
            WHEN 'ETUDE_EN_COURS' THEN 'DEPOSEE'
            WHEN 'ETUDE_TERMINEE' THEN 'DEVIS_EMIS'
            ELSE d.statut_actuel
          END AS code_statut
        FROM Demandes d
      )
      SELECT s.code_statut, s.libelle, s.ordre, COUNT(dn.id_demande) AS total
      FROM Statuts s
      LEFT JOIN DemandesNormalisees dn ON (
        s.code_statut = 'DEPOSEE' OR dn.code_statut = s.code_statut
      )${agenceFilter.replaceAll('d.', 'dn.')}
      WHERE s.code_statut NOT IN ('ETUDE_EN_COURS', 'ETUDE_TERMINEE')
      GROUP BY s.code_statut, s.libelle, s.ordre
      ORDER BY s.ordre
    `);

    const ceMoisRequest = pool.request();
    if (req.agent.role !== 'admin') ceMoisRequest.input('id_agence', sql.Int, req.agent.id_agence);
    const ceMois = await ceMoisRequest.query(`
      SELECT COUNT(*) AS total FROM Demandes
      WHERE MONTH(date_depot) = MONTH(GETDATE()) AND YEAR(date_depot) = YEAR(GETDATE())${req.agent.role === 'admin' ? '' : ' AND id_agence = @id_agence'}
    `);

    const demandesActivesRequest = pool.request();
    if (req.agent.role !== 'admin') demandesActivesRequest.input('id_agence', sql.Int, req.agent.id_agence);
    const demandesActives = await demandesActivesRequest.query(`
      SELECT COUNT(*) AS total FROM Demandes
      WHERE statut_actuel NOT IN ('REJETEE', 'ANNULEE', 'TRAVAUX_TERMINES', 'SCELLEE')${req.agent.role === 'admin' ? '' : ' AND id_agence = @id_agence'}
    `);

    const paiementRequest = pool.request();
    if (req.agent.role !== 'admin') paiementRequest.input('id_agence', sql.Int, req.agent.id_agence);
    const enAttentePaiement = await paiementRequest.query(`
      SELECT COUNT(*) AS total, ISNULL(SUM(montant), 0) AS montant_total
      FROM Devis dv JOIN Demandes d ON d.id_demande = dv.id_demande
      WHERE dv.statut_paiement = 'IMPAYE'${req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence'}
    `);

    const devisPayes = await paiementRequest.query(`
      SELECT COUNT(*) AS total, ISNULL(SUM(montant), 0) AS montant_total
      FROM Devis dv JOIN Demandes d ON d.id_demande = dv.id_demande
      WHERE dv.statut_paiement = 'PAYE'${req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence'}
    `);

    const detailsDevisPayes = await paiementRequest.query(`
      SELECT
        dv.id_devis,
        dv.id_demande,
        d.numero_demande,
        CASE WHEN dem.est_personne_morale = 1 THEN dem.raison_sociale ELSE dem.nom + ' ' + dem.prenom END AS demandeur,
        dv.numero_devis,
        dv.montant,
        dv.date_paiement,
        dv.mode_paiement,
        dv.numero_recu,
        dv.numero_cheque,
        dv.numero_versement,
        dv.banque
      FROM Devis dv
      JOIN Demandes d ON d.id_demande = dv.id_demande
      JOIN Demandeurs dem ON dem.id_demandeur = d.id_demandeur
      WHERE dv.statut_paiement = 'PAYE'${req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence'}
      ORDER BY dv.date_paiement DESC, dv.id_devis DESC
    `);

    const detailsDevisNonPayes = await paiementRequest.query(`
      SELECT
        dv.id_devis,
        dv.id_demande,
        d.numero_demande,
        CASE WHEN dem.est_personne_morale = 1 THEN dem.raison_sociale ELSE dem.nom + ' ' + dem.prenom END AS demandeur,
        dv.numero_devis,
        dv.montant,
        dv.date_emission,
        dv.statut_paiement
      FROM Devis dv
      JOIN Demandes d ON d.id_demande = dv.id_demande
      JOIN Demandeurs dem ON dem.id_demandeur = d.id_demandeur
      WHERE dv.statut_paiement = 'IMPAYE'${req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence'}
      ORDER BY dv.date_emission DESC, dv.id_devis DESC
    `);

    const delaiRequest = pool.request();
    if (req.agent.role !== 'admin') delaiRequest.input('id_agence', sql.Int, req.agent.id_agence);
    const delaiMoyenJours = await delaiRequest.query(`
      SELECT AVG(DATEDIFF(day, date_depot, date_maj)) AS delai_moyen
      FROM Demandes
      WHERE statut_actuel = 'TRAVAUX_TERMINES'${req.agent.role === 'admin' ? '' : ' AND id_agence = @id_agence'}
    `);

    res.json({
      parStatut: parStatut.recordset || [],
      demandesActives: demandesActives.recordset?.[0]?.total ?? 0,
      demandesCeMois: ceMois.recordset?.[0]?.total ?? 0,
      enAttentePaiement: enAttentePaiement.recordset?.[0] ?? { total: 0, montant_total: 0 },
      devisPayes: {
        ...(devisPayes.recordset?.[0] ?? { total: 0, montant_total: 0 }),
        details: detailsDevisPayes.recordset || []
      },
      devisNonPayes: {
        ...(enAttentePaiement.recordset?.[0] ?? { total: 0, montant_total: 0 }),
        details: detailsDevisNonPayes.recordset || []
      },
      delaiMoyenJours: delaiMoyenJours.recordset?.[0]?.delai_moyen || 0
    });
  } catch (err) {
    console.error('[DASHBOARD ERROR]', err);
    res.status(500).json({ erreur: 'Erreur lors du chargement du tableau de bord.' });
  }
});

module.exports = router;
