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
  DEVIS_PAYE: ['DEVIS_EMIS', 'TRAVAUX_EN_COURS', 'ANNULEE'],
  TRAVAUX_EN_COURS: ['TRAVAUX_TERMINES'],
  TRAVAUX_TERMINES: ['SCELLEE'],
  SCELLEE: [],
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
  const telephoneValide = (valeur) => !valeur || /^0[2-7]\d{2} \d{2} \d{2} \d{2}$/.test(valeur);
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

async function verifierAccesDemande(pool, idDemande, agent, options = {}) {
  const result = await pool.request()
    .input('id_demande', sql.Int, idDemande)
    .query('SELECT id_demande, id_agence, statut_actuel, est_verrouillee FROM Demandes WHERE id_demande = @id_demande');
  const demande = result.recordset[0];
  if (!demande) {
    return { code: 404, erreur: 'Demande introuvable.' };
  }
  if (agent.role !== 'admin' && demande.id_agence !== agent.id_agence) {
    return { code: 403, erreur: 'Accès refusé pour cette demande.' };
  }
  if (options.exigerModifiable && estVerrouillee(demande.est_verrouillee)) {
    return {
      code: 403,
      erreur: options.messageVerrouillee || 'Cette demande est scellée : les modifications sont interdites.'
    };
  }
  return { demande };
}

function estVerrouillee(valeur) {
  return valeur === true || valeur === 1 || valeur === '1';
}

async function enregistrerHistoriqueModification(transaction, idDemande, idAgent, description, details = null) {
  await new sql.Request(transaction)
    .input('id_demande', sql.Int, idDemande)
    .input('id_agent', sql.Int, idAgent)
    .input('type_action', sql.NVarChar(50), 'MODIFICATION_DEMANDE')
    .input('description', sql.NVarChar(255), description)
    .input('details', sql.NVarChar(sql.MAX), details ? JSON.stringify(details) : null)
    .query(`
      INSERT INTO HistoriqueModificationsDemandes (id_demande, id_agent, type_action, description, details)
      VALUES (@id_demande, @id_agent, @type_action, @description, @details)
    `);
}

async function assurerMarqueCompteur(pool, libelle) {
  const marque = String(libelle ?? '').trim();
  if (!marque) return null;

  const existant = await pool.request()
    .input('libelle', sql.NVarChar(50), marque)
    .query(`
      SELECT TOP 1 libelle
      FROM MarquesCompteur
      WHERE LTRIM(RTRIM(libelle)) = @libelle
         OR LOWER(LTRIM(RTRIM(libelle))) = LOWER(@libelle)
    `);

  if (existant.recordset[0]) return existant.recordset[0].libelle;

  const insertion = await pool.request()
    .input('libelle', sql.NVarChar(50), marque)
    .query(`
      INSERT INTO MarquesCompteur (libelle)
      OUTPUT INSERTED.libelle
      VALUES (@libelle)
    `);

  return insertion.recordset[0]?.libelle || marque;
}

