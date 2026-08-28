const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { verifierToken } = require('../middleware/auth');

router.use(verifierToken);

function entierPositif(valeur) {
  const texte = String(valeur ?? '').trim();
  if (!/^\d+$/.test(texte)) return null;
  const entier = Number(texte);
  return Number.isSafeInteger(entier) && entier > 0 ? entier : null;
}

router.param('id', (req, res, next, valeur) => {
  const id = entierPositif(valeur);
  if (id === null) {
    return res.status(400).json({ erreur: 'Identifiant numérique invalide.' });
  }
  req.params.id = id;
  next();
});

// Transitions autorisées du workflow (statut actuel -> statuts suivants possibles)
const TRANSITIONS = {
  DEPOSEE: ['ETUDE_EN_COURS', 'REJETEE', 'ANNULEE'],
  ETUDE_EN_COURS: ['ETUDE_TERMINEE', 'REJETEE', 'ANNULEE'],
  ETUDE_TERMINEE: ['DEVIS_EMIS', 'REJETEE', 'ANNULEE'],
  DEVIS_EMIS: ['DEVIS_PAYE', 'ANNULEE'],
  DEVIS_PAYE: ['TRAVAUX_EN_COURS', 'ANNULEE'],
  TRAVAUX_EN_COURS: ['TRAVAUX_TERMINES'],
  TRAVAUX_TERMINES: ['MISE_EN_SERVICE'],
  MISE_EN_SERVICE: [],
  REJETEE: ['DEPOSEE'],
  ANNULEE: []
};

const QUALITES_DEMANDEUR = ['PROPRIETAIRE', 'LOCATAIRE', 'MANDATAIRE'];
const EMAIL_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

function texteValide(valeur, { maxLength = 150, obligatoire = false } = {}) {
  const text = typeof valeur === 'string' ? valeur.trim() : '';
  if (!text && !obligatoire) return true;
  if (!text && obligatoire) return false;
  if (text.length > maxLength) return false;
  return !/[<>]|javascript:|on\w+\s*=|[\u0000-\u001F\u007F]/i.test(text);
}

function cinValide(demandeur, estPersonneMorale) {
  return estPersonneMorale || demandeur.type_piece_identite !== 'CIN' || /^\d{18}$/.test(String(demandeur.cin || '').trim());
}

function emailValide(email) {
  const value = String(email || '').trim();
  return !value || EMAIL_REGEX.test(value);
}

function coordonneesValides(demandeur) {
  const telephone = String(demandeur.telephone || '').trim();
  const telephoneSecondaire = String(demandeur.telephone_secondaire || '').trim();
  const email = String(demandeur.email || '').trim();
  const telephoneValide = (valeur) => !valeur || /^0[5-7]\d{2} \d{2} \d{2} \d{2}$/.test(valeur);
  return telephoneValide(telephone) && telephoneValide(telephoneSecondaire)
    && emailValide(email)
    && (!email || texteValide(email, { maxLength: 254 }));
}

async function synchroniserStatut(pool, idDemande, nouveauStatut, idAgent, commentaire) {
  const actuel = await pool.request().input('id_demande', sql.Int, idDemande)
    .query('SELECT statut_actuel FROM Demandes WHERE id_demande = @id_demande');
  const statutActuel = actuel.recordset[0]?.statut_actuel;
  if (!statutActuel || statutActuel === nouveauStatut) return;

  await pool.request()
    .input('id_demande', sql.Int, idDemande)
    .input('nouveau_statut', sql.NVarChar, nouveauStatut)
    .input('id_agent', sql.Int, idAgent)
    .input('commentaire', sql.NVarChar, commentaire || null)
    .execute('sp_ChangerStatutDemande');
}

async function genererNumeroOrdreExecution(pool) {
  const annee = new Date().getFullYear();
  const result = await pool.request()
    .input('suffixe', sql.NVarChar(10), `/${annee}`)
    .query(`SELECT COUNT(*) AS total FROM Travaux WHERE numero_ordre_execution LIKE '%' + @suffixe`);
  return `${String(result.recordset[0].total + 1).padStart(4, '0')}/${annee}`;
}

