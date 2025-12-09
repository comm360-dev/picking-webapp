const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigration(filename) {
  const filePath = path.join(__dirname, '../config/migrations', filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`📁 Exécution de la migration: ${filename}`);

  try {
    await pool.query(sql);
    console.log(`✅ Migration ${filename} exécutée avec succès`);
  } catch (error) {
    console.error(`❌ Erreur lors de la migration ${filename}:`, error.message);
    throw error;
  }
}

// Lire le nom du fichier depuis les arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: node runMigration.js <migration-file.sql>');
  process.exit(1);
}

runMigration(migrationFile)
  .then(() => {
    console.log('✨ Migration terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur:', error);
    process.exit(1);
  });
