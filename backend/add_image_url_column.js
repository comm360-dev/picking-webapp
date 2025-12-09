const pool = require('./src/config/database');

async function addImageUrlColumn() {
  try {
    console.log('🔧 Ajout de la colonne image_url à la table products...');

    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);

    console.log('✅ Colonne image_url ajoutée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addImageUrlColumn();
