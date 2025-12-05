const OrderItem = require('../models/OrderItem');

class OrderItemController {
  static async markItemAsPicked(req, res) {
    try {
      const { orderId, itemId } = req.params;
      const { pickedQuantity } = req.body;

      if (pickedQuantity === undefined || pickedQuantity < 0) {
        return res.status(400).json({ message: 'Quantité invalide' });
      }

      const item = await OrderItem.markAsPicked(itemId, pickedQuantity);

      if (!item) {
        return res.status(404).json({ message: 'Article non trouvé' });
      }

      res.json({
        message: 'Article mis à jour',
        item
      });
    } catch (error) {
      console.error('Erreur markItemAsPicked:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
}

module.exports = OrderItemController;
