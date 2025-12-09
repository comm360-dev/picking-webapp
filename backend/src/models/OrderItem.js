const pool = require('../config/database');

class OrderItem {
  static async create({ orderId, productId, quantity }) {
    const result = await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [orderId, productId, quantity]
    );
    return result.rows[0];
  }

  static async getByOrderId(orderId) {
    const result = await pool.query(
      `SELECT oi.*, p.name, p.sku, p.location, p.qr_code, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );
    return result.rows;
  }

  static async markAsPicked(itemId, pickedQuantity) {
    const result = await pool.query(
      `UPDATE order_items
       SET picked_quantity = $1, is_picked = (picked_quantity >= quantity)
       WHERE id = $2
       RETURNING *`,
      [pickedQuantity, itemId]
    );
    return result.rows[0];
  }

  static async markAsMissing(itemId, notes) {
    const result = await pool.query(
      `UPDATE order_items
       SET is_missing = true, notes = $1, is_picked = false
       WHERE id = $2
       RETURNING *`,
      [notes, itemId]
    );
    return result.rows[0];
  }

  static async bulkCreate(orderId, items, products) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Supprimer les anciens items
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

      const insertedItems = [];

      console.log(`📦 Création de ${items.length} items pour commande ${orderId}`);

      for (const item of items) {
        // Trouver le produit correspondant par wc_id
        const product = products.find(p => p.wc_id === item.product_id);

        if (product) {
          console.log(`  ✓ Item trouvé: ${item.name} (product_id=${item.product_id}, db_id=${product.id})`);
          const result = await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [orderId, product.id, item.quantity]
          );
          insertedItems.push(result.rows[0]);
        } else {
          console.warn(`  ⚠️  Produit non trouvé pour item: ${item.name} (product_id=${item.product_id})`);
          // Créer le produit s'il n'existe pas
          const imageUrl = item.image && item.image.src ? item.image.src : null;
          console.log(`  📸 Image pour ${item.name}: ${imageUrl ? 'OUI (' + imageUrl.substring(0, 50) + '...)' : 'NON (item.image=' + JSON.stringify(item.image) + ')'}`);
          const newProduct = await client.query(
            `INSERT INTO products (wc_id, sku, name, price, stock_quantity, image_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (wc_id) DO UPDATE SET name = EXCLUDED.name, image_url = EXCLUDED.image_url
             RETURNING *`,
            [
              item.product_id,
              item.sku || `PRODUCT-${item.product_id}`,
              item.name,
              item.price || 0,
              0,
              imageUrl
            ]
          );

          const result = await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [orderId, newProduct.rows[0].id, item.quantity]
          );
          insertedItems.push(result.rows[0]);
          console.log(`  ✓ Produit créé et item ajouté: ${item.name}`);
        }
      }

      console.log(`✅ ${insertedItems.length} items créés pour commande ${orderId}`);

      await client.query('COMMIT');
      return insertedItems;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur bulkCreate:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = OrderItem;
