import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'
import { ordersDB, orderItemsDB } from '../services/db'
import syncService from '../services/sync'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref([])
  const loading = ref(false)
  const error = ref(null)
  const syncing = ref(false)

  const pendingOrders = computed(() =>
    orders.value.filter(o => o.status === 'pending' || o.status === 'processing')
  )

  const completedOrders = computed(() =>
    orders.value.filter(o => o.status === 'completed')
  )

  const ordersCount = computed(() => orders.value.length)

  async function fetchOrders(filters = {}) {
    loading.value = true
    error.value = null

    try {
      // Si online, charger depuis l'API
      if (syncService.isOnline()) {
        try {
          const params = new URLSearchParams(filters).toString()
          const response = await api.get(`/orders${params ? '?' + params : ''}`)
          orders.value = response.data.orders

          // Sauvegarder dans IndexedDB pour usage offline
          await ordersDB.bulkPut(response.data.orders.map(order => ({
            ...order,
            synced: true
          })))

          return { success: true }
        } catch (err) {
          console.warn('Erreur API, chargement depuis le cache:', err)
        }
      }

      // Si offline ou erreur API, charger depuis le cache
      const cachedOrders = await ordersDB.toArray()
      orders.value = cachedOrders
      return { success: true }

    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la récupération des commandes'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function syncOrders() {
    syncing.value = true
    error.value = null

    try {
      const response = await api.post('/orders/sync')
      await fetchOrders()

      // Charger les détails complets de toutes les commandes pour usage offline
      if (orders.value.length > 0) {
        console.log(`Chargement des détails de ${orders.value.length} commandes...`)

        for (const order of orders.value) {
          try {
            const detailResponse = await api.get(`/orders/${order.id}`)
            const fullOrder = detailResponse.data

            // Sauvegarder la commande complète
            await ordersDB.put({ ...fullOrder, synced: true })

            // Supprimer les anciens items de cette commande pour éviter les doublons
            await orderItemsDB.where('order_id').equals(order.id).delete()

            // Sauvegarder tous les nouveaux items
            if (fullOrder.items && fullOrder.items.length > 0) {
              for (const item of fullOrder.items) {
                await orderItemsDB.put({ ...item, order_id: order.id })
              }
            }
          } catch (err) {
            console.warn(`Erreur lors du chargement de la commande ${order.id}:`, err)
          }
        }

        console.log('✅ Toutes les commandes et leurs items sont en cache')
      }

      return {
        success: true,
        stats: response.data.stats
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la synchronisation'
      return { success: false, error: error.value }
    } finally {
      syncing.value = false
    }
  }

  async function getOrderDetails(orderId) {
    try {
      const response = await api.get(`/orders/${orderId}`)
      return { success: true, order: response.data }
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la récupération du détail'
      return { success: false, error: error.value }
    }
  }

  async function updateOrderStatus(orderId, status) {
    try {
      const response = await api.put(`/orders/${orderId}/status`, { status })

      // Mettre à jour dans la liste locale
      const index = orders.value.findIndex(o => o.id === orderId)
      if (index !== -1) {
        orders.value[index] = { ...orders.value[index], ...response.data.order }
      }

      return { success: true }
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la mise à jour'
      return { success: false, error: error.value }
    }
  }

  async function completeOrder(orderId) {
    try {
      const response = await api.post(`/orders/${orderId}/complete`)

      // Mettre à jour dans la liste locale
      const index = orders.value.findIndex(o => o.id === orderId)
      if (index !== -1) {
        orders.value[index] = { ...orders.value[index], ...response.data.order }
      }

      return { success: true }
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la finalisation'
      return { success: false, error: error.value }
    }
  }

  function clearOrders() {
    orders.value = []
  }

  return {
    orders,
    loading,
    error,
    syncing,
    pendingOrders,
    completedOrders,
    ordersCount,
    fetchOrders,
    syncOrders,
    getOrderDetails,
    updateOrderStatus,
    completeOrder,
    clearOrders
  }
})
