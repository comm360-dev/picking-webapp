-- Migration pour ajouter le tracking des commandes
-- Date: 2025-12-08

-- Ajouter des colonnes de tracking temporel aux commandes
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS picking_duration INTEGER; -- durée en secondes

-- Ajouter une colonne pour l'utilisateur qui a préparé la commande
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS prepared_by INTEGER REFERENCES users(id);

-- Créer une table pour l'historique détaillé
CREATE TABLE IF NOT EXISTS order_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'started', 'item_picked', 'item_missing', 'completed'
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);
CREATE INDEX IF NOT EXISTS idx_orders_prepared_by ON orders(prepared_by);
