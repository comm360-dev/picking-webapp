const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const productRoutes = require('./routes/productRoutes');
const historyRoutes = require('./routes/historyRoutes');
const imageProxyRoutes = require('./routes/imageProxyRoutes');
const setupRoutes = require('./routes/setupRoutes');
const pool = require('./config/database');

const app = express();

// Migration automatique au démarrage
async function runMigrations() {
  try {
    console.log('🔧 Vérification des migrations...');

    // Ajouter le statut on-hold à la contrainte orders_status_check
    await pool.query(`
      DO $$
      BEGIN
        -- Supprimer l'ancienne contrainte si elle existe
        IF EXISTS (
          SELECT 1 FROM information_schema.check_constraints
          WHERE constraint_name = 'orders_status_check'
        ) THEN
          ALTER TABLE orders DROP CONSTRAINT orders_status_check;
        END IF;

        -- Créer la nouvelle contrainte avec on-hold, preparation et cancelled
        ALTER TABLE orders ADD CONSTRAINT orders_status_check
        CHECK (status IN ('pending', 'processing', 'preparation', 'picking', 'completed', 'failed', 'on-hold', 'cancelled'));

        RAISE NOTICE 'Migration on-hold appliquée';
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Contrainte déjà à jour';
      END $$;
    `);

    // Ajouter la colonne shipping_method si elle n'existe pas
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'shipping_method'
        ) THEN
          ALTER TABLE orders ADD COLUMN shipping_method VARCHAR(255);
          RAISE NOTICE 'Colonne shipping_method ajoutée';
        ELSE
          RAISE NOTICE 'Colonne shipping_method déjà existante';
        END IF;
      END $$;
    `);

    console.log('✅ Migrations terminées');
  } catch (error) {
    console.error('⚠️ Erreur migration (non bloquante):', error.message);
  }
}

// Exécuter les migrations au démarrage
runMigrations();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL].filter(Boolean)
    : true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'Picking WebApp API',
    version: '1.0.0',
    status: 'operational'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/image-proxy', imageProxyRoutes);
app.use('/api/setup', setupRoutes);

// Servir les fichiers statiques du frontend en production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));

  // Toutes les autres routes renvoient index.html (pour le routing Vue)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      next();
    }
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Erreur serveur',
    ...(process.env.NODE_ENV !== 'production' && { error: err.message })
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
