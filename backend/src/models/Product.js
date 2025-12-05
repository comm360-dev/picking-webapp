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

  static async create({ wcId, sku, name, price, stockQuantity, location, qrCode }) {
    const result = await pool.query(
      `INSERT INTO products (wc_id, sku, name, price, stock_quantity, location, qr_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [wcId, sku, name, price, stockQuantity, location, qrCode]
    );
    return result.rows[0];
  }

  static async upsert({ wcId, sku, name, price, stockQuantity, location, qrCode }) {
    const result = await pool.query(
      `INSERT INTO products (wc_id, sku, name, price, stock_quantity, location, qr_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (wc_id)
       DO UPDATE SET
         sku = EXCLUDED.sku,
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         stock_quantity = EXCLUDED.stock_quantity,
         location = EXCLUDED.location,
         qr_code = EXCLUDED.qr_code,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [wcId, sku, name, price, stockQuantity, location, qrCode]
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

      for (const product of products) {
        // Ignorer les produits sans SKU ou générer un SKU par défaut
        const sku = product.sku || `PRODUCT-${product.id}`;

        // Vérifier si le SKU existe déjà (pour éviter les doublons)
        if (!product.sku) {
          console.warn(`⚠️  Produit ${product.id} sans SKU, génération automatique: ${sku}`);
        }

        const result = await client.query(
          `INSERT INTO products (wc_id, sku, name, price, stock_quantity, location)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (wc_id)
           DO UPDATE SET
             sku = EXCLUDED.sku,
             name = EXCLUDED.name,
             price = EXCLUDED.price,
             stock_quantity = EXCLUDED.stock_quantity,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            product.id,
            sku,
            product.name,
            product.price,
            product.stock_quantity,
            product.location || null
          ]
        );
        insertedProducts.push(result.rows[0]);
      }

      await client.query('COMMIT');
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
