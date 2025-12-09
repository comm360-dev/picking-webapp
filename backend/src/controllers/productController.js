const Product = require('../models/Product');
const wooCommerceService = require('../services/woocommerceService');

class ProductController {
  static async getAllProducts(req, res) {
    try {
      const products = await Product.getAll();

      res.json({
        products,
        count: products.length
      });
    } catch (error) {
      console.error('Erreur getAllProducts:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async syncAllProducts(req, res) {
    try {
      console.log('🔄 Début de la synchronisation complète des produits WooCommerce...');

      // Récupérer TOUS les produits depuis WooCommerce
      const wcProducts = await wooCommerceService.getAllProducts();

      console.log(`📦 ${wcProducts.length} produits à synchroniser`);

      // Transformer les produits WooCommerce pour notre format
      const productsData = wcProducts.map(wcProduct => {
        const wcImageUrl = wcProduct.images && wcProduct.images.length > 0 ? wcProduct.images[0].src : null;
        // Convertir l'URL WooCommerce en URL proxy pour éviter CORS/Mixed Content
        const imageUrl = wcImageUrl ? `/api/image-proxy?url=${encodeURIComponent(wcImageUrl)}` : null;

        return {
          wc_id: wcProduct.id,
          name: wcProduct.name,
          sku: wcProduct.sku || `PRODUCT-${wcProduct.id}`,
          price: parseFloat(wcProduct.price || 0),
          stock_quantity: wcProduct.stock_quantity || 0,
          location: null,
          qr_code: null,
          image_url: imageUrl
        };
      });

      // Insérer/Mettre à jour en base de données
      await Product.bulkUpsert(productsData);

      // Récupérer tous les produits depuis la DB pour les retourner
      const products = await Product.getAll();

      console.log('✅ Synchronisation des produits terminée');

      res.json({
        message: `${wcProducts.length} produits synchronisés avec succès`,
        products,
        count: products.length
      });
    } catch (error) {
      console.error('Erreur syncAllProducts:', error);
      res.status(500).json({
        message: 'Erreur lors de la synchronisation des produits',
        error: error.message
      });
    }
  }

  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const { location } = req.body;

      const result = await Product.updateLocation(id, location);

      if (!result) {
        return res.status(404).json({ message: 'Produit non trouvé' });
      }

      res.json({
        message: 'Produit mis à jour',
        product: result
      });
    } catch (error) {
      console.error('Erreur updateProduct:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async updateQRCode(req, res) {
    try {
      const { id } = req.params;
      const { qrCode, location } = req.body;

      if (!qrCode) {
        return res.status(400).json({ message: 'QR Code requis' });
      }

      const result = await Product.updateQRCode(id, qrCode, location);

      if (!result) {
        return res.status(404).json({ message: 'Produit non trouvé' });
      }

      res.json({
        message: 'QR Code mis à jour',
        product: result
      });
    } catch (error) {
      console.error('Erreur updateQRCode:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async searchBySKU(req, res) {
    try {
      const { sku } = req.params;
      const product = await Product.findBySku(sku);

      if (!product) {
        return res.status(404).json({ message: 'Produit non trouvé' });
      }

      res.json(product);
    } catch (error) {
      console.error('Erreur searchBySKU:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
}

module.exports = ProductController;
