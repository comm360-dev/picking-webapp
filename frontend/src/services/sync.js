import { getPendingSyncs, markSyncComplete, addToSyncQueue } from './db'
import api from './api'

class SyncService {
  constructor() {
    this.syncing = false
    this.online = navigator.onLine
    this.syncListeners = []
    this.onlineListeners = []

    this.setupEventListeners()
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.online = true
      this.notifyOnlineListeners(true)
      this.syncPendingData()
    })

    window.addEventListener('offline', () => {
      this.online = false
      this.notifyOnlineListeners(false)
    })

    // Sync périodique toutes les 2 minutes si online
    setInterval(() => {
      if (this.online && !this.syncing) {
        this.syncPendingData()
      }
    }, 120000)
  }

  isOnline() {
    return this.online
  }

  onOnlineStatusChange(callback) {
    this.onlineListeners.push(callback)
    return () => {
      this.onlineListeners = this.onlineListeners.filter(cb => cb !== callback)
    }
  }

  notifyOnlineListeners(status) {
    this.onlineListeners.forEach(callback => callback(status))
  }

  onSyncStatusChange(callback) {
    this.syncListeners.push(callback)
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback)
    }
  }

  notifySyncListeners(status, count = 0) {
    this.syncListeners.forEach(callback => callback(status, count))
  }

  async syncPendingData() {
    if (this.syncing || !this.online) {
      return
    }

    try {
      this.syncing = true
      const pendingSyncs = await getPendingSyncs()

      if (pendingSyncs.length === 0) {
        this.syncing = false
        return
      }

      this.notifySyncListeners('syncing', pendingSyncs.length)

      let successCount = 0
      let failedCount = 0

      for (const syncItem of pendingSyncs) {
        try {
          await this.processSyncItem(syncItem)
          await markSyncComplete(syncItem.id)
          successCount++
        } catch (error) {
          console.error(`Échec de synchronisation pour ${syncItem.type}:`, error)
          failedCount++

          // Si erreur 401, arrêter la sync (token invalide)
          if (error.response?.status === 401) {
            break
          }
        }
      }

      this.syncing = false
      this.notifySyncListeners('completed', successCount)

      if (failedCount > 0) {
        console.warn(`${failedCount} éléments n'ont pas pu être synchronisés`)
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error)
      this.syncing = false
      this.notifySyncListeners('error', 0)
    }
  }

  async processSyncItem(syncItem) {
    const { type, data } = syncItem

    switch (type) {
      case 'start_order':
        await api.post(`/orders/${data.orderId}/start`)
        break

      case 'mark_picked':
        await api.put(`/orders/${data.orderId}/items/${data.itemId}/picked`, {
          pickedQuantity: data.quantity
        })
        break

      case 'mark_missing':
        await api.put(`/orders/${data.orderId}/items/${data.itemId}/missing`, {
          missingQuantity: data.quantity
        })
        break

      case 'complete_order':
        await api.post(`/orders/${data.orderId}/complete`)
        break

      case 'create_qr_mapping':
        await api.post('/admin/qr-mappings', {
          qrCode: data.qrCode,
          sku: data.sku
        })
        break

      default:
        console.warn(`Type de synchronisation inconnu: ${type}`)
    }
  }

  async queueAction(type, data) {
    await addToSyncQueue(type, data)

    // Si online, tenter sync immédiatement
    if (this.online && !this.syncing) {
      setTimeout(() => this.syncPendingData(), 100)
    }
  }

  // Actions offline-first
  async startOrder(orderId) {
    await this.queueAction('start_order', { orderId })
  }

  async markItemPicked(orderId, itemId, quantity) {
    await this.queueAction('mark_picked', { orderId, itemId, quantity })
  }

  async markItemMissing(orderId, itemId, quantity) {
    await this.queueAction('mark_missing', { orderId, itemId, quantity })
  }

  async completeOrder(orderId) {
    await this.queueAction('complete_order', { orderId })
  }

  async createQRMapping(qrCode, sku) {
    await this.queueAction('create_qr_mapping', { qrCode, sku })
  }
}

// Instance singleton
const syncService = new SyncService()

export default syncService
