const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration...');

    const migrationPath = path.join(__dirname, 'add_image_url_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);

    console.log('✅ Migration réussie : colonne image_url ajoutée à la table products');

    // Vérifier que la colonne existe
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'image_url'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Vérification : colonne image_url existe', result.rows[0]);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
