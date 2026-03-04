const express = require('express');
const router = express.Router();
const QuoteController = require('../controllers/quoteController');
const { authMiddleware, isCommercial } = require('../middleware/auth');

// Toutes les routes nécessitent auth + rôle commercial (ou admin)
router.use(authMiddleware, isCommercial);

// CRUD devis
router.get('/', QuoteController.getAll);
router.get('/search-products', QuoteController.searchProducts);
router.get('/shipping-methods', QuoteController.getShippingMethods);
router.get('/:id', QuoteController.getById);
router.post('/', QuoteController.create);
router.put('/:id', QuoteController.update);
router.delete('/:id', QuoteController.delete);

// Statut
router.put('/:id/status', QuoteController.updateStatus);

// Items
router.post('/:id/items', QuoteController.addItem);
router.put('/:id/items/:itemId', QuoteController.updateItem);
router.delete('/:id/items/:itemId', QuoteController.deleteItem);

// Recalculer les totaux
router.post('/:id/recalculate', QuoteController.recalculate);

// Convertir en commande
router.post('/:id/convert', QuoteController.convertToOrder);

module.exports = router;