async function genererNumeroOrdreExecution(pool) {
  const annee = new Date().getFullYear();
  const result = await pool.request()
    .input('suffixe', sql.NVarChar(10), `/${annee}`)
    .query(`SELECT numero_ordre_execution FROM Travaux WHERE numero_ordre_execution LIKE '%' + @suffixe`);

  let maxCompteur = 0;
  for (const row of result.recordset) {
    const parts = String(row.numero_ordre_execution || '').split('/');
    if (parts.length >= 1) {
      const num = parseInt(parts[0], 10);
      if (!isNaN(num) && num > maxCompteur) {
        maxCompteur = num;
      }
    }
  }
  return `${String(maxCompteur + 1).padStart(4, '0')}/${annee}`;
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
  const acces = await verifierAccesDemande(pool, req.params.id, req.agent, { exigerModifiable: true });
  if (acces.erreur) {
    return res.status(acces.code).json({ erreur: acces.erreur });
  }

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

    await enregistrerHistoriqueModification(
      transaction,
      req.params.id,
      req.agent.id_agent,
      'Mise à jour des informations du dossier',
      {
        id_type,
        type_autre: type_autre?.trim() || null,
        adresse_branchement: adresse_branchement.trim(),
        id_commune,
        observations: observations || null,
        demandeur: {
          qualite_demandeur: qualiteDemandeur,
          est_personne_morale: estPersonneMorale,
          nom: estPersonneMorale ? null : demandeur.nom?.trim(),
          prenom: estPersonneMorale ? null : demandeur.prenom?.trim(),
          raison_sociale: estPersonneMorale ? demandeur.raison_sociale?.trim() : null
        }
      }
    );

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
    .query(`SELECT numero_demande FROM Demandes WHERE numero_demande LIKE '%' + @suffixe`);

  let maxCompteur = 0;
  for (const row of result.recordset) {
    const parts = String(row.numero_demande || '').split('/');
    if (parts.length >= 1) {
      const num = parseInt(parts[0], 10);
      if (!isNaN(num) && num > maxCompteur) {
        maxCompteur = num;
      }
    }
  }

  let candidat = maxCompteur + 1;
  let numeroCandidat = `${String(candidat).padStart(4, '0')}/${annee}`;

  while (true) {
    const existe = await pool.request()
      .input('numero_demande', sql.NVarChar(30), numeroCandidat)
      .query(`SELECT TOP 1 1 AS ex FROM Demandes WHERE numero_demande = @numero_demande`);
    if (existe.recordset.length === 0) {
      break;
    }
    candidat++;
    numeroCandidat = `${String(candidat).padStart(4, '0')}/${annee}`;
  }

  return numeroCandidat;
}

