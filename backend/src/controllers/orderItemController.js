const OrderItem = require('../models/OrderItem');
const History = require('../models/History');

class OrderItemController {
  static async markItemAsPicked(req, res) {
    try {
      const { orderId, itemId } = req.params;
      const { pickedQuantity } = req.body;
      const userId = req.user.id;

      if (pickedQuantity === undefined || pickedQuantity < 0) {
        return res.status(400).json({ message: 'Quantité invalide' });
      }

      const item = await OrderItem.markAsPicked(itemId, pickedQuantity);

      if (!item) {
        return res.status(404).json({ message: 'Article non trouvé' });
      }

      // Enregistrer dans l'historique
      await History.create({
        orderId: parseInt(orderId),
        userId,
        action: 'item_picked',
        details: {
          itemId: item.id,
          productName: item.name,
          quantity: pickedQuantity
        }
      });

      res.json({
        message: 'Article mis à jour',
        item
      });
    } catch (error) {
      console.error('Erreur markItemAsPicked:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async markItemAsMissing(req, res) {
    try {
      const { orderId, itemId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;

      const item = await OrderItem.markAsMissing(itemId, notes || 'Produit manquant');

      if (!item) {
        return res.status(404).json({ message: 'Article non trouvé' });
      }

      // Enregistrer dans l'historique
      await History.create({
        orderId: parseInt(orderId),
        userId,
        action: 'item_missing',
        details: {
          itemId: item.id,
          productName: item.name,
          notes: notes || 'Produit manquant'
        }
      });

      res.json({
        message: 'Article marqué comme manquant',
        item
      });
    } catch (error) {
      console.error('Erreur markItemAsMissing:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
}

module.exports = OrderItemController;
