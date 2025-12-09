const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const OrderItemController = require('../controllers/orderItemController');
const { authMiddleware } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

router.post('/sync', OrderController.syncOrders);
router.get('/', OrderController.getAllOrders);
router.get('/:id', OrderController.getOrderDetails);
router.put('/:id/status', OrderController.updateOrderStatus);
router.post('/:id/start', OrderController.startOrder);
router.post('/:id/complete', OrderController.completeOrder);
router.put('/:orderId/items/:itemId/pick', OrderItemController.markItemAsPicked);
router.put('/:orderId/items/:itemId/missing', OrderItemController.markItemAsMissing);

module.exports = router;