async function genererNumeroDevis(pool, idDemande) {
  const annee = new Date().getFullYear();
  const agenceRes = await pool.request()
    .input('id_demande', sql.Int, idDemande)
    .query(`
      SELECT a.code_agence
      FROM Demandes d
      JOIN Agences a ON a.id_agence = d.id_agence
      WHERE d.id_demande = @id_demande
    `);

  if (agenceRes.recordset.length === 0) {
    throw new Error('Demande introuvable pour la numérotation du devis.');
  }

  const codeAgence = agenceRes.recordset[0].code_agence;
  const pattern = `%/${codeAgence}/${annee}`;

  const devisExistants = await pool.request()
    .input('pattern', sql.NVarChar(50), pattern)
    .query(`
      SELECT numero_devis
      FROM Devis
      WHERE numero_devis LIKE @pattern
    `);

  let maxCompteur = 0;
  for (const row of devisExistants.recordset) {
    const parts = String(row.numero_devis || '').split('/');
    if (parts.length >= 1) {
      const num = parseInt(parts[0], 10);
      if (!isNaN(num) && num > maxCompteur) {
        maxCompteur = num;
      }
    }
  }

  let candidatCompteur = maxCompteur + 1;
  let numeroCandidat = `${String(candidatCompteur).padStart(4, '0')}/${codeAgence}/${annee}`;

  while (true) {
    const existe = await pool.request()
      .input('numero_devis', sql.NVarChar(30), numeroCandidat)
      .query(`SELECT TOP 1 1 AS ex FROM Devis WHERE numero_devis = @numero_devis`);
    if (existe.recordset.length === 0) {
      break;
    }
    candidatCompteur++;
    numeroCandidat = `${String(candidatCompteur).padStart(4, '0')}/${codeAgence}/${annee}`;
  }

  return numeroCandidat;
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

// DELETE /api/demandes/:id - les demandes annulées sont supprimables si le devis n'est pas payé
router.delete('/:id', async (req, res) => {
  const id_demande = req.params.id;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionDemarree = false;

  try {
    const demande = await pool.request()
      .input('id_demande', sql.Int, id_demande)
      .query(`SELECT d.id_demande, d.id_agence, d.statut_actuel, d.est_verrouillee, dv.statut_paiement
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
    if (demandeCible.est_verrouillee) {
      return res.status(403).json({ erreur: 'Cette demande est scellée : la suppression est interdite.' });
    }
    if (demande.recordset.some((item) => item.statut_paiement === 'PAYE')) {
      return res.status(400).json({ erreur: 'Cette demande ne peut pas être supprimée car un devis est payé.' });
    }

    await transaction.begin();
    transactionDemarree = true;
    const supprimer = new sql.Request(transaction).input('id_demande', sql.Int, id_demande);
    await supprimer.query('DELETE FROM HistoriqueModificationsDemandes WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM HistoriqueStatuts WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM EtudesTechniques WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM LignesDevis WHERE id_devis IN (SELECT id_devis FROM Devis WHERE id_demande = @id_demande)');
    await supprimer.query('DELETE FROM Devis WHERE id_demande = @id_demande');
    await supprimer.query('DELETE FROM Travaux WHERE id_demande = @id_demande');
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

    const acces = await verifierAccesDemande(pool, id, req.agent);
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

    const demande = await pool.request().input('id', sql.Int, id).query(`
            SELECT d.*, dem.nom AS demandeur_nom, dem.prenom AS demandeur_prenom,
              dem.est_personne_morale, dem.raison_sociale, dem.qualite_demandeur,
             dem.telephone, dem.telephone_secondaire, dem.email AS demandeur_email, dem.cin, dem.type_piece_identite, dem.fils_de, dem.ne_le,
             dem.cin_delivre_le, dem.cin_delivre_par, dem.adresse AS demandeur_adresse,
                  dem.id_commune AS id_commune_residence, c_res.nom_commune AS nom_commune_residence,
             a.nom_agence, c.nom_commune, t.libelle AS type_branchement, s.libelle AS statut_libelle,
             d.est_verrouillee
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

    const historiqueStatuts = await pool.request().input('id', sql.Int, id).query(`
      SELECT h.*, s.libelle AS statut_libelle, s.ordre, ag.nom + ' ' + ag.prenom AS agent_nom,
        'STATUT' AS type_historique
      FROM HistoriqueStatuts h
      JOIN Statuts s ON s.code_statut = h.code_statut
      JOIN Agents ag ON ag.id_agent = h.id_agent
      WHERE h.id_demande = @id
      ORDER BY h.date_changement ASC
    `);

    const historiqueModifications = await pool.request().input('id', sql.Int, id).query(`
      SELECT hm.id_historique_modification AS id_historique,
             hm.id_demande,
             hm.type_action,
             hm.description,
             hm.details,
             hm.date_modification AS date_changement,
             ag.nom + ' ' + ag.prenom AS agent_nom,
             'MODIFICATION' AS type_historique
      FROM HistoriqueModificationsDemandes hm
      JOIN Agents ag ON ag.id_agent = hm.id_agent
      WHERE hm.id_demande = @id
      ORDER BY hm.date_modification ASC
    `);

    const historique = [...historiqueStatuts.recordset, ...historiqueModifications.recordset]
      .sort((a, b) => new Date(a.date_changement) - new Date(b.date_changement));

    const etude = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM EtudesTechniques WHERE id_demande = @id`);
    const devis = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM Devis WHERE id_demande = @id ORDER BY date_emission ASC`);

    const devisIds = devis.recordset.map((d) => d.id_devis);
    const lignesMap = {};
    if (devisIds.length > 0) {
      const idsListe = devisIds.map((val) => Number(val)).filter((n) => Number.isInteger(n) && n > 0).join(',');
      if (idsListe) {
        const lignesRes = await pool.request().query(`
          SELECT * FROM LignesDevis WHERE id_devis IN (${idsListe}) ORDER BY ordre ASC, id_ligne ASC
        `);
        for (const l of lignesRes.recordset) {
          if (!lignesMap[l.id_devis]) lignesMap[l.id_devis] = [];
          lignesMap[l.id_devis].push({
            id_ligne: l.id_ligne,
            code: l.code_article,
            libelle: l.libelle,
            unite: l.unite,
            diametre: l.diametre,
            quantite: Number(l.quantite),
            prix: Number(l.prix_unitaire),
            montantLigne: Number(l.montant_ht),
            typeTva: l.type_tva,
            tauxTva: Number(l.taux_tva),
            avecDiametre: Boolean(l.diametre)
          });
        }
      }
    }

    const devisAvecArticles = devis.recordset.map((d) => ({
      ...d,
      articles: lignesMap[d.id_devis] || []
    }));

    const travaux = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM Travaux WHERE id_demande = @id`);
    const pieces = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM PiecesJointes WHERE id_demande = @id`);

    res.json({
      demande: {
        ...demande.recordset[0],
        est_verrouillee: estVerrouillee(demande.recordset[0].est_verrouillee),
        statut_actuel: demande.recordset[0].statut_actuel || 'DEPOSEE'
      },
      historique,
      etude: etude.recordset[0] || null,
      devis: devisAvecArticles,
      travaux: travaux.recordset[0] || null,
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
              (numero_demande, id_demandeur, id_agence, id_type, type_autre, adresse_branchement, id_commune, statut_actuel, id_agent_creation, observations, est_verrouillee)
              OUTPUT INSERTED.id_demande, INSERTED.numero_demande, INSERTED.date_depot INTO @demande_inseree
              VALUES (@numero_demande, @id_demandeur, @id_agence, @id_type, @type_autre, @adresse_branchement, @id_commune, 'DEPOSEE', @id_agent_creation, @observations, 0);
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
    const acces = await verifierAccesDemande(pool, id_demande, req.agent, { exigerModifiable: true });
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

    const statutActuel = acces.demande.statut_actuel;
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

// PATCH /api/demandes/:id/verrouiller - sceller une demande après validation finale
router.patch('/:id/verrouiller', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const pool = await getPool();
    const acces = await verifierAccesDemande(pool, id_demande, req.agent);
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

    const demande = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT statut_actuel, est_verrouillee FROM Demandes WHERE id_demande = @id_demande');

    if (demande.recordset.length === 0) {
      return res.status(404).json({ erreur: 'Demande introuvable.' });
    }

    if (demande.recordset[0].statut_actuel !== 'TRAVAUX_TERMINES') {
      return res.status(400).json({ erreur: 'La demande doit être entièrement finalisée pour être scellée.' });
    }
    if (estVerrouillee(demande.recordset[0].est_verrouillee)) {
      return res.status(400).json({ erreur: 'Cette demande est déjà scellée.' });
    }

    await pool.request()
      .input('id_demande', sql.Int, id_demande)
      .query(`UPDATE Demandes SET statut_actuel = 'SCELLEE', est_verrouillee = 1, date_maj = SYSDATETIME() WHERE id_demande = @id_demande`);

    await enregistrerHistoriqueModification(
      pool,
      id_demande,
      req.agent.id_agent,
      'Demande scellée / verrouillée',
      { statut: 'SCELLEE', etat: 'verrouillee', motif: 'Finalisation complète du dossier' }
    );

    res.json({ message: 'Demande scellée avec succès. Les modifications et suppressions sont désormais interdites.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du scellement de la demande.' });
  }
});

// PUT /api/demandes/:id/etude - enregistrer/mettre à jour l'étude technique
router.put('/:id/etude', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const { date_visite, distance_reseau_m, diametre_conduite, faisabilite, observations } = req.body;
    const pool = await getPool();

    const acces = await verifierAccesDemande(pool, id_demande, req.agent, { exigerModifiable: true });
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

    const faisabilitesValides = ['Faisable', 'Faisable_sous_reserve', 'Non_faisable'];
    if (faisabilite && !faisabilitesValides.includes(faisabilite)) {
      return res.status(400).json({ erreur: 'Valeur de faisabilité non valide.' });
    }
    if (distance_reseau_m !== undefined && distance_reseau_m !== null && distance_reseau_m !== '') {
      const distNum = Number(distance_reseau_m);
      if (isNaN(distNum) || distNum < 0 || distNum > 9999.99) {
        return res.status(400).json({ erreur: 'La distance au réseau doit être un nombre positif valide (max 9999.99m).' });
      }
    }
    if (diametre_conduite && !texteValide(diametre_conduite, { maxLength: 50 })) {
      return res.status(400).json({ erreur: 'Le diamètre de conduite contient des caractères invalides.' });
    }
    if (observations && !texteValide(observations, { maxLength: 1000 })) {
      return res.status(400).json({ erreur: 'Les observations contiennent des caractères invalides.' });
    }

    const demandeRes = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT date_depot FROM Demandes WHERE id_demande = @id_demande');

    if (demandeRes.recordset.length === 0) {
      return res.status(404).json({ erreur: 'Demande introuvable.' });
    }

    const dateDepot = demandeRes.recordset[0].date_depot ? new Date(demandeRes.recordset[0].date_depot).toISOString().slice(0, 10) : null;
    if (date_visite && dateDepot && date_visite < dateDepot) {
      return res.status(400).json({ erreur: 'La date de visite doit être supérieure ou égale à la date de dépôt de la demande.' });
    }

    const existe = await pool.request().input('id', sql.Int, id_demande)
      .query(`SELECT id_etude FROM EtudesTechniques WHERE id_demande = @id`);

    const distanceFinale = (distance_reseau_m !== undefined && distance_reseau_m !== null && distance_reseau_m !== '') ? Number(distance_reseau_m) : null;

    if (existe.recordset.length > 0) {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('date_visite', sql.DateTime2, date_visite || null)
        .input('distance_reseau_m', sql.Decimal(6, 2), distanceFinale)
        .input('diametre_conduite', sql.NVarChar(50), diametre_conduite?.trim() || null)
        .input('faisabilite', sql.NVarChar(30), faisabilite || 'Faisable')
        .input('observations', sql.NVarChar, observations || null)
        .query(`UPDATE EtudesTechniques SET date_visite=@date_visite, distance_reseau_m=@distance_reseau_m,
                diametre_conduite=@diametre_conduite, faisabilite=@faisabilite, observations=@observations
                WHERE id_demande=@id_demande`);
    } else {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('id_agent_technique', sql.Int, req.agent.id_agent)
        .input('date_visite', sql.DateTime2, date_visite || null)
        .input('distance_reseau_m', sql.Decimal(6, 2), distanceFinale)
        .input('diametre_conduite', sql.NVarChar(50), diametre_conduite?.trim() || null)
        .input('faisabilite', sql.NVarChar(30), faisabilite || 'Faisable')
        .input('observations', sql.NVarChar, observations || null)
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
    const acces = await verifierAccesDemande(pool, req.params.id, req.agent);
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

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
    const { montant, id_devis, articles } = req.body;
    if (montant === undefined || montant === null || String(montant).trim() === '' || isNaN(Number(montant)) || Number(montant) < 0 || Number(montant) > 999999999.99) {
      return res.status(400).json({ erreur: 'Le montant du devis est obligatoire et doit être un nombre positif valide (max 999 999 999.99).' });
    }
    const pool = await getPool();
    const acces = await verifierAccesDemande(pool, id_demande, req.agent, { exigerModifiable: true });
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

    const etudeExiste = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT id_etude FROM EtudesTechniques WHERE id_demande = @id_demande');

    if (etudeExiste.recordset.length === 0) {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('id_agent_technique', sql.Int, req.agent.id_agent)
        .query(`INSERT INTO EtudesTechniques (id_demande, id_agent_technique, date_visite, faisabilite, observations)
                VALUES (@id_demande, @id_agent_technique, SYSDATETIME(), 'Faisable', N'Étude technique automatique lors de l''émission du devis')`);
    }

    const idDevisValide = id_devis ? entierPositif(id_devis) : null;
    const existe = idDevisValide
      ? await pool.request().input('id_devis', sql.Int, idDevisValide).input('id_demande', sql.Int, id_demande)
        .query(`SELECT id_devis, numero_devis FROM Devis WHERE id_devis = @id_devis AND id_demande = @id_demande`)
      : { recordset: [] };

    let idDevisFinal = idDevisValide;
    let numeroDevisFinal = '';

    if (existe.recordset.length > 0) {
      numeroDevisFinal = existe.recordset[0].numero_devis;
      const devisActuel = await pool.request()
        .input('id_devis', sql.Int, idDevisValide)
        .input('id_demande', sql.Int, id_demande)
        .query(`SELECT id_devis, montant, statut_paiement FROM Devis WHERE id_devis=@id_devis AND id_demande=@id_demande`);

      if (devisActuel.recordset[0]?.statut_paiement === 'PAYE') {
        return res.status(400).json({ erreur: 'Un devis réglé ne peut plus être modifié.' });
      }

      await pool.request()
        .input('id_devis', sql.Int, idDevisValide)
        .input('montant', sql.Decimal(12, 2), Number(montant))
        .query(`UPDATE Devis SET montant=@montant WHERE id_devis=@id_devis`);
    } else {
      numeroDevisFinal = await genererNumeroDevis(pool, id_demande);
      const insertRes = await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('numero_devis', sql.NVarChar(30), numeroDevisFinal)
        .input('montant', sql.Decimal(12, 2), Number(montant))
        .query(`INSERT INTO Devis (id_demande, numero_devis, montant, date_emission)
          OUTPUT INSERTED.id_devis, INSERTED.numero_devis
          VALUES (@id_demande, @numero_devis, @montant, SYSDATETIME())`);
      if (insertRes.recordset.length > 0) {
        idDevisFinal = insertRes.recordset[0].id_devis;
        numeroDevisFinal = insertRes.recordset[0].numero_devis;
      }
    }

    // Persistance des lignes d'articles si transmises
    if (idDevisFinal && Array.isArray(articles)) {
      await pool.request()
        .input('id_devis', sql.Int, idDevisFinal)
        .query('DELETE FROM LignesDevis WHERE id_devis = @id_devis');

      for (let i = 0; i < articles.length; i++) {
        const art = articles[i];
        const codeArticle = String(art.code || art.code_article || '').trim();
        const libelle = String(art.libelle || '').trim();
        if (!codeArticle || !libelle) continue;

        const unite = String(art.unite || '').trim() || null;
        const diametre = String(art.diametre || '').trim() || null;
        const quantite = Number(art.quantite) > 0 ? Number(art.quantite) : 1;
        const prixUnitaire = Number(art.prix ?? art.prix_unitaire ?? 0) >= 0 ? Number(art.prix ?? art.prix_unitaire ?? 0) : 0;
        const montantHt = Number(art.montantLigne ?? (quantite * prixUnitaire));
        const typeTva = String(art.typeTva || art.type_tva || '').trim() || null;
        const tauxTva = Number.isFinite(Number(art.tauxTva ?? art.taux_tva)) ? Number(art.tauxTva ?? art.taux_tva) : 19;

        await pool.request()
          .input('id_devis', sql.Int, idDevisFinal)
          .input('code_article', sql.NVarChar(50), codeArticle)
          .input('libelle', sql.NVarChar(150), libelle)
          .input('unite', sql.NVarChar(20), unite)
          .input('diametre', sql.NVarChar(50), diametre)
          .input('quantite', sql.Decimal(10, 2), quantite)
          .input('prix_unitaire', sql.Decimal(12, 2), prixUnitaire)
          .input('montant_ht', sql.Decimal(12, 2), montantHt)
          .input('type_tva', sql.NVarChar(20), typeTva)
          .input('taux_tva', sql.Decimal(5, 2), tauxTva)
          .input('ordre', sql.Int, i + 1)
          .query(`INSERT INTO LignesDevis (id_devis, code_article, libelle, unite, diametre, quantite, prix_unitaire, montant_ht, type_tva, taux_tva, ordre)
                  VALUES (@id_devis, @code_article, @libelle, @unite, @diametre, @quantite, @prix_unitaire, @montant_ht, @type_tva, @taux_tva, @ordre)`);
      }
    }

    const devis = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT id_devis, numero_devis, statut_paiement FROM Devis WHERE id_demande = @id_demande ORDER BY date_emission DESC');

    const demandeRes = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT statut_actuel FROM Demandes WHERE id_demande = @id_demande');
    const statutActuel = demandeRes.recordset[0]?.statut_actuel;

    const tousPayes = devis.recordset.every((item) => item.statut_paiement === 'PAYE');
    if (statutActuel === 'ETUDE_TERMINEE' || statutActuel === 'DEVIS_EMIS' || statutActuel === 'DEVIS_PAYE') {
      const nouveauStatut = tousPayes ? 'DEVIS_PAYE' : 'DEVIS_EMIS';
      await synchroniserStatut(pool, id_demande, nouveauStatut, req.agent.id_agent, 'Devis enregistré');
    }

    res.json({
      message: 'Devis enregistré.',
      id_devis: idDevisFinal,
      numero_devis: numeroDevisFinal || devis.recordset[0]?.numero_devis
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement du devis." });
  }
});

// PATCH /api/demandes/:id/devis/paiement - marquer le devis comme payé
router.patch('/:id/devis/paiement', async (req, res) => {
  try {
    const id_demande = req.params.id;
    const id_devis = req.body.id_devis ? parseInt(req.body.id_devis, 10) : 0;
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
    if (mode_paiement === 'Especes' && (!numero_recu?.trim() || !texteValide(numero_recu, { maxLength: 50 }))) {
      return res.status(400).json({ erreur: 'Le numéro de reçu valide est obligatoire pour un paiement en espèces.' });
    }
    if (mode_paiement === 'Cheque' && (!numero_cheque?.trim() || !texteValide(numero_cheque, { maxLength: 50 }) || !banque?.trim() || !texteValide(banque, { maxLength: 150 }))) {
      return res.status(400).json({ erreur: 'Le numéro de chèque et la banque valides sont obligatoires.' });
    }
    if (['Versement_bancaire', 'Virement'].includes(mode_paiement) && (!numero_versement?.trim() || !texteValide(numero_versement, { maxLength: 50 }) || !banque?.trim() || !texteValide(banque, { maxLength: 150 }))) {
      return res.status(400).json({ erreur: 'Le numéro de versement et la banque valides sont obligatoires.' });
    }
    const pool = await getPool();
    const acces = await verifierAccesDemande(pool, id_demande, req.agent, { exigerModifiable: true });
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

    const devisResultat = await pool.request().input('id_demande', sql.Int, id_demande).input('id_devis', sql.Int, id_devis)
      .query('SELECT id_devis, date_emission FROM Devis WHERE id_demande = @id_demande AND (@id_devis = 0 OR id_devis = @id_devis)');
    const devis = devisResultat.recordset[0];
    if (!devis) {
      return res.status(404).json({ erreur: 'Devis introuvable.' });
    }
    const dateEmission = new Date(devis.date_emission).toISOString().slice(0, 10);
    if (date_paiement < dateEmission) {
      return res.status(400).json({ erreur: 'La date de paiement doit être supérieure ou égale à la date d’émission du devis.' });
    }

    await pool.request()
      .input('id_demande', sql.Int, id_demande)
      .input('id_devis', sql.Int, devis.id_devis)
      .input('mode_paiement', sql.NVarChar(30), mode_paiement || null)
      .input('date_paiement', sql.DateTime2, date_paiement)
      .input('numero_recu', sql.NVarChar(50), numero_recu?.trim() || null)
      .input('numero_cheque', sql.NVarChar(50), numero_cheque?.trim() || null)
      .input('numero_versement', sql.NVarChar(50), numero_versement?.trim() || null)
      .input('banque', sql.NVarChar(150), banque?.trim().toUpperCase() || null)
      .query(`UPDATE Devis SET statut_paiement='PAYE', date_paiement=@date_paiement, mode_paiement=@mode_paiement,
              numero_recu=@numero_recu, numero_cheque=@numero_cheque, numero_versement=@numero_versement, banque=@banque
              WHERE id_devis=@id_devis AND id_demande=@id_demande`);

    const tousDevis = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT statut_paiement FROM Devis WHERE id_demande = @id_demande');
    const tousPayes = tousDevis.recordset.every((item) => item.statut_paiement === 'PAYE');

    const demandeRes = await pool.request().input('id_demande', sql.Int, id_demande)
      .query('SELECT statut_actuel FROM Demandes WHERE id_demande = @id_demande');
    const statutActuel = demandeRes.recordset[0]?.statut_actuel;

    if (tousPayes && statutActuel === 'DEVIS_EMIS') {
      await synchroniserStatut(pool, id_demande, 'DEVIS_PAYE', req.agent.id_agent, 'Paiement du devis enregistré');
    }

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
    const { date_debut, date_fin, equipe_execution, numero_compteur, marque_compteur, type_compteur, diametre_compteur, observations } = req.body;
    const pool = await getPool();

    const acces = await verifierAccesDemande(pool, id_demande, req.agent, { exigerModifiable: true });
    if (acces.erreur) {
      return res.status(acces.code).json({ erreur: acces.erreur });
    }

    if (equipe_execution && !texteValide(equipe_execution, { maxLength: 100 })) {
      return res.status(400).json({ erreur: 'L’équipe d’exécution contient des caractères non valides.' });
    }
    if (numero_compteur && !texteValide(numero_compteur, { maxLength: 50 })) {
      return res.status(400).json({ erreur: 'Le numéro de compteur contient des caractères non valides.' });
    }
    if (marque_compteur && !texteValide(marque_compteur, { maxLength: 50 })) {
      return res.status(400).json({ erreur: 'La marque du compteur contient des caractères non valides.' });
    }
    if (type_compteur && !texteValide(type_compteur, { maxLength: 50 })) {
      return res.status(400).json({ erreur: 'Le type de compteur contient des caractères non valides.' });
    }
    if (diametre_compteur && !texteValide(diametre_compteur, { maxLength: 20 })) {
      return res.status(400).json({ erreur: 'Le diamètre du compteur contient des caractères non valides.' });
    }
    if (observations && !texteValide(observations, { maxLength: 1000 })) {
      return res.status(400).json({ erreur: 'Les observations contiennent des caractères non valides.' });
    }

    const devisResult = await pool.request().input('id_demande', sql.Int, id_demande)
      .query(`SELECT statut_paiement, date_paiement FROM Devis WHERE id_demande = @id_demande`);
    if (devisResult.recordset.length === 0 || devisResult.recordset.some((item) => item.statut_paiement !== 'PAYE')) {
      return res.status(400).json({ erreur: 'Le devis doit être payé avant de renseigner l\'exécution des travaux.' });
    }

    // Validation des dates
    const dateFr = (iso) => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
    if (date_debut) {
      const datesPaiement = devisResult.recordset
        .filter((d) => d.date_paiement)
        .map((d) => {
          if (typeof d.date_paiement === 'string') return d.date_paiement.slice(0, 10);
          const dt = new Date(d.date_paiement);
          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, '0');
          const day = String(dt.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        });
      if (datesPaiement.length > 0) {
        const dateMaxPaiement = datesPaiement.sort().at(-1);
        if (date_debut < dateMaxPaiement) {
          return res.status(400).json({ erreur: `La date de début (${dateFr(date_debut)}) ne peut pas être antérieure à la date de paiement du devis (${dateFr(dateMaxPaiement)}).` });
        }
      }
    }
    if (date_fin && date_debut && date_fin < date_debut) {
      return res.status(400).json({ erreur: `La date de fin (${dateFr(date_fin)}) doit être supérieure ou égale à la date de début (${dateFr(date_debut)}).` });
    }

    const marqueCompteurFinal = await assurerMarqueCompteur(pool, marque_compteur);
    const existe = await pool.request().input('id', sql.Int, id_demande)
      .query(`SELECT id_travaux FROM Travaux WHERE id_demande = @id`);

    if (existe.recordset.length > 0) {
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('date_debut', sql.DateTime2, date_debut || null)
        .input('date_fin', sql.DateTime2, date_fin || null)
        .input('equipe_execution', sql.NVarChar(100), equipe_execution?.trim() || null)
        .input('numero_compteur', sql.NVarChar(50), numero_compteur?.trim() || null)
        .input('marque_compteur', sql.NVarChar(50), marqueCompteurFinal || null)
        .input('type_compteur', sql.NVarChar(50), type_compteur?.trim() || null)
        .input('diametre_compteur', sql.NVarChar(20), diametre_compteur?.trim() || null)
        .input('observations', sql.NVarChar, observations || null)
        .query(`UPDATE Travaux SET date_debut=@date_debut, date_fin=@date_fin, equipe_execution=@equipe_execution,
                numero_compteur=@numero_compteur, marque_compteur=@marque_compteur, type_compteur=@type_compteur,
                diametre_compteur=@diametre_compteur, observations=@observations WHERE id_demande=@id_demande`);
    } else {
      const numero_ordre_execution = await genererNumeroOrdreExecution(pool);
      await pool.request()
        .input('id_demande', sql.Int, id_demande)
        .input('numero_ordre_execution', sql.NVarChar(15), numero_ordre_execution)
        .input('date_debut', sql.DateTime2, date_debut || null)
        .input('date_fin', sql.DateTime2, date_fin || null)
        .input('equipe_execution', sql.NVarChar(100), equipe_execution?.trim() || null)
        .input('numero_compteur', sql.NVarChar(50), numero_compteur?.trim() || null)
        .input('marque_compteur', sql.NVarChar(50), marqueCompteurFinal || null)
        .input('type_compteur', sql.NVarChar(50), type_compteur?.trim() || null)
        .input('diametre_compteur', sql.NVarChar(20), diametre_compteur?.trim() || null)
        .input('observations', sql.NVarChar, observations || null)
        .query(`INSERT INTO Travaux (id_demande, numero_ordre_execution, date_debut, date_fin, equipe_execution, numero_compteur, marque_compteur, type_compteur, diametre_compteur, observations)
          VALUES (@id_demande, @numero_ordre_execution, @date_debut, @date_fin, @equipe_execution, @numero_compteur, @marque_compteur, @type_compteur, @diametre_compteur, @observations)`);
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

module.exports = router;
