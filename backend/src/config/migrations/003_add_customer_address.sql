-- Migration pour ajouter les informations d'adresse client
-- Date: 2026-02-02

-- Ajouter les colonnes d'adresse de livraison
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_postcode VARCHAR(20),
ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);

-- Index pour la recherche par ville
CREATE INDEX IF NOT EXISTS idx_orders_shipping_city ON orders(shipping_city);
