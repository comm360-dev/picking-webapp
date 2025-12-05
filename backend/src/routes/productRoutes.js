const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { authMiddleware, isAdmin } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

router.get('/', ProductController.getAllProducts);
router.get('/sku/:sku', ProductController.searchBySKU);
router.put('/:id', isAdmin, ProductController.updateProduct);
router.put('/:id/qr', isAdmin, ProductController.updateQRCode);

module.exports = router;
