require('dotenv').config();

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('❌ ERREUR: JWT_SECRET doit être défini et faire au moins 32 caractères');
  process.exit(1);
}

module.exports = {
  secret,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
};