// GET /api/demandes/demandeurs/recherche - demandes existantes d'un demandeur
router.get('/demandeurs/recherche', async (req, res) => {
  try {
    const recherche = String(req.query.q || '').trim();
    const typeRecherche = String(req.query.type || '');
    if (recherche.length < 2) return res.json([]);

    const pool = await getPool();
    const request = pool.request().input('recherche', sql.NVarChar, `%${recherche}%`);
    let agenceFilter = '';
    if (req.agent.role !== 'admin') {
      agenceFilter = ' AND d.id_agence = @id_agence';
      request.input('id_agence', sql.Int, req.agent.id_agence);
    }

    const conditionRecherche = typeRecherche === 'adresse_branchement'
      ? 'd.adresse_branchement LIKE @recherche'
      : typeRecherche === 'adresse'
        ? 'dem.adresse LIKE @recherche'
        : `(
            dem.raison_sociale LIKE @recherche OR
            dem.nom LIKE @recherche OR
            dem.prenom LIKE @recherche OR
            CONCAT(dem.nom, ' ', dem.prenom) LIKE @recherche OR
            dem.telephone LIKE @recherche OR
            dem.telephone_secondaire LIKE @recherche
          )`;

    const result = await request.query(`
      SELECT TOP 10
        d.id_demande, d.numero_demande, d.statut_actuel, d.date_depot,
        dem.est_personne_morale, dem.raison_sociale, dem.nom, dem.prenom, dem.qualite_demandeur,
        dem.cin, dem.type_piece_identite, dem.fils_de, dem.ne_le, dem.cin_delivre_le, dem.cin_delivre_par,
        dem.telephone, dem.telephone_secondaire, dem.email, dem.adresse, dem.id_commune,
        d.adresse_branchement, d.id_commune AS id_commune_branchement,
        c.nom_commune, s.libelle AS statut_libelle
      FROM Demandes d
      JOIN Demandeurs dem ON dem.id_demandeur = d.id_demandeur
      JOIN Communes c ON c.id_commune = dem.id_commune
      JOIN Statuts s ON s.code_statut = d.statut_actuel
      WHERE ${conditionRecherche}${agenceFilter}
      ORDER BY d.date_depot DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la recherche des demandeurs.' });
  }
});

// PUT /api/demandes/:id - modifier les informations d'une demande
router.put('/:id', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    const { demandeur, id_type, type_autre, adresse_branchement, id_commune, observations } = req.body;
    if (!demandeur || !id_type || !adresse_branchement || !id_commune || !demandeur.id_commune || !demandeur.adresse) {
      return res.status(400).json({ erreur: 'Champs obligatoires manquants.' });
    }
    const qualiteDemandeur = String(demandeur.qualite_demandeur || '').trim().toUpperCase();
    if (!QUALITES_DEMANDEUR.includes(qualiteDemandeur)) {
      return res.status(400).json({ erreur: 'La qualité du demandeur est obligatoire.' });
    }

    const typeResult = await pool.request().input('id_type', sql.Int, id_type)
      .query('SELECT libelle FROM TypesBranchement WHERE id_type = @id_type');
    if (typeResult.recordset[0]?.libelle === 'Autre' && !type_autre?.trim()) {
      return res.status(400).json({ erreur: 'Veuillez préciser le type de branchement.' });
    }

    const estPersonneMorale = demandeur.est_personne_morale === true || demandeur.est_personne_morale === 'true';
    if (estPersonneMorale && !texteValide(demandeur.raison_sociale, { maxLength: 150, obligatoire: true })) {
      return res.status(400).json({ erreur: 'La raison sociale est obligatoire et ne doit pas contenir de caractères invalides.' });
    }
    if (!estPersonneMorale && (!texteValide(demandeur.nom, { maxLength: 80, obligatoire: true }) || !texteValide(demandeur.prenom, { maxLength: 80, obligatoire: true }))) {
      return res.status(400).json({ erreur: 'Le nom et le prénom sont obligatoires et valides.' });
    }
    if (!texteValide(demandeur.adresse, { maxLength: 200, obligatoire: true }) || !texteValide(adresse_branchement, { maxLength: 200, obligatoire: true })) {
      return res.status(400).json({ erreur: 'L’adresse du demandeur et l’adresse de branchement sont obligatoires et valides.' });
    }
    if (demandeur.fils_de && !texteValide(demandeur.fils_de, { maxLength: 150 })) {
      return res.status(400).json({ erreur: 'Le champ “fils de” contient des caractères non valides.' });
    }
    if (demandeur.cin_delivre_par && !texteValide(demandeur.cin_delivre_par, { maxLength: 150 })) {
      return res.status(400).json({ erreur: 'Le lieu de délivrance du document contient des caractères invalides.' });
    }
    if (observations && !texteValide(observations, { maxLength: 500 })) {
      return res.status(400).json({ erreur: 'Les observations contiennent des caractères invalides.' });
    }
    if (!cinValide(demandeur, estPersonneMorale)) {
      return res.status(400).json({ erreur: 'Le CIN doit contenir exactement 18 chiffres.' });
    }
    if (!coordonneesValides(demandeur)) {
      return res.status(400).json({ erreur: 'Le téléphone doit être au format 0552 11 74 33 et l\'email doit être valide.' });
    }

    await transaction.begin();
    const demande = await new sql.Request(transaction)
      .input('id_demande', sql.Int, req.params.id)
      .query('SELECT id_demandeur FROM Demandes WHERE id_demande = @id_demande');
    if (demande.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ erreur: 'Demande introuvable.' });
    }

    const idDemandeur = demande.recordset[0].id_demandeur;
    await new sql.Request(transaction)
      .input('id_demandeur', sql.Int, idDemandeur)
      .input('est_personne_morale', sql.Bit, estPersonneMorale)
        .input('qualite_demandeur', sql.NVarChar(20), qualiteDemandeur)
      .input('raison_sociale', sql.NVarChar, estPersonneMorale ? demandeur.raison_sociale.trim() : null)
      .input('nom', sql.NVarChar, estPersonneMorale ? null : demandeur.nom.trim())
      .input('prenom', sql.NVarChar, estPersonneMorale ? null : demandeur.prenom.trim())
      .input('fils_de', sql.NVarChar(150), estPersonneMorale ? null : demandeur.fils_de?.trim() || null)
      .input('ne_le', sql.Date, estPersonneMorale ? null : demandeur.ne_le || null)
      .input('type_piece_identite', sql.NVarChar(10), estPersonneMorale ? null : demandeur.type_piece_identite || null)
      .input('cin', sql.NVarChar, demandeur.cin || null)
      .input('cin_delivre_le', sql.Date, estPersonneMorale ? null : demandeur.cin_delivre_le || null)
      .input('cin_delivre_par', sql.NVarChar(150), estPersonneMorale ? null : demandeur.cin_delivre_par?.trim() || null)
      .input('telephone', sql.NVarChar, demandeur.telephone?.trim() || null)
      .input('telephone_secondaire', sql.NVarChar, demandeur.telephone_secondaire?.trim() || null)
      .input('email', sql.NVarChar, demandeur.email || null)
      .input('adresse', sql.NVarChar, demandeur.adresse.trim())
      .input('id_commune', sql.Int, demandeur.id_commune || id_commune)
      .query(`UPDATE Demandeurs SET est_personne_morale=@est_personne_morale, qualite_demandeur=@qualite_demandeur, raison_sociale=@raison_sociale,
              nom=@nom, prenom=@prenom, fils_de=@fils_de, ne_le=@ne_le, type_piece_identite=@type_piece_identite, cin=@cin,
              cin_delivre_le=@cin_delivre_le, cin_delivre_par=@cin_delivre_par,
              telephone=@telephone, telephone_secondaire=@telephone_secondaire, email=@email,
              adresse=@adresse, id_commune=@id_commune WHERE id_demandeur=@id_demandeur`);

    await new sql.Request(transaction)
      .input('id_demande', sql.Int, req.params.id)
      .input('id_type', sql.Int, id_type)
      .input('type_autre', sql.NVarChar(150), type_autre?.trim() || null)
      .input('adresse_branchement', sql.NVarChar, adresse_branchement.trim())
      .input('id_commune', sql.Int, id_commune)
      .input('observations', sql.NVarChar, observations || null)
            .query(`UPDATE Demandes SET id_type=@id_type, type_autre=@type_autre, adresse_branchement=@adresse_branchement,
              id_commune=@id_commune, observations=@observations, date_maj=SYSDATETIME()
              WHERE id_demande=@id_demande`);

    await transaction.commit();
    res.json({ message: 'Informations de la demande mises à jour.' });
  } catch (err) {
    if (transaction._aborted !== true) await transaction.rollback();
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la modification de la demande.' });
  }
});

async function genererNumeroDemande(pool) {
  const annee = new Date().getFullYear();
  const result = await pool.request()
    .input('suffixe', sql.NVarChar(10), `/${annee}`)
    .query(`SELECT COUNT(*) AS total FROM Demandes WHERE numero_demande LIKE '%' + @suffixe`);
  const compteur = result.recordset[0].total + 1;
  return `${String(compteur).padStart(4, '0')}/${annee}`;
}

async function genererNumeroDevis(pool, idDemande) {
  const annee = new Date().getFullYear();
  const result = await pool.request()
    .input('id_demande', sql.Int, idDemande)
    .input('debut_annee', sql.DateTime2, new Date(`${annee}-01-01T00:00:00`))
    .query(`
      SELECT a.code_agence, COUNT(dv.id_devis) AS total
      FROM Demandes demande_cible
      JOIN Agences a ON a.id_agence = demande_cible.id_agence
      LEFT JOIN Demandes demandes_agence ON demandes_agence.id_agence = a.id_agence
      LEFT JOIN Devis dv
        ON dv.id_demande = demandes_agence.id_demande AND dv.date_emission >= @debut_annee
      WHERE demande_cible.id_demande = @id_demande
      GROUP BY a.code_agence
    `);
  if (result.recordset.length === 0) {
    throw new Error('Demande introuvable pour la numérotation du devis.');
  }
  const compteur = result.recordset[0].total + 1;
  return `${String(compteur).padStart(4, '0')}/${result.recordset[0].code_agence}/${annee}`;
}

// GET /api/demandes - liste avec filtres (statut, agence, commune, recherche, pagination)
router.get('/', async (req, res) => {
  try {
    const { statut, id_commune, recherche, page = 1, taille = 20 } = req.query;
    const pageValide = entierPositif(page);
    const tailleValidee = entierPositif(taille);
    const communeValidee = id_commune === undefined ? null : entierPositif(id_commune);
    if (pageValide === null || tailleValidee === null || tailleValidee > 100 || (id_commune !== undefined && communeValidee === null)) {
      return res.status(400).json({ erreur: 'Les paramètres de pagination ou de commune sont invalides.' });
    }
    // Valider le filtre statut contre la whitelist des codes connus
    if (statut !== undefined && !Object.prototype.hasOwnProperty.call(TRANSITIONS, statut)) {
      return res.status(400).json({ erreur: 'Le statut de filtre est invalide.' });
    }


    const pool = await getPool();
    const request = pool.request();

    let where = '1=1';
    if (statut) {
      where += ' AND statut_actuel = @statut';
      request.input('statut', sql.NVarChar, statut);
    }
    if (communeValidee !== null) {
      where += ' AND id_commune = @id_commune';
      request.input('id_commune', sql.Int, communeValidee);
    }
    // Restreint automatiquement à l'agence de l'agent, sauf admin
    if (req.agent.role !== 'admin') {
      where += ' AND nom_agence = (SELECT nom_agence FROM Agences WHERE id_agence = @id_agence)';
      request.input('id_agence', sql.Int, req.agent.id_agence);
    }
    if (recherche) {
      where += ` AND (numero_demande LIKE @recherche OR demandeur LIKE @recherche OR telephone LIKE @recherche OR telephone_secondaire LIKE @recherche)`;
      request.input('recherche', sql.NVarChar, `%${recherche}%`);
    }

    const offset = (pageValide - 1) * tailleValidee;
    request.input('offset', sql.Int, offset);
    request.input('taille', sql.Int, tailleValidee);

    const result = await request.query(`
      SELECT * FROM vw_DemandesSynthese
      WHERE ${where}
      ORDER BY date_depot DESC
      OFFSET @offset ROWS FETCH NEXT @taille ROWS ONLY
    `);

    const countRequest = pool.request();
    if (statut) countRequest.input('statut', sql.NVarChar, statut);
    if (communeValidee !== null) countRequest.input('id_commune', sql.Int, communeValidee);
    if (req.agent.role !== 'admin') countRequest.input('id_agence', sql.Int, req.agent.id_agence);
    if (recherche) countRequest.input('recherche', sql.NVarChar, `%${recherche}%`);

    const totalResult = await countRequest.query(`SELECT COUNT(*) AS total FROM vw_DemandesSynthese WHERE ${where}`);

    res.json({
      demandes: result.recordset,
      total: totalResult.recordset[0].total,
      page: pageValide,
      taille: tailleValidee
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la récupération des demandes.' });
  }
});

// DELETE /api/demandes/:id - supprimer une demande uniquement si le devis n'est pas payé
router.delete('/:id', async (req, res) => {
  const id_demande = req.params.id;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionDemarree = false;

  try {
    const demande = await pool.request()
      .input('id_demande', sql.Int, id_demande)
      .query(`SELECT d.id_demande, d.id_agence, dv.statut_paiement
              FROM Demandes d
              LEFT JOIN Devis dv ON dv.id_demande = d.id_demande
              WHERE d.id_demande = @id_demande`);

    const demandeCible = demande.recordset[0];
    if (!demandeCible) {
      return res.status(404).json({ erreur: 'Demande introuvable.' });
    }
    if (req.agent.role !== 'admin' && demandeCible.id_agence !== req.agent.id_agence) {
      return res.status(403).json({ erreur: 'Vous ne pouvez pas supprimer cette demande.' });
    }
    if (demandeCible.statut_paiement === 'PAYE') {
      return res.status(400).json({ erreur: 'Cette demande ne peut pas être supprimée car le devis est payé.' });
    }

    await transaction.begin();
    transactionDemarree = true;
    const supprimer = new sql.Request(transaction).input('id_demande', sql.Int, id_demande);
    await supprimer.query('DELETE FROM HistoriqueStatuts WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM EtudesTechniques WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM Devis WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM Travaux WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM MisesEnService WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM PiecesJointes WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM Demandes WHERE id_demande = @id_demande');
    await transaction.commit();

    res.json({ message: 'Demande supprimée.' });
  } catch (err) {
    if (transactionDemarree) await transaction.rollback();
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la suppression de la demande.' });
  }
});

// GET /api/demandes/:id - fiche complète d'une demande
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    const demande = await pool.request().input('id', sql.Int, id).query(`
            SELECT d.*, dem.nom AS demandeur_nom, dem.prenom AS demandeur_prenom,
              dem.est_personne_morale, dem.raison_sociale, dem.qualite_demandeur,
             dem.telephone, dem.telephone_secondaire, dem.email AS demandeur_email, dem.cin, dem.type_piece_identite, dem.fils_de, dem.ne_le,
             dem.cin_delivre_le, dem.cin_delivre_par, dem.adresse AS demandeur_adresse,
                  dem.id_commune AS id_commune_residence, c_res.nom_commune AS nom_commune_residence,
             a.nom_agence, c.nom_commune, t.libelle AS type_branchement, s.libelle AS statut_libelle
      FROM Demandes d
      JOIN Demandeurs dem ON dem.id_demandeur = d.id_demandeur
      JOIN Agences a ON a.id_agence = d.id_agence
      JOIN Communes c ON c.id_commune = d.id_commune
                JOIN Communes c_res ON c_res.id_commune = dem.id_commune
      JOIN TypesBranchement t ON t.id_type = d.id_type
      JOIN Statuts s ON s.code_statut = d.statut_actuel
      WHERE d.id_demande = @id
    `);

    if (demande.recordset.length === 0) {
      return res.status(404).json({ erreur: 'Demande introuvable.' });
    }

    const historique = await pool.request().input('id', sql.Int, id).query(`
      SELECT h.*, s.libelle AS statut_libelle, s.ordre, ag.nom + ' ' + ag.prenom AS agent_nom
      FROM HistoriqueStatuts h
      JOIN Statuts s ON s.code_statut = h.code_statut
      JOIN Agents ag ON ag.id_agent = h.id_agent
      WHERE h.id_demande = @id
      ORDER BY h.date_changement ASC
    `);

    const etude = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM EtudesTechniques WHERE id_demande = @id`);
    const devis = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM Devis WHERE id_demande = @id`);
    const travaux = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM Travaux WHERE id_demande = @id`);
    const miseEnService = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM MisesEnService WHERE id_demande = @id`);
    const pieces = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM PiecesJointes WHERE id_demande = @id`);

    res.json({
      demande: demande.recordset[0],
      historique: historique.recordset,
      etude: etude.recordset[0] || null,
      devis: devis.recordset[0] || null,
      travaux: travaux.recordset[0] || null,
      miseEnService: miseEnService.recordset[0] || null,
      pieces: pieces.recordset,
      transitionsPossibles: TRANSITIONS[demande.recordset[0].statut_actuel] || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la récupération de la demande.' });
  }
});

