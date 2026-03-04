const Quote = require('../models/Quote');
const QuoteItem = require('../models/QuoteItem');
const Product = require('../models/Product');
const woocommerceService = require('../services/woocommerceService');

class QuoteController {
  // Lister tous les devis
  static async getAll(req, res) {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;

      const quotes = await Quote.getAll(filters);
      res.json(quotes);
    } catch (error) {
      console.error('Erreur getAll quotes:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }

  // Obtenir un devis avec ses items
  static async getById(req, res) {
    try {
      const quote = await Quote.getWithItems(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: 'Devis introuvable' });
      }
      res.json(quote);
    } catch (error) {
      console.error('Erreur getById quote:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }

  // Créer un nouveau devis
  static async create(req, res) {
    try {
      const quote = await Quote.create({
        ...req.body,
        createdBy: req.user.id
      });
      res.status(201).json(quote);
    } catch (error) {
      console.error('Erreur create quote:', error);
      res.status(500).json({ message: 'Erreur lors de la création', error: error.message });
    }
  }

  // Mettre à jour un devis
  static async update(req, res) {
    try {
      const existing = await Quote.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Devis introuvable' });
      }
      if (existing.status === 'converted') {
        return res.status(400).json({ message: 'Un devis converti ne peut pas être modifié' });
      }

      const quote = await Quote.update(req.params.id, req.body);
      res.json(quote);
    } catch (error) {
      console.error('Erreur update quote:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour', error: error.message });
    }
  }

  // Supprimer un devis (uniquement brouillon)
  static async delete(req, res) {
    try {
      const deleted = await Quote.delete(req.params.id);
      if (!deleted) {
        return res.status(400).json({ message: 'Seuls les brouillons peuvent être supprimés' });
      }
      res.json({ message: 'Devis supprimé', quote: deleted });
    } catch (error) {
      console.error('Erreur delete quote:', error);
      res.status(500).json({ message: 'Erreur lors de la suppression', error: error.message });
    }
  }

  // Changer le statut d'un devis
  static async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const validStatuses = ['draft', 'sent', 'accepted', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Statut invalide' });
      }

      const quote = await Quote.updateStatus(req.params.id, status);
      if (!quote) {
        return res.status(404).json({ message: 'Devis introuvable' });
      }
      res.json(quote);
    } catch (error) {
      console.error('Erreur updateStatus quote:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }

  // Ajouter un item au devis
  static async addItem(req, res) {
    try {
      const quote = await Quote.findById(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: 'Devis introuvable' });
      }
      if (quote.status === 'converted') {
        return res.status(400).json({ message: 'Un devis converti ne peut pas être modifié' });
      }

      const item = await QuoteItem.create({
        quoteId: req.params.id,
        ...req.body
      });

      // Recalculer les totaux
      const updated = await Quote.updateTotals(req.params.id);

      res.status(201).json({ item, quote: updated });
    } catch (error) {
      console.error('Erreur addItem:', error);
      res.status(500).json({ message: 'Erreur lors de l\'ajout', error: error.message });
    }
  }

  // Mettre à jour un item
  static async updateItem(req, res) {
    try {
      const item = await QuoteItem.update(req.params.itemId, req.body);
      if (!item) {
        return res.status(404).json({ message: 'Item introuvable' });
      }

      const updated = await Quote.updateTotals(req.params.id);
      res.json({ item, quote: updated });
    } catch (error) {
      console.error('Erreur updateItem:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }

  // Supprimer un item
  static async deleteItem(req, res) {
    try {
      const deleted = await QuoteItem.delete(req.params.itemId);
      if (!deleted) {
        return res.status(404).json({ message: 'Item introuvable' });
      }

      const updated = await Quote.updateTotals(req.params.id);
      res.json({ message: 'Item supprimé', quote: updated });
    } catch (error) {
      console.error('Erreur deleteItem:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }

  // Recalculer les totaux (après changement remise/livraison)
  static async recalculate(req, res) {
    try {
      // D'abord mettre à jour remise et livraison si fournis
      if (req.body.discountType !== undefined || req.body.discountValue !== undefined || req.body.shippingCost !== undefined) {
        await Quote.update(req.params.id, req.body);
      }

      const updated = await Quote.updateTotals(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error('Erreur recalculate:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }

  // Convertir le devis en commande WooCommerce
  static async convertToOrder(req, res) {
    try {
      const quote = await Quote.getWithItems(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: 'Devis introuvable' });
      }
      if (quote.status === 'converted') {
        return res.status(400).json({ message: 'Ce devis a déjà été converti' });
      }
      if (!quote.items || quote.items.length === 0) {
        return res.status(400).json({ message: 'Le devis ne contient aucun article' });
      }

      // Construire les line_items pour WooCommerce
      const lineItems = quote.items.map(item => {
        const lineItem = {
          quantity: item.quantity,
          total: (item.unit_price * item.quantity).toFixed(2)
        };

        if (item.product_id) {
          // Produit existant sur WooCommerce
          lineItem.product_id = item.product_id;
        } else {
          // Produit personnalisé (ligne manuelle)
          lineItem.name = item.custom_name || 'Article personnalisé';
        }

        return lineItem;
      });

      // Préparer les données de la commande WooCommerce
      const nameParts = (quote.customer_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const orderData = {
        status: 'processing',
        billing: {
          first_name: firstName,
          last_name: lastName,
          email: quote.customer_email || '',
          phone: quote.customer_phone || ''
        },
        shipping: {
          first_name: firstName,
          last_name: lastName,
          address_1: quote.shipping_address || '',
          city: quote.shipping_city || '',
          postcode: quote.shipping_postcode || '',
          country: quote.shipping_country || 'FR'
        },
        line_items: lineItems,
        shipping_lines: quote.shipping_method ? [{
          method_title: quote.shipping_method,
          total: (quote.shipping_cost || 0).toFixed(2)
        }] : []
      };

      // Créer la commande sur WooCommerce
      const wcOrder = await woocommerceService.createOrder(orderData);

      // Mettre à jour le devis
      await Quote.update(req.params.id, {
        status: 'converted',
        wcOrderId: wcOrder.id
      });

      const updatedQuote = await Quote.getWithItems(req.params.id);

      res.json({
        message: 'Devis converti en commande avec succès',
        wcOrderId: wcOrder.id,
        wcOrderNumber: wcOrder.number,
        quote: updatedQuote
      });
    } catch (error) {
      console.error('Erreur convertToOrder:', error);
      res.status(500).json({ message: 'Erreur lors de la conversion', error: error.message });
    }
  }

  // Rechercher des produits pour l'autocomplete
  static async searchProducts(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) {
        return res.json([]);
      }

      const products = await Product.search(q);
      res.json(products);
    } catch (error) {
      console.error('Erreur searchProducts:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }

  // Récupérer les méthodes de livraison WooCommerce
  static async getShippingMethods(req, res) {
    try {
      const methods = await woocommerceService.getShippingMethods();
      res.json(methods);
    } catch (error) {
      console.error('Erreur getShippingMethods:', error);
      res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
  }
}

module.exports = QuoteController;
