/**
 * Script utilitaire pour créer un agent (ex: le premier compte admin).
 * Usage : node scripts/creerAgent.js "email@ade.dz" "motdepasse" "Nom" "Prenom" "admin" 1
 *                                                                                   ^role   ^id_agence
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');

async function main() {
  const [email, motDePasse, nom, prenom, role = 'admin', idAgence = 1] = process.argv.slice(2);

  if (!email || !motDePasse || !nom || !prenom) {
    console.log('Usage : node scripts/creerAgent.js <email> <mot_de_passe> <nom> <prenom> [role] [id_agence]');
    process.exit(1);
  }

  const hash = await bcrypt.hash(motDePasse, 10);
  const pool = await getPool();

  await pool.request()
    .input('nom', sql.NVarChar, nom)
    .input('prenom', sql.NVarChar, prenom)
    .input('email', sql.NVarChar, email)
    .input('mot_de_passe', sql.NVarChar, hash)
    .input('role', sql.NVarChar, role)
    .input('id_agence', sql.Int, idAgence)
    .query(`INSERT INTO Agents (nom, prenom, email, mot_de_passe, role, id_agence)
            VALUES (@nom, @prenom, @email, @mot_de_passe, @role, @id_agence)`);

  console.log(`Agent créé : ${email} (rôle: ${role})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
