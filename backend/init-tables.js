const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function initTables() {
  try {
    console.log('🔧 Connexion à PostgreSQL...');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'src/config/init-db.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // Générer un hash pour le mot de passe admin
    console.log('🔐 Génération du mot de passe admin...');
    const adminPassword = await bcrypt.hash('admin123', 10);

    // Remplacer le placeholder par le vrai hash
    sql = sql.replace('$2b$10$YourHashedPasswordHere', adminPassword);

    console.log('📝 Création des tables...');
    await pool.query(sql);

    console.log('✅ Base de données initialisée avec succès!');
    console.log('');
    console.log('👤 Compte admin créé:');
    console.log('   Email: admin@picking.local');
    console.log('   Mot de passe: admin123');
    console.log('');
    console.log('⚠️  N\'oubliez pas de changer ce mot de passe en production!');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

initTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
