const pool = require('../config/database');

class History {
  static async create({ orderId, userId, action, details = null }) {
    const result = await pool.query(
      `INSERT INTO order_history (order_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, userId, action, details ? JSON.stringify(details) : null]
    );
    return result.rows[0];
  }

  static async getByOrderId(orderId) {
    const result = await pool.query(
      `SELECT oh.*, u.first_name, u.last_name, u.email
       FROM order_history oh
       LEFT JOIN users u ON oh.user_id = u.id
       WHERE oh.order_id = $1
       ORDER BY oh.created_at DESC`,
      [orderId]
    );
    return result.rows;
  }

  static async getByUserId(userId, limit = 50) {
    const result = await pool.query(
      `SELECT oh.*, o.order_number, o.customer_name
       FROM order_history oh
       LEFT JOIN orders o ON oh.order_id = o.id
       WHERE oh.user_id = $1
       ORDER BY oh.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  static async getRecentHistory(limit = 100) {
    const result = await pool.query(
      `SELECT oh.*,
              o.order_number, o.customer_name,
              u.first_name, u.last_name, u.email
       FROM order_history oh
       LEFT JOIN orders o ON oh.order_id = o.id
       LEFT JOIN users u ON oh.user_id = u.id
       ORDER BY oh.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  static async getStatistics(userId = null, startDate = null, endDate = null) {
    let query = `
      SELECT
        COUNT(DISTINCT CASE WHEN action = 'completed' THEN order_id END) as completed_orders,
        COUNT(CASE WHEN action = 'item_picked' THEN 1 END) as items_picked,
        COUNT(CASE WHEN action = 'item_missing' THEN 1 END) as items_missing,
        COUNT(DISTINCT order_id) as total_orders_touched
      FROM order_history
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  static async getUserPerformance(startDate = null, endDate = null) {
    let query = `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(DISTINCT CASE WHEN oh.action = 'completed' THEN oh.order_id END) as completed_orders,
        COUNT(CASE WHEN oh.action = 'item_picked' THEN 1 END) as items_picked,
        COUNT(CASE WHEN oh.action = 'item_missing' THEN 1 END) as items_missing,
        AVG(CASE WHEN o.picking_duration IS NOT NULL THEN o.picking_duration END) as avg_duration
      FROM users u
      LEFT JOIN order_history oh ON u.id = oh.user_id
      LEFT JOIN orders o ON oh.order_id = o.id AND oh.action = 'completed'
      WHERE u.role = 'preparateur'
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND oh.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND oh.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY u.id, u.first_name, u.last_name, u.email
               ORDER BY completed_orders DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }
}

module.exports = History;
