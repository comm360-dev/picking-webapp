const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const History = require('../models/History');
const woocommerceService = require('../services/woocommerceService');

class OrderController {
  static async syncOrders(req, res) {
    try {
      console.log('🔄 Début de la synchronisation des commandes...');

      // Récupérer les produits depuis WooCommerce
      const wcProducts = await woocommerceService.getProducts();
      console.log(`📥 ${wcProducts.length} produits récupérés depuis WooCommerce`);

      // Transformer les produits pour inclure l'image
      const productsData = wcProducts.map(wcProduct => {
        const wcImageUrl = wcProduct.images && wcProduct.images.length > 0 ? wcProduct.images[0].src : null;
        // Convertir l'URL WooCommerce en URL proxy pour éviter CORS/Mixed Content
        const imageUrl = wcImageUrl ? `/api/image-proxy?url=${encodeURIComponent(wcImageUrl)}` : null;
        console.log(`🖼️  Produit ${wcProduct.id} (${wcProduct.name}): image = ${imageUrl ? 'PROXY' : 'NON'}`);
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
      const products = await Product.bulkUpsert(productsData);
      console.log(`✅ ${products.length} produits synchronisés`);

      // Récupérer les commandes processing et preparation depuis WooCommerce
      const [processingOrders, preparationOrders] = await Promise.all([
        woocommerceService.getOrders({ status: 'processing' }),
        woocommerceService.getOrders({ status: 'preparation' })
      ]);
      console.log(`📋 ${processingOrders.length} commandes processing, ${preparationOrders.length} commandes preparation`);
      const wcOrders = [...processingOrders, ...preparationOrders];
      const orders = await Order.bulkUpsert(wcOrders);
      console.log(`✅ ${orders.length} commandes synchronisées`);

      // Synchroniser les items de chaque commande
      // Ne pas écraser les items des commandes on-hold ou completed
      for (let i = 0; i < wcOrders.length; i++) {
        const wcOrder = wcOrders[i];
        const order = orders[i];

        // Ne pas toucher aux items des commandes on-hold ou completed
        if (['on-hold', 'completed'].includes(order.status)) {
          console.log(`⏸️ Items de la commande #${order.order_number} préservés (statut: ${order.status})`);
          continue;
        }

        if (wcOrder.line_items && wcOrder.line_items.length > 0) {
          await OrderItem.bulkCreate(order.id, wcOrder.line_items, products);
        }
      }

      // Détecter les commandes locales qui ne sont plus actives sur WooCommerce
      // (ex: annulées, remboursées, etc.)
      const activeWcIds = wcOrders.map(o => o.id);
      const localActiveOrders = await Order.getAll({ status: 'processing' });
      const localPreparationOrders = await Order.getAll({ status: 'preparation' });
      const allLocalActive = [...localActiveOrders, ...localPreparationOrders];

      let cancelledCount = 0;
      for (const localOrder of allLocalActive) {
        if (!activeWcIds.includes(localOrder.wc_id)) {
          // Cette commande n'est plus processing/preparation sur WooCommerce
          await Order.updateStatus(localOrder.id, 'cancelled');
          console.log(`🚫 Commande #${localOrder.order_number} marquée comme annulée (plus active sur WooCommerce)`);
          cancelledCount++;
        }
      }

      if (cancelledCount > 0) {
        console.log(`🚫 ${cancelledCount} commande(s) marquée(s) comme annulée(s)`);
      }

      res.json({
        message: 'Synchronisation réussie',
        stats: {
          products: products.length,
          orders: orders.length,
          cancelled: cancelledCount,
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

      // Attacher les items pour les commandes on-hold (pour afficher les manquants)
      for (const order of orders) {
        if (order.status === 'on-hold') {
          const fullOrder = await Order.getWithItems(order.id);
          if (fullOrder) {
            order.items = fullOrder.items;
          }
        }
      }

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

  static async startOrder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const order = await Order.startPicking(id, userId);

      if (!order) {
        return res.status(404).json({ message: 'Commande non trouvée' });
      }

      // Enregistrer dans l'historique
      await History.create({
        orderId: parseInt(id),
        userId,
        action: 'started',
        details: {
          orderNumber: order.order_number,
          customerName: order.customer_name
        }
      });

      res.json({
        message: 'Picking démarré',
        order
      });
    } catch (error) {
      console.error('Erreur startOrder:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async completeOrder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const order = await Order.completePicking(id, userId);

      if (!order) {
        return res.status(404).json({ message: 'Commande non trouvée' });
      }

      // Enregistrer dans l'historique
      await History.create({
        orderId: parseInt(id),
        userId,
        action: 'completed',
        details: {
          orderNumber: order.order_number,
          customerName: order.customer_name,
          duration: order.picking_duration
        }
      });

      // Mettre à jour le statut sur WooCommerce
      try {
        console.log(`🔄 Mise à jour du statut WooCommerce pour la commande #${order.wc_id}...`);
        await woocommerceService.updateOrderStatus(order.wc_id, 'completed');
        console.log(`✅ Statut WooCommerce mis à jour pour la commande #${order.wc_id}`);
      } catch (wcError) {
        console.error('⚠️  Erreur lors de la mise à jour WooCommerce:', wcError.message);
        // On continue même si la mise à jour WooCommerce échoue
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

  static async holdOrder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Mettre la commande en attente (on-hold) localement
      // On garde le statut 'processing' sur WooCommerce mais on marque 'on-hold' localement
      const updated = await Order.updateStatus(id, 'on-hold');

      if (!updated) {
        return res.status(404).json({ message: 'Commande non trouvée' });
      }

      // Marquer durablement que la commande a été mise en attente pour rupture de stock.
      // Ce drapeau empêche la finalisation forcée tant que l'article manquant n'a pas été
      // réappprovisionné et scanné (le statut on-hold est perdu à la reprise, pas ce drapeau).
      const order = await Order.markHeldForStock(id);

      // Enregistrer dans l'historique
      await History.create({
        orderId: parseInt(id),
        userId,
        action: 'on-hold',
        details: {
          orderNumber: order.order_number,
          customerName: order.customer_name,
          reason: 'Articles en rupture de stock'
        }
      });

      console.log(`⏸️ Commande #${order.order_number} mise en attente`);

      res.json({
        message: 'Commande mise en attente',
        order
      });
    } catch (error) {
      console.error('Erreur holdOrder:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
}

module.exports = OrderController;

