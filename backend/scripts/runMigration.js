const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { getPool } = require('../config/db');

async function runMigration() {
  console.log('Connexion à la base de données SQL Server...');
  const pool = await getPool();
  console.log('Connecté. Lecture du script de migration...');
  
  const fichierMigration = process.argv[2] || 'database/schema.sql';
  const scriptPath = path.resolve(process.cwd(), fichierMigration);
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Fichier de migration introuvable : ${scriptPath}`);
    process.exit(1);
  }
  const sqlContent = fs.readFileSync(scriptPath, 'utf8');
  
  // Séparer les blocs par "GO"
  const batches = sqlContent
    .split(/^\s*GO\s*$/gim)
    .map(b => b.trim())
    .filter(b => b.length > 0 && !b.startsWith('USE ') && !b.startsWith('CREATE DATABASE '));

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Exécution du lot ${i + 1}/${batches.length}...`);
    await pool.request().query(batch);
  }

  console.log('✅ Migration exécutée avec succès sur SQL Server !');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Erreur lors de la migration :', err.message || err);
  process.exit(1);
});
