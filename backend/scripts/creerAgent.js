/**
 * Script utilitaire pour créer ou mettre à jour un agent (ex: compte administrateur).
 * Usage : node scripts/creerAgent.js <username_ou_email> <mot_de_passe> [nom] [prenom] [role] [id_agence]
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');

const ROLES_VALIDES = ['agent_guichet', 'agent_technique', 'chef_agence', 'admin'];

async function main() {
  const [identifiant, motDePasse, nomParam, prenomParam, roleParam = 'admin', idAgenceParam = 1] = process.argv.slice(2);

  if (!identifiant || !motDePasse) {
    console.log('Usage : node scripts/creerAgent.js <identifiant_ou_email> <mot_de_passe> [nom] [prenom] [role] [id_agence]');
    console.log('Exemple : node scripts/creerAgent.js "lounnaci" "hyhwarez1976" "Lounnaci" "Admin" "admin" 1');
    process.exit(1);
  }

  if (motDePasse.length < 8) {
    console.error('Erreur : le mot de passe doit comporter au moins 8 caractères.');
    process.exit(1);
  }

  const role = ROLES_VALIDES.includes(roleParam.toLowerCase()) ? roleParam.toLowerCase() : 'admin';
  const idAgence = parseInt(idAgenceParam, 10) || 1;
  const nom = nomParam || (identifiant.charAt(0).toUpperCase() + identifiant.slice(1));
  const prenom = prenomParam || 'Admin';

  const hash = await bcrypt.hash(motDePasse, 10);
  const pool = await getPool();

  // Vérifier si l'agence existe, sinon prendre la première agence disponible
  const agenceCheck = await pool.request()
    .input('id_agence', sql.Int, idAgence)
    .query('SELECT TOP 1 id_agence FROM Agences WHERE id_agence = @id_agence');

  let agenceIdEffectif = idAgence;
  if (!agenceCheck.recordset[0]) {
    const premiereAgence = await pool.request().query('SELECT TOP 1 id_agence FROM Agences ORDER BY id_agence');
    if (premiereAgence.recordset[0]) {
      agenceIdEffectif = premiereAgence.recordset[0].id_agence;
    } else {
      console.error('Erreur : Aucune agence trouvée dans la base de données. Veuillez exécuter database/schema.sql.');
      process.exit(1);
    }
  }

  // Vérifier si l'agent existe déjà
  const agentExistant = await pool.request()
    .input('email', sql.NVarChar, identifiant.trim())
    .query('SELECT id_agent, email, role FROM Agents WHERE email = @email');

  if (agentExistant.recordset[0]) {
    const idAgent = agentExistant.recordset[0].id_agent;
    await pool.request()
      .input('id_agent', sql.Int, idAgent)
      .input('nom', sql.NVarChar, nom)
      .input('prenom', sql.NVarChar, prenom)
      .input('mot_de_passe', sql.NVarChar, hash)
      .input('role', sql.NVarChar, role)
      .input('id_agence', sql.Int, agenceIdEffectif)
      .query(`UPDATE Agents
              SET nom = @nom, prenom = @prenom, mot_de_passe = @mot_de_passe, role = @role, id_agence = @id_agence, actif = 1
              WHERE id_agent = @id_agent`);

    console.log(`✅ Agent existant mis à jour : ${identifiant} (nom: ${nom} ${prenom}, rôle: ${role}, agence: ${agenceIdEffectif})`);
  } else {
    await pool.request()
      .input('nom', sql.NVarChar, nom)
      .input('prenom', sql.NVarChar, prenom)
      .input('email', sql.NVarChar, identifiant.trim())
      .input('mot_de_passe', sql.NVarChar, hash)
      .input('role', sql.NVarChar, role)
      .input('id_agence', sql.Int, agenceIdEffectif)
      .query(`INSERT INTO Agents (nom, prenom, email, mot_de_passe, role, id_agence, actif)
              VALUES (@nom, @prenom, @email, @mot_de_passe, @role, @id_agence, 1)`);

    console.log(`✅ Nouvel agent créé : ${identifiant} (nom: ${nom} ${prenom}, rôle: ${role}, agence: ${agenceIdEffectif})`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
