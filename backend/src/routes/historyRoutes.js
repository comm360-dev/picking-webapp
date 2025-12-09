const express = require('express');
const router = express.Router();
const HistoryController = require('../controllers/historyController');
const { authMiddleware } = require('../middleware/auth');

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// GET /api/history - Historique récent
router.get('/', HistoryController.getRecentHistory);

// GET /api/history/order/:orderId - Historique d'une commande
router.get('/order/:orderId', HistoryController.getOrderHistory);

// GET /api/history/user - Historique de l'utilisateur connecté
router.get('/user', HistoryController.getUserHistory);

// GET /api/history/statistics - Statistiques
router.get('/statistics', HistoryController.getStatistics);

// GET /api/history/performance - Performance des utilisateurs (admin seulement)
router.get('/performance', HistoryController.getUserPerformance);

module.exports = router;
