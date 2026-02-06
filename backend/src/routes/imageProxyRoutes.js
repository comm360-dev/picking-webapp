const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === 'production'
});

// Proxy pour charger les images WooCommerce sans problèmes CORS/Mixed Content
router.get('/', async (req, res) => {
  try {
    const imageUrl = req.query.url;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Validation : n'autoriser que les URLs d'images du domaine WooCommerce
    const wcUrl = process.env.WC_URL;
    if (wcUrl) {
      try {
        const parsedUrl = new URL(imageUrl);
        const parsedWcUrl = new URL(wcUrl);
        if (parsedUrl.hostname !== parsedWcUrl.hostname) {
          return res.status(403).json({ error: 'Domaine non autorisé' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'URL invalide' });
      }
    }

    // Récupérer l'image depuis WooCommerce
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      httpsAgent: httpsAgent,
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
