-- Script d'initialisation de la base de données PostgreSQL
-- Picking WebApp

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'preparateur' CHECK (role IN ('preparateur', 'admin')),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: products (cache local des produits WooCommerce)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  sku VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2),
  stock_quantity INTEGER,
  location VARCHAR(100),
  qr_code VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: orders (commandes WooCommerce)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  order_number VARCHAR(100),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'picking', 'completed', 'failed')),
  total DECIMAL(10, 2),
  order_date TIMESTAMP,
  picked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  picked_at TIMESTAMP,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: order_items (articles de commande)
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  picked_quantity INTEGER DEFAULT 0,
  is_picked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: qr_mappings (correspondance QR code <-> SKU)
CREATE TABLE IF NOT EXISTS qr_mappings (
  id SERIAL PRIMARY KEY,
  qr_code VARCHAR(255) UNIQUE NOT NULL,
  sku VARCHAR(255) NOT NULL,
  location VARCHAR(100),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sku) REFERENCES products(sku) ON DELETE CASCADE
);

-- Table: sync_logs (logs de synchronisation)
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) CHECK (type IN ('order_fetch', 'order_update', 'product_sync', 'inventory_sync')),
  status VARCHAR(50) CHECK (status IN ('success', 'error', 'pending')),
  message TEXT,
  data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: inventory_logs (historique inventaire)
CREATE TABLE IF NOT EXISTS inventory_logs (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  old_quantity INTEGER,
  new_quantity INTEGER,
  difference INTEGER,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes pour optimisation
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_qr_code ON products(qr_code);
CREATE INDEX idx_orders_wc_id ON orders(wc_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_qr_mappings_qr_code ON qr_mappings(qr_code);
CREATE INDEX idx_qr_mappings_sku ON qr_mappings(sku);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qr_mappings_updated_at BEFORE UPDATE ON qr_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion d'un utilisateur admin par défaut
-- Mot de passe: admin123 (à changer en production!)
-- Hash bcrypt de 'admin123'
INSERT INTO users (email, password, role, first_name, last_name)
VALUES (
  'admin@picking.local',
  '$2b$10$YourHashedPasswordHere',
  'admin',
  'Admin',
  'System'
) ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE users IS 'Utilisateurs de l''application (préparateurs et admins)';
COMMENT ON TABLE products IS 'Cache local des produits synchronisés depuis WooCommerce';
COMMENT ON TABLE orders IS 'Commandes synchronisées depuis WooCommerce';
COMMENT ON TABLE order_items IS 'Articles de chaque commande';
COMMENT ON TABLE qr_mappings IS 'Correspondance entre QR codes et SKU produits';
COMMENT ON TABLE sync_logs IS 'Logs des synchronisations WooCommerce';
COMMENT ON TABLE inventory_logs IS 'Historique des modifications d''inventaire';
