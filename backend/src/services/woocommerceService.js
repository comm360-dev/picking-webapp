const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const https = require('https');
require('dotenv').config();

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === 'production'
});

// Données mockées pour le développement
const MOCK_PRODUCTS = [
  {
    id: 1,
    name: 'T-shirt Bleu',
    sku: 'TSH-BLUE-001',
    price: '29.99',
    stock_quantity: 50,
    location: 'A1-B2'
  },
  {
    id: 2,
    name: 'Pantalon Noir',
    sku: 'PNT-BLACK-002',
    price: '59.99',
    stock_quantity: 30,
    location: 'A2-C1'
  },
  {
    id: 3,
    name: 'Chaussures Running',
    sku: 'SHO-RUN-003',
    price: '89.99',
    stock_quantity: 20,
    location: 'B1-A3'
  },
  {
    id: 4,
    name: 'Veste Sport',
    sku: 'JKT-SPORT-004',
    price: '79.99',
    stock_quantity: 15,
    location: 'A3-B1'
  }
];

const MOCK_ORDERS = [
  {
    id: 101,
    number: '1001',
    status: 'processing',
    total: '119.98',
    date_created: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    billing: {
      first_name: 'Jean',
      last_name: 'Dupont',
      email: 'jean.dupont@example.com'
    },
    line_items: [
      {
        id: 1,
        product_id: 1,
        name: 'T-shirt Bleu',
        sku: 'TSH-BLUE-001',
        quantity: 2,
        total: '59.98'
      },
      {
        id: 2,
        product_id: 2,
        name: 'Pantalon Noir',
        sku: 'PNT-BLACK-002',
        quantity: 1,
        total: '59.99'
      }
    ]
  },
  {
    id: 102,
    number: '1002',
    status: 'processing',
    total: '89.99',
    date_created: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    billing: {
      first_name: 'Marie',
      last_name: 'Martin',
      email: 'marie.martin@example.com'
    },
    line_items: [
      {
        id: 3,
        product_id: 3,
        name: 'Chaussures Running',
        sku: 'SHO-RUN-003',
        quantity: 1,
        total: '89.99'
      }
    ]
  },
  {
    id: 103,
    number: '1003',
    status: 'pending',
    total: '169.97',
    date_created: new Date().toISOString(),
    billing: {
      first_name: 'Pierre',
      last_name: 'Bernard',
      email: 'pierre.bernard@example.com'
    },
    line_items: [
      {
        id: 4,
        product_id: 1,
        name: 'T-shirt Bleu',
        sku: 'TSH-BLUE-001',
        quantity: 3,
        total: '89.97'
      },
      {
        id: 5,
        product_id: 4,
        name: 'Veste Sport',
        sku: 'JKT-SPORT-004',
        quantity: 1,
        total: '79.99'
      }
    ]
  }
];

class WooCommerceService {
  constructor() {
    this.useMockData = !process.env.WC_URL || !process.env.WC_CONSUMER_KEY;

    if (!this.useMockData) {
      this.api = new WooCommerceRestApi({
        url: process.env.WC_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: 'wc/v3',
        axiosConfig: {
          httpsAgent: httpsAgent
        }
      });
      console.log('✅ WooCommerce API configurée');
    } else {
      console.log('⚠️  Mode MOCK activé - Utilisation de données fictives');
    }
  }

  async getProducts(params = {}) {
    if (this.useMockData) {
      console.log('📦 Récupération des produits mockés');
      return MOCK_PRODUCTS;
    }

    try {
      const response = await this.api.get('products', params);
      return response.data;
    } catch (error) {
      console.error('Erreur WooCommerce getProducts:', error);
      throw error;
    }
  }

  async getAllProducts() {
    if (this.useMockData) {
      console.log('📦 Récupération de TOUS les produits mockés');
      return MOCK_PRODUCTS;
    }

    try {
      let allProducts = [];
      let page = 1;
      let hasMore = true;

      console.log('📦 Début de la synchronisation de TOUS les produits WooCommerce...');

      while (hasMore) {
        const response = await this.api.get('products', {
          per_page: 100, // Maximum autorisé par WooCommerce
          page: page
        });

        const products = response.data;
        allProducts = allProducts.concat(products);

        console.log(`  ✓ Page ${page}: ${products.length} produits récupérés`);

        // Vérifier s'il y a encore des pages
        const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
        hasMore = page < totalPages;
        page++;
      }

      console.log(`✅ Total: ${allProducts.length} produits récupérés depuis WooCommerce`);
      return allProducts;
    } catch (error) {
      console.error('Erreur WooCommerce getAllProducts:', error);
      throw error;
    }
  }

  async getOrders(params = { status: 'processing,pending' }) {
    if (this.useMockData) {
      console.log('📋 Récupération des commandes mockées');
      // Filtrer par statut si spécifié
      if (params.status) {
        const statuses = params.status.split(',');
        return MOCK_ORDERS.filter(order => statuses.includes(order.status));
      }
      return MOCK_ORDERS;
    }

    try {
      // Récupérer toutes les commandes avec pagination
      let allOrders = [];
      let page = 1;
      let hasMore = true;

      console.log('📋 Récupération de toutes les commandes WooCommerce...');

      while (hasMore) {
        const response = await this.api.get('orders', {
          ...params,
          per_page: 100, // Maximum autorisé par WooCommerce
          page: page
        });

        const orders = response.data;
        allOrders = allOrders.concat(orders);
        console.log(`  ✓ Page ${page}: ${orders.length} commandes récupérées`);

        // Vérifier s'il y a encore des pages
        const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
        hasMore = page < totalPages;
        page++;
      }

      console.log(`📋 Total: ${allOrders.length} commandes récupérées`);
      return allOrders;
    } catch (error) {
      console.error('Erreur WooCommerce getOrders:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, status) {
    if (this.useMockData) {
      console.log(`🔄 Mock: Mise à jour commande #${orderId} vers ${status}`);
      return { id: orderId, status };
    }

    try {
      const response = await this.api.put(`orders/${orderId}`, { status });
      return response.data;
    } catch (error) {
      console.error('Erreur WooCommerce updateOrderStatus:', error);
      throw error;
    }
  }

  async updateProductStock(productId, stockQuantity) {
    if (this.useMockData) {
      console.log(`📦 Mock: Mise à jour stock produit #${productId} -> ${stockQuantity}`);
      return { id: productId, stock_quantity: stockQuantity };
    }

    try {
      const response = await this.api.put(`products/${productId}`, {
        stock_quantity: stockQuantity
      });
      return response.data;
    } catch (error) {
      console.error('Erreur WooCommerce updateProductStock:', error);
      throw error;
    }
  }

  isMockMode() {
    return this.useMockData;
  }
}

module.exports = new WooCommerceService();
