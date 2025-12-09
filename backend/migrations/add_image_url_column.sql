-- Migration: Ajouter la colonne image_url à la table products
-- Date: 2025-12-08

ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index optionnel pour améliorer les performances si nécessaire
-- CREATE INDEX IF NOT EXISTS idx_products_image_url ON products(image_url);