// POST /api/demandes - créer une nouvelle demande (+ demandeur si nouveau)
router.post('/', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionDemarree = false;
  try {
    const {
      demandeur, // { est_personne_morale, qualite_demandeur, raison_sociale, nom, prenom, cin, telephone, telephone_secondaire, email, adresse, id_commune }
      id_type,
      type_autre,
      adresse_branchement,
      id_commune,
      observations
    } = req.body;

    if (!demandeur || !id_type || !adresse_branchement || !id_commune || !demandeur.id_commune) {
      return res.status(400).json({ erreur: 'Champs obligatoires manquants.' });
    }
    const qualiteDemandeur = String(demandeur.qualite_demandeur || '').trim().toUpperCase();
    if (!QUALITES_DEMANDEUR.includes(qualiteDemandeur)) {
      return res.status(400).json({ erreur: 'La qualité du demandeur est obligatoire.' });
    }

    const typeResult = await pool.request().input('id_type', sql.Int, id_type)
      .query('SELECT libelle FROM TypesBranchement WHERE id_type = @id_type');
    if (typeResult.recordset[0]?.libelle === 'Autre' && !type_autre?.trim()) {
      return res.status(400).json({ erreur: 'Veuillez préciser le type de branchement.' });
    }

    const estPersonneMorale = Boolean(demandeur.est_personne_morale);
    if (estPersonneMorale && !texteValide(demandeur.raison_sociale, { maxLength: 150, obligatoire: true })) {
      return res.status(400).json({ erreur: 'La raison sociale est obligatoire et ne doit pas contenir de caractères invalides.' });
    }
    if (!estPersonneMorale && (!texteValide(demandeur.nom, { maxLength: 80, obligatoire: true }) || !texteValide(demandeur.prenom, { maxLength: 80, obligatoire: true }))) {
      return res.status(400).json({ erreur: 'Le nom et le prénom sont obligatoires et valides.' });
    }
    if (!texteValide(demandeur.adresse, { maxLength: 200, obligatoire: true }) || !texteValide(adresse_branchement, { maxLength: 200, obligatoire: true })) {
      return res.status(400).json({ erreur: 'L’adresse du demandeur et l’adresse de branchement sont obligatoires et valides.' });
    }
    if (demandeur.fils_de && !texteValide(demandeur.fils_de, { maxLength: 150 })) {
      return res.status(400).json({ erreur: 'Le champ “fils de” contient des caractères non valides.' });
    }
    if (demandeur.cin_delivre_par && !texteValide(demandeur.cin_delivre_par, { maxLength: 150 })) {
      return res.status(400).json({ erreur: 'Le lieu de délivrance du document contient des caractères invalides.' });
    }
    if (observations && !texteValide(observations, { maxLength: 500 })) {
      return res.status(400).json({ erreur: 'Les observations contiennent des caractères invalides.' });
    }
    if (!cinValide(demandeur, estPersonneMorale)) {
      return res.status(400).json({ erreur: 'Le CIN doit contenir exactement 18 chiffres.' });
    }
    if (!coordonneesValides(demandeur)) {
      return res.status(400).json({ erreur: 'Le téléphone doit être au format 0552 11 74 33 et l\'email doit être valide.' });
    }

    await transaction.begin();
    transactionDemarree = true;

    const reqDemandeur = new sql.Request(transaction);
    const resultDemandeur = await reqDemandeur
      .input('est_personne_morale', sql.Bit, estPersonneMorale)
      .input('qualite_demandeur', sql.NVarChar(20), qualiteDemandeur)
      .input('raison_sociale', sql.NVarChar, estPersonneMorale ? demandeur.raison_sociale.trim() : null)
      .input('nom', sql.NVarChar, estPersonneMorale ? null : demandeur.nom.trim())
      .input('prenom', sql.NVarChar, estPersonneMorale ? null : demandeur.prenom.trim())
      .input('fils_de', sql.NVarChar(150), estPersonneMorale ? null : demandeur.fils_de?.trim() || null)
      .input('ne_le', sql.Date, estPersonneMorale ? null : demandeur.ne_le || null)
      .input('type_piece_identite', sql.NVarChar(10), estPersonneMorale ? null : demandeur.type_piece_identite || null)
      .input('cin', sql.NVarChar, demandeur.cin || null)
      .input('cin_delivre_le', sql.Date, estPersonneMorale ? null : demandeur.cin_delivre_le || null)
      .input('cin_delivre_par', sql.NVarChar(150), estPersonneMorale ? null : demandeur.cin_delivre_par?.trim() || null)
      .input('telephone', sql.NVarChar, demandeur.telephone?.trim() || null)
      .input('telephone_secondaire', sql.NVarChar, demandeur.telephone_secondaire?.trim() || null)
      .input('email', sql.NVarChar, demandeur.email || null)
      .input('adresse', sql.NVarChar, demandeur.adresse)
      .input('id_commune', sql.Int, demandeur.id_commune)
            .query(`INSERT INTO Demandeurs (est_personne_morale, qualite_demandeur, raison_sociale, nom, prenom, fils_de, ne_le, type_piece_identite, cin, cin_delivre_le, cin_delivre_par, telephone, telephone_secondaire, email, adresse, id_commune)
              OUTPUT INSERTED.id_demandeur
              VALUES (@est_personne_morale, @qualite_demandeur, @raison_sociale, @nom, @prenom, @fils_de, @ne_le, @type_piece_identite, @cin, @cin_delivre_le, @cin_delivre_par, @telephone, @telephone_secondaire, @email, @adresse, @id_commune)`);

    const id_demandeur = resultDemandeur.recordset[0].id_demandeur;
    const numero_demande = await genererNumeroDemande(pool);

    const reqDemande = new sql.Request(transaction);
    const resultDemande = await reqDemande
      .input('numero_demande', sql.NVarChar, numero_demande)
      .input('id_demandeur', sql.Int, id_demandeur)
      .input('id_agence', sql.Int, req.agent.id_agence)
      .input('id_type', sql.Int, id_type)
      .input('type_autre', sql.NVarChar(150), type_autre?.trim() || null)
      .input('adresse_branchement', sql.NVarChar, adresse_branchement)
      .input('id_commune', sql.Int, id_commune)
      .input('id_agent_creation', sql.Int, req.agent.id_agent)
      .input('observations', sql.NVarChar, observations || null)
            .query(`DECLARE @demande_inseree TABLE (id_demande INT, numero_demande NVARCHAR(30), date_depot DATETIME2);
              INSERT INTO Demandes
              (numero_demande, id_demandeur, id_agence, id_type, type_autre, adresse_branchement, id_commune, id_agent_creation, observations)
              OUTPUT INSERTED.id_demande, INSERTED.numero_demande, INSERTED.date_depot INTO @demande_inseree
              VALUES (@numero_demande, @id_demandeur, @id_agence, @id_type, @type_autre, @adresse_branchement, @id_commune, @id_agent_creation, @observations);
              SELECT id_demande, numero_demande, date_depot FROM @demande_inseree`);

    await transaction.commit();

    res.status(201).json({
      id_demande: resultDemande.recordset[0].id_demande,
      numero_demande,
      date_depot: resultDemande.recordset[0].date_depot
    });
  } catch (err) {
    if (transactionDemarree && transaction._aborted !== true) {
      await transaction.rollback();
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la création de la demande.' });
  }
});

