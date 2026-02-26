const pool = require('../config/database');

class Order {
  static async findByWcId(wcId) {
    const result = await pool.query(
      'SELECT * FROM orders WHERE wc_id = $1',
      [wcId]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async create({ wcId, orderNumber, customerName, customerEmail, status, total, orderDate }) {
    const result = await pool.query(
      `INSERT INTO orders (wc_id, order_number, customer_name, customer_email, status, total, order_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [wcId, orderNumber, customerName, customerEmail, status, total, orderDate]
    );
    return result.rows[0];
  }

  static async upsert({ wcId, orderNumber, customerName, customerEmail, status, total, orderDate }) {
    const result = await pool.query(
      `INSERT INTO orders (wc_id, order_number, customer_name, customer_email, status, total, order_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (wc_id)
       DO UPDATE SET
         order_number = EXCLUDED.order_number,
         customer_name = EXCLUDED.customer_name,
         customer_email = EXCLUDED.customer_email,
         status = EXCLUDED.status,
         total = EXCLUDED.total,
         order_date = EXCLUDED.order_date,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [wcId, orderNumber, customerName, customerEmail, status, total, orderDate]
    );
    return result.rows[0];
  }

  static async updateStatus(orderId, status) {
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, orderId]
    );
    return result.rows[0];
  }

  static async markAsPicked(orderId, userId) {
    const result = await pool.query(
      `UPDATE orders
       SET status = 'completed', picked_by = $1, picked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [userId, orderId]
    );
    return result.rows[0];
  }

  static async startPicking(orderId, userId) {
    const result = await pool.query(
      `UPDATE orders
       SET status = 'processing', started_at = CURRENT_TIMESTAMP, prepared_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [userId, orderId]
    );
    return result.rows[0];
  }

  static async completePicking(orderId, userId) {
    const result = await pool.query(
      `UPDATE orders
       SET status = 'completed',
           completed_at = CURRENT_TIMESTAMP,
           picking_duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::INTEGER,
           prepared_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [userId, orderId]
    );
    return result.rows[0];
  }

  static async markAsSynced(orderId) {
    const result = await pool.query(
      'UPDATE orders SET synced = true WHERE id = $1 RETURNING *',
      [orderId]
    );
    return result.rows[0];
  }

  static async getAll(filters = {}) {
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.synced !== undefined) {
      query += ` AND synced = $${paramIndex}`;
      params.push(filters.synced);
      paramIndex++;
    }

    query += ' ORDER BY order_date DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getWithItems(orderId) {
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT oi.*, p.name, p.sku, p.location, p.qr_code, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    order.items = itemsResult.rows;
    return order;
  }

  static async bulkUpsert(orders) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertedOrders = [];

      for (const order of orders) {
        const customerName = `${order.billing.first_name} ${order.billing.last_name}`;

        // Extraire l'adresse de livraison (utiliser shipping si disponible, sinon billing)
        const shipping = order.shipping || order.billing;
        const shippingAddress = [shipping.address_1, shipping.address_2].filter(Boolean).join(', ');
        const shippingCity = shipping.city || '';
        const shippingPostcode = shipping.postcode || '';
        const shippingCountry = shipping.country || '';
        const customerPhone = order.billing.phone || '';
        const shippingMethod = order.shipping_lines?.[0]?.method_title || '';

        // Vérifier si la commande existe déjà avec un statut local spécial (on-hold, completed)
        const existingOrder = await client.query(
          'SELECT id, status FROM orders WHERE wc_id = $1',
          [order.id]
        );

        // Si la commande existe et est en "on-hold" ou "completed", ne pas écraser le statut
        const preserveLocalStatus = existingOrder.rows.length > 0 &&
          ['on-hold', 'completed'].includes(existingOrder.rows[0].status);

        let result;
        if (preserveLocalStatus) {
          // Mettre à jour sans toucher au statut
          result = await client.query(
            `UPDATE orders SET
               order_number = $2,
               customer_name = $3,
               customer_email = $4,
               total = $5,
               order_date = $6,
               shipping_address = $7,
               shipping_city = $8,
               shipping_postcode = $9,
               shipping_country = $10,
               customer_phone = $11,
               shipping_method = $12,
               updated_at = CURRENT_TIMESTAMP
             WHERE wc_id = $1
             RETURNING *`,
            [
              order.id,
              order.number,
              customerName,
              order.billing.email,
              order.total,
              order.date_created,
              shippingAddress,
              shippingCity,
              shippingPostcode,
              shippingCountry,
              customerPhone,
              shippingMethod
            ]
          );
          console.log(`⏸️ Commande #${order.number} préservée avec statut local: ${existingOrder.rows[0].status}`);
        } else {
          // Insérer ou mettre à jour normalement (y compris le statut)
          result = await client.query(
            `INSERT INTO orders (wc_id, order_number, customer_name, customer_email, status, total, order_date, shipping_address, shipping_city, shipping_postcode, shipping_country, customer_phone, shipping_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (wc_id)
             DO UPDATE SET
               order_number = EXCLUDED.order_number,
               customer_name = EXCLUDED.customer_name,
               customer_email = EXCLUDED.customer_email,
               status = EXCLUDED.status,
               total = EXCLUDED.total,
               order_date = EXCLUDED.order_date,
               shipping_address = EXCLUDED.shipping_address,
               shipping_city = EXCLUDED.shipping_city,
               shipping_postcode = EXCLUDED.shipping_postcode,
               shipping_country = EXCLUDED.shipping_country,
               customer_phone = EXCLUDED.customer_phone,
               shipping_method = EXCLUDED.shipping_method,
               updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
              order.id,
              order.number,
              customerName,
              order.billing.email,
              order.status,
              order.total,
              order.date_created,
              shippingAddress,
              shippingCity,
              shippingPostcode,
              shippingCountry,
              customerPhone,
              shippingMethod
            ]
          );
        }

        insertedOrders.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return insertedOrders;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Order;
