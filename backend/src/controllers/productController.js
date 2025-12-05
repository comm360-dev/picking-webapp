const Product = require('../models/Product');

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