// PATCH /api/demandes/:id/statut - transition de statut (workflow)
router.patch('/:id/statut', async (req, res) => {
  try {
    const { nouveau_statut, commentaire } = req.body;
    const id_demande = req.params.id;

    // Whitelist : nouveau_statut doit être un code connu du workflow
    if (typeof nouveau_statut !== 'string' || !Object.prototype.hasOwnProperty.call(TRANSITIONS, nouveau_statut)) {
      return res.status(400).json({ erreur: 'Statut cible invalide ou inconnu.' });
    }

    const pool = await getPool();

    const actuel = await pool.request().input('id', sql.Int, id_demande)
      .query(`SELECT statut_actuel FROM Demandes WHERE id_demande = @id`);

    if (actuel.recordset.length === 0) {
      return res.status(404).json({ erreur: 'Demande introuvable.' });
    }

    const statutActuel = actuel.recordset[0].statut_actuel;
    const transitionsAutorisees = TRANSITIONS[statutActuel] || [];

    if (!transitionsAutorisees.includes(nouveau_statut)) {
      return res.status(400).json({
        erreur: `Transition non autorisée : ${statutActuel} → ${nouveau_statut}.`,
        transitionsPossibles: transitionsAutorisees
      });
    }

    const motifObligatoire = nouveau_statut === 'REJETEE' || statutActuel === 'REJETEE';
    if (motifObligatoire && !String(commentaire || '').trim()) {
      return res.status(400).json({ erreur: 'Un motif est obligatoire pour rejeter ou lever le rejet de la demande.' });
    }

    await pool.request()
      .input('id_demande', sql.Int, id_demande)
      .input('nouveau_statut', sql.NVarChar, nouveau_statut)
      .input('id_agent', sql.Int, req.agent.id_agent)
      .input('commentaire', sql.NVarChar, commentaire || null)
      .execute('sp_ChangerStatutDemande');

    res.json({ message: 'Statut mis à jour.', nouveau_statut });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du changement de statut.' });
  }
});

