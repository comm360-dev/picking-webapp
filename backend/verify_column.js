const pool = require('./src/config/database');

async function verifyColumn() {
  try {
    console.log('🔍 Vérification de la colonne image_url...');
    console.log('📊 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurée' : 'Non configurée');

    // Vérifier si la colonne existe
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      AND column_name = 'image_url';
    `);

    console.log('\n📋 Résultat de la vérification:');
    if (columnCheck.rows.length > 0) {
      console.log('✅ La colonne image_url EXISTE');
      console.log('   Type:', columnCheck.rows[0].data_type);
      console.log('   Nullable:', columnCheck.rows[0].is_nullable);
    } else {
      console.log('❌ La colonne image_url N\'EXISTE PAS');
    }

    // Lister toutes les colonnes de la table products
    const allColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position;
    `);

    console.log('\n📝 Toutes les colonnes de la table products:');
    allColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyColumn();
