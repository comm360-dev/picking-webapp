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

async function migrate() {
  try {
    console.log('🔧 Migration: Ajout du statut on-hold...');

    // Supprimer l'ancienne contrainte et en créer une nouvelle avec on-hold
    await pool.query(`
      ALTER TABLE orders
      DROP CONSTRAINT IF EXISTS orders_status_check;
    `);

    await pool.query(`
      ALTER TABLE orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending', 'processing', 'picking', 'completed', 'failed', 'on-hold'));
    `);

    console.log('✅ Migration terminée avec succès!');
    console.log('   Le statut "on-hold" est maintenant disponible pour les commandes.');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