// PUT /api/demandes/:id/etude - enregistrer/mettre à jour l'étude technique
router.put('/:id/etude', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const { date_visite, distance_reseau_m, diametre_conduite, faisabilite, observations } = req.body;
    const pool = await getPool();

    const existe = await pool.request().input('id', sql.Int, id_demande)
      .query(`SELECT id_etude FROM EtudesTechniques WHERE id_demande = @id`);

    if (existe.recordset.length > 0) {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('date_visite', sql.DateTime2, date_visite)
        .input('distance_reseau_m', sql.Decimal(6, 2), distance_reseau_m)
        .input('diametre_conduite', sql.NVarChar, diametre_conduite)
        .input('faisabilite', sql.NVarChar, faisabilite)
        .input('observations', sql.NVarChar, observations)
        .query(`UPDATE EtudesTechniques SET date_visite=@date_visite, distance_reseau_m=@distance_reseau_m,
                diametre_conduite=@diametre_conduite, faisabilite=@faisabilite, observations=@observations
                WHERE id_demande=@id_demande`);
    } else {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('id_agent_technique', sql.Int, req.agent.id_agent)
        .input('date_visite', sql.DateTime2, date_visite)
        .input('distance_reseau_m', sql.Decimal(6, 2), distance_reseau_m)
        .input('diametre_conduite', sql.NVarChar, diametre_conduite)
        .input('faisabilite', sql.NVarChar, faisabilite)
        .input('observations', sql.NVarChar, observations)
        .query(`INSERT INTO EtudesTechniques
                (id_demande, id_agent_technique, date_visite, distance_reseau_m, diametre_conduite, faisabilite, observations)
                VALUES (@id_demande, @id_agent_technique, @date_visite, @distance_reseau_m, @diametre_conduite, @faisabilite, @observations)`);
    }

    await synchroniserStatut(pool, id_demande, 'ETUDE_TERMINEE', req.agent.id_agent, 'Étude technique enregistrée');
    res.json({ message: 'Étude technique enregistrée.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement de l'étude." });
  }
});

