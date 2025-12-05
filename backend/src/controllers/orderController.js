const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const woocommerceService = require('../services/woocommerceService');

class OrderController {
  static async syncOrders(req, res) {
    try {
      console.log('🔄 Début de la synchronisation des commandes...');

      // Récupérer les produits depuis WooCommerce
      const wcProducts = await woocommerceService.getProducts();
      const products = await Product.bulkUpsert(wcProducts);
      console.log(`✅ ${products.length} produits synchronisés`);

      // Récupérer les commandes depuis WooCommerce
      const wcOrders = await woocommerceService.getOrders({ status: 'processing,pending' });
      const orders = await Order.bulkUpsert(wcOrders);
      console.log(`✅ ${orders.length} commandes synchronisées`);

      // Synchroniser les items de chaque commande
      for (let i = 0; i < wcOrders.length; i++) {
        const wcOrder = wcOrders[i];
        const order = orders[i];

        if (wcOrder.line_items && wcOrder.line_items.length > 0) {
          await OrderItem.bulkCreate(order.id, wcOrder.line_items, products);
        }
      }

      res.json({
        message: 'Synchronisation réussie',
        stats: {
          products: products.length,
          orders: orders.length,
          mockMode: woocommerceService.isMockMode()
        }
      });
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      res.status(500).json({
        message: 'Erreur lors de la synchronisation',
        error: error.message
      });
    }
  }

  static async getAllOrders(req, res) {
    try {
      const { status, synced } = req.query;
      const filters = {};

      if (status) filters.status = status;
      if (synced !== undefined) filters.synced = synced === 'true';

      const orders = await Order.getAll(filters);

      res.json({
        orders,
        count: orders.length
      });
    } catch (error) {
      console.error('Erreur getAllOrders:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async getOrderDetails(req, res) {
    try {
      const { id } = req.params;
      const order = await Order.getWithItems(id);

      if (!order) {
        return res.status(404).json({ message: 'Commande non trouvée' });
      }

      res.json(order);
    } catch (error) {
      console.error('Erreur getOrderDetails:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const order = await Order.updateStatus(id, status);

      if (!order) {
        return res.status(404).json({ message: 'Commande non trouvée' });
      }

      res.json({
        message: 'Statut mis à jour',
        order
      });
    } catch (error) {
      console.error('Erreur updateOrderStatus:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async completeOrder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const order = await Order.markAsPicked(id, userId);

      if (!order) {
        return res.status(404).json({ message: 'Commande non trouvée' });
      }

      res.json({
        message: 'Commande marquée comme terminée',
        order
      });
    } catch (error) {
      console.error('Erreur completeOrder:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
}

module.exports = OrderController;
