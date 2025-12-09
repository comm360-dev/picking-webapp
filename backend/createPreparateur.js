require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

const passwordHash = '$2b$10$Oe96vSKtYrYZjnFvB7dExubLtPdO.88qWg5GJTxNnDtV3p3vg3njG';

pool.query(
  `INSERT INTO users (email, password, role, first_name, last_name)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (email) DO UPDATE
   SET password = $2, role = $3, first_name = $4, last_name = $5
   RETURNING *`,
  ['preparateur@picking.com', passwordHash, 'preparateur', 'Jean', 'Dupont']
)
.then(result => {
  console.log('✅ Utilisateur préparateur créé/mis à jour:');
  console.log('   Email: preparateur@picking.com');
  console.log('   Mot de passe: preparateur123');
  console.log('   Nom: Jean Dupont');
  console.log('   Rôle: preparateur');
  pool.end();
})
.catch(error => {
  console.error('❌ Erreur:', error.message);
  pool.end();
  process.exit(1);
});