// GET /api/demandes/:id/devis/preview - prévisualiser le numéro du devis avant enregistrement
router.get('/:id/devis/preview', async (req, res) => {
  try {
    const pool = await getPool();
    const numero_devis = await genererNumeroDevis(pool, req.params.id);
    res.json({ numero_devis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Impossible de calculer le numéro de devis.' });
  }
});

// PUT /api/demandes/:id/devis - créer/mettre à jour le devis
router.put('/:id/devis', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const { montant } = req.body;
    const pool = await getPool();

    const existe = await pool.request().input('id', sql.Int, id_demande)
      .query(`SELECT id_devis FROM Devis WHERE id_demande = @id`);

    if (existe.recordset.length > 0) {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('montant', sql.Decimal(12, 2), montant)
        .query(`UPDATE Devis SET montant=@montant WHERE id_demande=@id_demande`);
    } else {
      const numero_devis = await genererNumeroDevis(pool, id_demande);
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('numero_devis', sql.NVarChar, numero_devis)
        .input('montant', sql.Decimal(12, 2), montant)
        .query(`INSERT INTO Devis (id_demande, numero_devis, montant) VALUES (@id_demande, @numero_devis, @montant)`);
    }

    const devis = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT numero_devis FROM Devis WHERE id_demande = @id_demande');
    await synchroniserStatut(pool, id_demande, 'DEVIS_EMIS', req.agent.id_agent, 'Devis enregistré');
    res.json({ message: 'Devis enregistré.', numero_devis: devis.recordset[0].numero_devis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement du devis." });
  }
});

// PATCH /api/demandes/:id/devis/paiement - marquer le devis comme payé
router.patch('/:id/devis/paiement', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const {
      mode_paiement,
      date_paiement,
      numero_recu,
      numero_cheque,
      numero_versement,
      banque
    } = req.body;
    const modes = ['Especes', 'Cheque', 'Versement_bancaire', 'Virement'];
    if (!modes.includes(mode_paiement)) {
      return res.status(400).json({ erreur: 'Le mode de paiement est obligatoire.' });
    }
    if (!date_paiement) {
      return res.status(400).json({ erreur: 'La date de paiement est obligatoire.' });
    }
    if (mode_paiement === 'Especes' && !numero_recu?.trim()) {
      return res.status(400).json({ erreur: 'Le numéro de reçu est obligatoire pour un paiement en espèces.' });
    }
    if (mode_paiement === 'Cheque' && (!numero_cheque?.trim() || !banque?.trim())) {
      return res.status(400).json({ erreur: 'Le numéro de chèque et la banque sont obligatoires.' });
    }
    if (['Versement_bancaire', 'Virement'].includes(mode_paiement) && (!numero_versement?.trim() || !banque?.trim())) {
      return res.status(400).json({ erreur: 'Le numéro de versement et la banque sont obligatoires.' });
    }
    const pool = await getPool();

    await pool.request()
      .input('id_demande', sql.Int, id_demande)
      .input('mode_paiement', sql.NVarChar, mode_paiement || null)
      .input('date_paiement', sql.DateTime2, date_paiement)
      .input('numero_recu', sql.NVarChar(50), numero_recu?.trim() || null)
      .input('numero_cheque', sql.NVarChar(50), numero_cheque?.trim() || null)
      .input('numero_versement', sql.NVarChar(50), numero_versement?.trim() || null)
      .input('banque', sql.NVarChar(150), banque?.trim().toUpperCase() || null)
      .query(`UPDATE Devis SET statut_paiement='PAYE', date_paiement=@date_paiement, mode_paiement=@mode_paiement,
              numero_recu=@numero_recu, numero_cheque=@numero_cheque, numero_versement=@numero_versement, banque=@banque
              WHERE id_demande=@id_demande`);

          await synchroniserStatut(pool, id_demande, 'DEVIS_PAYE', req.agent.id_agent, 'Paiement du devis enregistré');
    res.json({ message: 'Paiement enregistré.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement du paiement." });
  }
});

// PUT /api/demandes/:id/travaux - enregistrer les travaux
router.put('/:id/travaux', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const { date_debut, date_fin, equipe_execution, numero_compteur, observations } = req.body;
    const pool = await getPool();

    const existe = await pool.request().input('id', sql.Int, id_demande)
      .query(`SELECT id_travaux FROM Travaux WHERE id_demande = @id`);

    if (existe.recordset.length > 0) {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('date_debut', sql.DateTime2, date_debut)
        .input('date_fin', sql.DateTime2, date_fin)
        .input('equipe_execution', sql.NVarChar, equipe_execution)
        .input('numero_compteur', sql.NVarChar, numero_compteur)
        .input('observations', sql.NVarChar, observations)
        .query(`UPDATE Travaux SET date_debut=@date_debut, date_fin=@date_fin, equipe_execution=@equipe_execution,
                numero_compteur=@numero_compteur, observations=@observations WHERE id_demande=@id_demande`);
    } else {
      const numero_ordre_execution = await genererNumeroOrdreExecution(pool);
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('numero_ordre_execution', sql.NVarChar(15), numero_ordre_execution)
        .input('date_debut', sql.DateTime2, date_debut)
        .input('date_fin', sql.DateTime2, date_fin)
        .input('equipe_execution', sql.NVarChar, equipe_execution)
        .input('numero_compteur', sql.NVarChar, numero_compteur)
        .input('observations', sql.NVarChar, observations)
        .query(`INSERT INTO Travaux (id_demande, numero_ordre_execution, date_debut, date_fin, equipe_execution, numero_compteur, observations)
          VALUES (@id_demande, @numero_ordre_execution, @date_debut, @date_fin, @equipe_execution, @numero_compteur, @observations)`);
    }

    await synchroniserStatut(
      pool,
      id_demande,
      date_fin ? 'TRAVAUX_TERMINES' : 'TRAVAUX_EN_COURS',
      req.agent.id_agent,
      date_fin ? 'Travaux terminés' : 'Travaux démarrés'
    );
    const travaux = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT numero_ordre_execution FROM Travaux WHERE id_demande = @id_demande');
    res.json({ message: 'Travaux enregistrés.', numero_ordre_execution: travaux.recordset[0].numero_ordre_execution });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement des travaux." });
  }
});

