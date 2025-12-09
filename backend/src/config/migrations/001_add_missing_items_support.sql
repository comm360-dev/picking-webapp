-- Migration: Ajout du support pour les produits manquants
-- Date: 2025-01-08

-- Ajouter une colonne pour marquer les items comme manquants
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS is_missing BOOLEAN DEFAULT false;

-- Ajouter une colonne pour les notes sur les items (rupture, substitution, etc.)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ajouter un commentaire
COMMENT ON COLUMN order_items.is_missing IS 'Indique si le produit était manquant lors du picking';
COMMENT ON COLUMN order_items.notes IS 'Notes sur l''article (raison de rupture, substitution, etc.)';
