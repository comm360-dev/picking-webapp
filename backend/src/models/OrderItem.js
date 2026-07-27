const pool = require('../config/database');

// Détecte le "contenant" d'un lot intelligent (bundle WooSB) : cette ligne de
// commande n'a pas d'existence physique, seuls ses composants (marqués
// _woosb_parent_id) doivent être préparés. On la reconnaît à la clé _woosb_ids.
function isBundleContainer(item) {
  return Array.isArray(item.meta_data)
    && item.meta_data.some(m => m.key === '_woosb_ids');
}

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
       SET picked_quantity = $1, is_picked = ($1 >= quantity)
       WHERE id = $2
       RETURNING *`,
      [pickedQuantity, itemId]
    );

    if (result.rows[0]) {
      // Récupérer le nom du produit pour l'historique
      const productResult = await pool.query(
        `SELECT p.name FROM products p
         JOIN order_items oi ON oi.product_id = p.id
         WHERE oi.id = $1`,
        [itemId]
      );
      result.rows[0].name = productResult.rows[0]?.name || 'Produit inconnu';
    }

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

    if (result.rows[0]) {
      // Récupérer le nom du produit pour l'historique
      const productResult = await pool.query(
        `SELECT p.name FROM products p
         JOIN order_items oi ON oi.product_id = p.id
         WHERE oi.id = $1`,
        [itemId]
      );
      result.rows[0].name = productResult.rows[0]?.name || 'Produit inconnu';
    }

    return result.rows[0];
  }

  static async resetMissing(itemId) {
    const result = await pool.query(
      `UPDATE order_items
       SET is_missing = false, notes = NULL
       WHERE id = $1
       RETURNING *`,
      [itemId]
    );

    if (result.rows[0]) {
      // Récupérer le nom du produit pour l'historique
      const productResult = await pool.query(
        `SELECT p.name FROM products p
         JOIN order_items oi ON oi.product_id = p.id
         WHERE oi.id = $1`,
        [itemId]
      );
      result.rows[0].name = productResult.rows[0]?.name || 'Produit inconnu';
    }

    return result.rows[0];
  }

  static async unpick(itemId) {
    const result = await pool.query(
      `UPDATE order_items
       SET is_picked = false, picked_quantity = 0
       WHERE id = $1
       RETURNING *`,
      [itemId]
    );

    if (result.rows[0]) {
      // Récupérer le nom du produit pour l'historique
      const productResult = await pool.query(
        `SELECT p.name FROM products p
         JOIN order_items oi ON oi.product_id = p.id
         WHERE oi.id = $1`,
        [itemId]
      );
      result.rows[0].name = productResult.rows[0]?.name || 'Produit inconnu';
    }

    return result.rows[0];
  }

  static async bulkCreate(orderId, items, products) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Supprimer les anciens items
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

      const insertedItems = [];

      // Écarter les contenants de lots intelligents (bundles) : on ne prépare
      // que les vrais articles physiques, pas le "kit" qui les regroupe.
      const scannableItems = items.filter(item => {
        if (isBundleContainer(item)) {
          console.log(`  ⏭️  Lot intelligent ignoré (non physique): ${item.name}`);
          return false;
        }
        return true;
      });

      console.log(`📦 Création de ${scannableItems.length} items pour commande ${orderId} (${items.length - scannableItems.length} lot(s) intelligent(s) ignoré(s))`);

      for (const item of scannableItems) {
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
          const wcImageUrl = item.image && item.image.src ? item.image.src : null;
          // Convertir en URL proxy pour éviter CORS/Mixed Content
          const imageUrl = wcImageUrl ? `/api/image-proxy?url=${encodeURIComponent(wcImageUrl)}` : null;
          console.log(`  📸 Image pour ${item.name}: ${imageUrl ? 'PROXY' : 'NON'}`);
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