// PUT /api/demandes/:id/mise-en-service
router.put('/:id/mise-en-service', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const { date_mise_service, numero_abonne, index_initial } = req.body;
    const pool = await getPool();

    const existe = await pool.request().input('id', sql.Int, id_demande)
      .query(`SELECT id_mise_service FROM MisesEnService WHERE id_demande = @id`);

    if (existe.recordset.length > 0) {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('date_mise_service', sql.DateTime2, date_mise_service)
        .input('numero_abonne', sql.NVarChar, numero_abonne)
        .input('index_initial', sql.Decimal(10, 3), index_initial)
        .query(`UPDATE MisesEnService SET date_mise_service=@date_mise_service,
                numero_abonne=@numero_abonne, index_initial=@index_initial
                WHERE id_demande=@id_demande`);
    } else {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('date_mise_service', sql.DateTime2, date_mise_service)
        .input('numero_abonne', sql.NVarChar, numero_abonne)
        .input('index_initial', sql.Decimal(10, 3), index_initial)
        .query(`INSERT INTO MisesEnService (id_demande, date_mise_service, numero_abonne, index_initial)
                VALUES (@id_demande, @date_mise_service, @numero_abonne, @index_initial)`);
    }

    await synchroniserStatut(pool, id_demande, 'MISE_EN_SERVICE', req.agent.id_agent, 'Mise en service enregistrée');
    res.json({ message: 'Mise en service enregistrée.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement de la mise en service." });
  }
});

module.exports = router;
