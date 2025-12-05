const pool = require('./src/config/database');

async function cleanData() {
  try {
    console.log('🧹 Nettoyage des données...');

    // Supprimer les données de test
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
    await pool.query('DELETE FROM products');
    await pool.query('DELETE FROM sync_logs');

    console.log('✅ Données nettoyées avec succès');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
