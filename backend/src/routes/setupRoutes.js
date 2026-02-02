const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../config/database');

// Route temporaire pour initialiser la base de données
// À SUPPRIMER après l'initialisation !
router.get('/init-db', async (req, res) => {
  try {
    console.log('🔧 Initialisation de la base de données...');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../config/init-db.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // Générer un hash pour le mot de passe admin
    console.log('🔐 Génération du mot de passe admin...');
    const adminPassword = await bcrypt.hash('admin123', 10);

    // Remplacer le placeholder par le vrai hash
    sql = sql.replace('$2b$10$YourHashedPasswordHere', adminPassword);

    console.log('📝 Création des tables...');
    await pool.query(sql);

    console.log('✅ Base de données initialisée avec succès!');

    res.json({
      success: true,
      message: 'Base de données initialisée avec succès!',
      admin: {
        email: 'admin@picking.local',
        password: 'admin123',
        warning: 'Changez ce mot de passe en production!'
      }
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour vérifier l'état de la base de données
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    res.json({
      success: true,
      database: 'connected',
      usersCount: result.rows[0].count
    });
  } catch (error) {
    res.json({
      success: false,
      database: 'not initialized',
      error: error.message
    });
  }
});

// Route pour ajouter la colonne image_url si elle n'existe pas
router.get('/add-image-column', async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `);
    res.json({
      success: true,
      message: 'Colonne image_url ajoutée avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour vérifier les URLs des images dans la base
router.get('/check-images', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, image_url FROM products LIMIT 5');
    res.json({
      success: true,
      products: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour corriger les URLs des images (convertir en proxy)
router.get('/fix-image-urls', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE products
      SET image_url = '/api/image-proxy?url=' || encode(convert_to(image_url, 'UTF8'), 'escape')
      WHERE image_url IS NOT NULL
        AND image_url NOT LIKE '/api/image-proxy%'
        AND image_url LIKE 'http%'
      RETURNING id, name, image_url
    `);
    res.json({
      success: true,
      message: `${result.rowCount} URLs corrigées`,
      updated: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour créer la table order_history si elle n'existe pas
router.get('/add-history-table', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ajouter des index pour les requêtes fréquentes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_order_history_user_id ON order_history(user_id)
    `);

    res.json({
      success: true,
      message: 'Table order_history créée avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour ajouter les colonnes manquantes sur order_items
router.get('/fix-order-items', async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS is_missing BOOLEAN DEFAULT false
    `);
    await pool.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS notes TEXT
    `);

    res.json({
      success: true,
      message: 'Colonnes is_missing et notes ajoutées à order_items'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour créer le compte préparateur
router.get('/create-preparateur', async (req, res) => {
  try {
    // Vérifier si le compte existe déjà
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', ['preparateur@picking.com']);

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Le compte préparateur existe déjà',
        email: 'preparateur@picking.com'
      });
    }

    // Créer le compte
    const passwordHash = await bcrypt.hash('preparateur123', 10);
    await pool.query(
      'INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5)',
      ['preparateur@picking.com', passwordHash, 'preparateur', 'Jean', 'Dupont']
    );

    res.json({
      success: true,
      message: 'Compte préparateur créé avec succès',
      credentials: {
        email: 'preparateur@picking.com',
        password: 'preparateur123',
        role: 'preparateur'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour ajouter les colonnes picking sur orders
router.get('/fix-orders-table', async (req, res) => {
  try {
    // Colonnes pour le picking
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS picking_duration INTEGER`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMP`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepared_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);

    res.json({
      success: true,
      message: 'Colonnes picking ajoutées à orders (picking_duration, started_at, completed_at, prepared_by)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour ajouter les colonnes d'adresse client sur orders
router.get('/add-customer-address', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(255)`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_postcode VARCHAR(20)`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100)`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50)`);

    res.json({
      success: true,
      message: 'Colonnes adresse client ajoutées à orders (shipping_address, shipping_city, shipping_postcode, shipping_country, customer_phone)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
