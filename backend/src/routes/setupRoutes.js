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

module.exports = router;
