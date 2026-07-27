const pool = require('../config/database');

class Product {
  static async findBySku(sku) {
    const result = await pool.query(
      'SELECT * FROM products WHERE sku = $1',
      [sku]
    );
    return result.rows[0];
  }

  static async findByWcId(wcId) {
    const result = await pool.query(
      'SELECT * FROM products WHERE wc_id = $1',
      [wcId]
    );
    return result.rows[0];
  }

  static async create({ wcId, sku, name, price, stockQuantity, location, qrCode, imageUrl }) {
    const result = await pool.query(
      `INSERT INTO products (wc_id, sku, name, price, stock_quantity, location, qr_code, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [wcId, sku, name, price, stockQuantity, location, qrCode, imageUrl]
    );
    return result.rows[0];
  }

  static async upsert({ wcId, sku, name, price, stockQuantity, location, qrCode, imageUrl }) {
    const result = await pool.query(
      `INSERT INTO products (wc_id, sku, name, price, stock_quantity, location, qr_code, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (wc_id)
       DO UPDATE SET
         sku = EXCLUDED.sku,
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         stock_quantity = EXCLUDED.stock_quantity,
         location = EXCLUDED.location,
         qr_code = EXCLUDED.qr_code,
         image_url = EXCLUDED.image_url,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [wcId, sku, name, price, stockQuantity, location, qrCode, imageUrl]
    );
    return result.rows[0];
  }

  static async updateStock(productId, stockQuantity) {
    const result = await pool.query(
      'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [stockQuantity, productId]
    );
    return result.rows[0];
  }

  static async updateLocation(productId, location) {
    const result = await pool.query(
      'UPDATE products SET location = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [location, productId]
    );
    return result.rows[0];
  }

  static async updateQRCode(productId, qrCode, location) {
    const result = await pool.query(
      'UPDATE products SET qr_code = $1, location = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [qrCode, location, productId]
    );
    return result.rows[0];
  }

  static async getAll() {
    const result = await pool.query(
      'SELECT * FROM products ORDER BY name ASC'
    );
    return result.rows;
  }

  static async search(searchTerm) {
    const result = await pool.query(
      `SELECT * FROM products
       WHERE name ILIKE $1 OR sku ILIKE $1 OR qr_code ILIKE $1
       ORDER BY name ASC`,
      [`%${searchTerm}%`]
    );
    return result.rows;
  }

  static async bulkUpsert(products) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertedProducts = [];
      const skippedProducts = [];

      for (const product of products) {
        // Utiliser wc_id au lieu de id
        const wcId = product.wc_id || product.id;
        const sku = product.sku || `PRODUCT-${wcId}`;

        // Vérifier si le SKU existe déjà (pour éviter les doublons)
        if (!product.sku) {
          console.warn(`⚠️  Produit WC ID ${wcId} sans SKU, génération automatique: ${sku}`);
        }

        // On isole chaque produit dans un point de sauvegarde : ainsi, si deux
        // produits WooCommerce partagent le même SKU (contrainte d'unicité sur
        // sku), seul le doublon est ignoré au lieu d'annuler toute la synchro.
        await client.query('SAVEPOINT product_sp');
        try {
          const result = await client.query(
            `INSERT INTO products (wc_id, sku, name, price, stock_quantity, location, qr_code, image_url, weight)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (wc_id)
             DO UPDATE SET
               sku = EXCLUDED.sku,
               name = EXCLUDED.name,
               price = EXCLUDED.price,
               stock_quantity = EXCLUDED.stock_quantity,
               image_url = EXCLUDED.image_url,
               weight = EXCLUDED.weight,
               updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
              wcId,
              sku,
              product.name,
              product.price || 0,
              product.stock_quantity || 0,
              product.location || null,
              product.qr_code || null,
              product.image_url || null,
              product.weight || 0
            ]
          );
          insertedProducts.push(result.rows[0]);
          await client.query('RELEASE SAVEPOINT product_sp');
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT product_sp');
          await client.query('RELEASE SAVEPOINT product_sp');
          if (err.code === '23505') {
            // SKU (ou autre clé) en doublon : on ignore ce produit sans casser la synchro
            skippedProducts.push({ sku, wcId, name: product.name });
            console.warn(`⚠️  Produit ignoré (doublon "${err.constraint}", SKU "${sku}", WC ID ${wcId} - ${product.name}). À corriger dans WooCommerce.`);
          } else {
            throw err;
          }
        }
      }

      await client.query('COMMIT');
      if (skippedProducts.length > 0) {
        console.warn(`⚠️  ${skippedProducts.length} produit(s) ignoré(s) pour doublon: ${skippedProducts.map(p => `${p.sku} (${p.name})`).join(', ')}`);
      }
      return insertedProducts;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Product;
