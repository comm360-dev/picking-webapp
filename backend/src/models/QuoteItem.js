const pool = require('../config/database');

class QuoteItem {
  static async create({ quoteId, productId, customName, customSku, quantity, unitPrice, weight, notes }) {
    const result = await pool.query(
      `INSERT INTO quote_items (quote_id, product_id, custom_name, custom_sku, quantity, unit_price, weight, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [quoteId, productId || null, customName || null, customSku || null, quantity, unitPrice, weight || 0, notes || null]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const result = await pool.query(
      `UPDATE quote_items SET
        custom_name = COALESCE($1, custom_name),
        custom_sku = COALESCE($2, custom_sku),
        quantity = COALESCE($3, quantity),
        unit_price = COALESCE($4, unit_price),
        weight = COALESCE($5, weight),
        notes = COALESCE($6, notes)
       WHERE id = $7
       RETURNING *`,
      [data.customName, data.customSku, data.quantity, data.unitPrice, data.weight, data.notes, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM quote_items WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static async getByQuoteId(quoteId) {
    const result = await pool.query(
      `SELECT qi.*, p.name as product_name, p.sku as product_sku, p.image_url, p.price as product_price
       FROM quote_items qi
       LEFT JOIN products p ON qi.product_id = p.id
       WHERE qi.quote_id = $1
       ORDER BY qi.id`,
      [quoteId]
    );
    return result.rows;
  }
}

module.exports = QuoteItem;
