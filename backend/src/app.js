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
const quoteRoutes = require('./routes/quoteRoutes');
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

    // Ajouter le rôle commercial à la contrainte users_role_check
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.check_constraints
          WHERE constraint_name = 'users_role_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_role_check;
        END IF;

        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('preparateur', 'admin', 'commercial'));

        RAISE NOTICE 'Migration rôle commercial appliquée';
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Contrainte rôle déjà à jour';
      END $$;
    `);

    // Créer les tables quotes et quote_items si elles n'existent pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        quote_number VARCHAR(100) UNIQUE,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        shipping_address TEXT,
        shipping_city VARCHAR(255),
        shipping_postcode VARCHAR(20),
        shipping_country VARCHAR(100) DEFAULT 'FR',
        shipping_method VARCHAR(255),
        shipping_cost DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'converted')),
        subtotal DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) DEFAULT 0,
        discount_type VARCHAR(20) CHECK (discount_type IN ('percent', 'fixed')),
        discount_value DECIMAL(10, 2) DEFAULT 0,
        notes TEXT,
        valid_until DATE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        wc_order_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quote_items (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        custom_name VARCHAR(255),
        custom_sku VARCHAR(255),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10, 2) NOT NULL,
        weight DECIMAL(10, 3) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
      CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
      CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
    `);

    // Ajouter la colonne weight à la table products si elle n'existe pas
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'products' AND column_name = 'weight'
        ) THEN
          ALTER TABLE products ADD COLUMN weight DECIMAL(10, 3) DEFAULT 0;
          RAISE NOTICE 'Colonne weight ajoutée à products';
        ELSE
          RAISE NOTICE 'Colonne weight déjà existante';
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

// Sonde de vie de l'API, toujours disponible.
app.get('/api', (req, res) => {
  res.json({
    message: 'Picking WebApp API',
    version: '1.0.0',
    status: 'operational'
  });
});

// En production ce service sert aussi l'application : la racine doit rendre l'app,
// pas ce JSON. express.static s'en charge plus bas (index.html par défaut). En
// développement le frontend a son propre serveur Vite, la racine reste informative.
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.redirect('/api');
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/image-proxy', imageProxyRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/quotes', quoteRoutes);

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
