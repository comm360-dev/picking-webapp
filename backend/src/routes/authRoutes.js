const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// Route d'inscription désactivée - gestion interne uniquement
// router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/profile', authMiddleware, AuthController.getProfile);
router.put('/password', authMiddleware, AuthController.updatePassword);

module.exports = router;
