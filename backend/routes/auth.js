const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const { verifierToken } = require('../middleware/auth');

const IDENTIFIANT_REGEX = /^[^<>\u0000-\u001F\u007F]{1,150}$/u;

function identifiantValide(identifiant) {
  const valeur = String(identifiant || '').trim();
  return Boolean(valeur) && IDENTIFIANT_REGEX.test(valeur);
}

function nomValide(nom) {
  const valeur = String(nom || '').trim();
  return valeur.length <= 80 && !/[<>\u0000-\u001F\u007F]/u.test(valeur);
}

function normaliserIdentifiant(identifiant) {
  return String(identifiant || '').trim();
}

function identifiantsIdentiques(identifiantA, identifiantB) {
  return normaliserIdentifiant(identifiantA).toLocaleLowerCase() === normaliserIdentifiant(identifiantB).toLocaleLowerCase();
}

function genererToken(agent) {
  return jwt.sign(
    {
      id_agent: agent.id_agent,
      role: agent.role,
      id_agence: agent.id_agence,
      nom: agent.nom,
      prenom: agent.prenom
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const email = normaliserIdentifiant(req.body?.email);
    const mot_de_passe = String(req.body?.mot_de_passe || '');

    if (!email || !mot_de_passe) {
      return res.status(400).json({ erreur: 'Identifiant et mot de passe requis.' });
    }
    if (!identifiantValide(email)) {
      return res.status(400).json({ erreur: 'Identifiant invalide.' });
    }
    if (mot_de_passe.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
            .query(`SELECT id_agent, nom, prenom, email, mot_de_passe, role, id_agence, actif
              FROM Agents WHERE email = @email`);

    const agent = result.recordset[0];
    if (!agent || !agent.actif) {
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }

    const motDePasseValide = await bcrypt.compare(mot_de_passe, agent.mot_de_passe);
    if (!motDePasseValide) {
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }

    const token = genererToken(agent);

    res.json({
      token,
      agent: {
        id_agent: agent.id_agent,
        nom: agent.nom,
        prenom: agent.prenom,
        email: agent.email,
        role: agent.role,
        id_agence: agent.id_agence
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur lors de la connexion.' });
  }
});

// PATCH /api/auth/profil - modifier l'email et/ou le mot de passe de l'agent connecté
router.get('/profil', verifierToken, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id_agent', sql.Int, req.agent.id_agent)
      .query('SELECT id_agent, nom, prenom, email, role, id_agence FROM Agents WHERE id_agent = @id_agent AND actif = 1');
    if (!result.recordset[0]) return res.status(404).json({ erreur: 'Utilisateur introuvable.' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement du profil.' });
  }
});

router.patch('/profil', verifierToken, async (req, res) => {
  try {
    const emailSaisi = normaliserIdentifiant(req.body?.email);
    const nomSaisi = req.body?.nom === undefined ? null : String(req.body.nom).trim();
    const prenomSaisi = req.body?.prenom === undefined ? null : String(req.body.prenom).trim();
    const ancienMotDePasse = String(req.body?.ancien_mot_de_passe || '');
    const nouveauMotDePasse = String(req.body?.nouveau_mot_de_passe || '');

    if (!ancienMotDePasse) {
      return res.status(400).json({ erreur: 'L’ancien mot de passe est requis pour confirmer les modifications.' });
    }
    if ((nomSaisi !== null && !nomValide(nomSaisi)) || (prenomSaisi !== null && !nomValide(prenomSaisi))) {
      return res.status(400).json({ erreur: 'Le nom et le prénom doivent contenir au maximum 80 caractères valides.' });
    }

    const pool = await getPool();
    const agentResult = await pool.request()
      .input('id_agent', sql.Int, req.agent.id_agent)
      .query('SELECT id_agent, nom, prenom, email, mot_de_passe, role, id_agence, actif FROM Agents WHERE id_agent = @id_agent');
    const agent = agentResult.recordset[0];

    if (!agent || !agent.actif || !(await bcrypt.compare(ancienMotDePasse, agent.mot_de_passe))) {
      return res.status(401).json({ erreur: 'Ancien mot de passe incorrect.' });
    }

    const emailCible = emailSaisi || normaliserIdentifiant(agent.email);
    const emailChange = !identifiantsIdentiques(emailCible, agent.email);
    const nomChange = nomSaisi !== null && nomSaisi !== (agent.nom || '');
    const prenomChange = prenomSaisi !== null && prenomSaisi !== (agent.prenom || '');
    const motDePasseChange = nouveauMotDePasse.length > 0;

    if (!emailChange && !nomChange && !prenomChange && !motDePasseChange) {
      return res.status(400).json({ erreur: 'Aucune modification détectée.' });
    }
    if (!identifiantValide(emailCible)) {
      return res.status(400).json({ erreur: 'Identifiant invalide.' });
    }
    if (motDePasseChange && nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    if (emailChange) {
      const conflit = await pool.request()
        .input('email', sql.NVarChar(150), emailCible)
        .input('id_agent', sql.Int, agent.id_agent)
        .query(`SELECT TOP 1 id_agent, email
                FROM Agents
                WHERE email = @email AND id_agent <> @id_agent`);
      if (conflit.recordset[0]) {
        return res.status(409).json({
          erreur: `L’identifiant « ${emailCible} » est déjà utilisé par un autre compte.`
        });
      }
    }

    const requete = pool.request().input('id_agent', sql.Int, agent.id_agent);
    const champs = [];

    if (emailChange) {
      requete.input('email', sql.NVarChar(150), emailCible);
      champs.push('email = @email');
    }
    if (motDePasseChange) {
      requete.input('mot_de_passe', sql.NVarChar(255), await bcrypt.hash(nouveauMotDePasse, 10));
      champs.push('mot_de_passe = @mot_de_passe');
    }
    if (nomChange) {
      requete.input('nom', sql.NVarChar(80), nomSaisi || null);
      champs.push('nom = @nom');
    }
    if (prenomChange) {
      requete.input('prenom', sql.NVarChar(80), prenomSaisi || null);
      champs.push('prenom = @prenom');
    }

    const result = await requete.query(`UPDATE Agents
              SET ${champs.join(', ')}
              OUTPUT INSERTED.id_agent, INSERTED.nom, INSERTED.prenom, INSERTED.email, INSERTED.role, INSERTED.id_agence
              WHERE id_agent = @id_agent`);
    const agentMisAJour = result.recordset[0];

    res.json({ token: genererToken(agentMisAJour), agent: agentMisAJour });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ erreur: 'Cet identifiant est déjà utilisé.' });
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la mise à jour du profil.' });
  }
});

module.exports = router;
