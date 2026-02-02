const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL (Render) and individual variables (local)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration 003_add_customer_address...');

    const migrationPath = path.join(__dirname, '../src/config/migrations/003_add_customer_address.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);

    console.log('✅ Migration réussie : colonnes adresse client ajoutées à la table orders');

    // Vérifier que les colonnes existent
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name IN ('shipping_address', 'shipping_city', 'shipping_postcode', 'customer_phone')
    `);

    console.log('✅ Colonnes ajoutées:', result.rows.map(r => r.column_name).join(', '));

    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
