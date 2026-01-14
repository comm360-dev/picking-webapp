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

module.exports = router;
