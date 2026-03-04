const pool = require('../config/database');

class Quote {
  static async create({ customerName, customerEmail, customerPhone, shippingAddress, shippingCity, shippingPostcode, shippingCountry, shippingMethod, shippingCost, notes, validUntil, createdBy }) {
    // Générer un numéro de devis unique (DEV-YYYYMMDD-XXX)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM quotes WHERE quote_number LIKE $1",
      [`DEV-${today}-%`]
    );
    const num = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0');
    const quoteNumber = `DEV-${today}-${num}`;

    const result = await pool.query(
      `INSERT INTO quotes (quote_number, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_postcode, shipping_country, shipping_method, shipping_cost, notes, valid_until, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [quoteNumber, customerName, customerEmail, customerPhone, shippingAddress, shippingCity, shippingPostcode, shippingCountry || 'FR', shippingMethod, shippingCost || 0, notes, validUntil, createdBy]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async getWithItems(id) {
    const quoteResult = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
    if (quoteResult.rows.length === 0) return null;

    const quote = quoteResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT qi.*, p.name as product_name, p.sku as product_sku, p.image_url, p.price as product_price
       FROM quote_items qi
       LEFT JOIN products p ON qi.product_id = p.id
       WHERE qi.quote_id = $1
       ORDER BY qi.id`,
      [id]
    );

    quote.items = itemsResult.rows;
    return quote;
  }

  static async getAll(filters = {}) {
    let query = 'SELECT q.*, u.first_name, u.last_name FROM quotes q LEFT JOIN users u ON q.created_by = u.id WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND q.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.createdBy) {
      query += ` AND q.created_by = $${paramIndex}`;
      params.push(filters.createdBy);
      paramIndex++;
    }

    query += ' ORDER BY q.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = {
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      shipping_address: data.shippingAddress,
      shipping_city: data.shippingCity,
      shipping_postcode: data.shippingPostcode,
      shipping_country: data.shippingCountry,
      shipping_method: data.shippingMethod,
      shipping_cost: data.shippingCost,
      status: data.status,
      subtotal: data.subtotal,
      total: data.total,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      notes: data.notes,
      valid_until: data.validUntil,
      wc_order_id: data.wcOrderId
    };

    for (const [key, value] of Object.entries(allowedFields)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE quotes SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async updateTotals(id) {
    // Recalculer subtotal depuis les items
    const itemsResult = await pool.query(
      'SELECT SUM(unit_price * quantity) as subtotal, SUM(weight * quantity) as total_weight FROM quote_items WHERE quote_id = $1',
      [id]
    );

    const subtotal = parseFloat(itemsResult.rows[0].subtotal) || 0;
    const totalWeight = parseFloat(itemsResult.rows[0].total_weight) || 0;

    // Récupérer le devis pour la remise et les frais de port
    const quote = await this.findById(id);
    let discount = 0;
    if (quote.discount_type === 'percent') {
      discount = subtotal * (parseFloat(quote.discount_value) / 100);
    } else if (quote.discount_type === 'fixed') {
      discount = parseFloat(quote.discount_value) || 0;
    }

    const shippingCost = parseFloat(quote.shipping_cost) || 0;
    const total = subtotal - discount + shippingCost;

    const result = await pool.query(
      'UPDATE quotes SET subtotal = $1, total = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [subtotal, total, id]
    );
    return { ...result.rows[0], total_weight: totalWeight };
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM quotes WHERE id = $1 AND status = $2 RETURNING *', [id, 'draft']);
    return result.rows[0];
  }

  static async updateStatus(id, status) {
    const result = await pool.query(
      'UPDATE quotes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  }
}

module.exports = Quote;
