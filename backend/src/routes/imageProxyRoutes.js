const express = require('express');
const router = express.Router();
const axios = require('axios');

// Proxy pour charger les images WooCommerce sans problèmes CORS/Mixed Content
router.get('/', async (req, res) => {
  try {
    const imageUrl = req.query.url;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Récupérer l'image depuis WooCommerce
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Picking-WebApp/1.0'
      }
    });

    // Définir les headers appropriés
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h

    // Envoyer l'image
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('❌ Erreur proxy image:', error.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

module.exports = router;
