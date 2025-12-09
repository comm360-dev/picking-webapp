import Dexie from 'dexie'

const db = new Dexie('PickingWebApp')

db.version(1).stores({
  orders: 'id, wc_id, status, order_date, synced',
  orderItems: 'id, order_id, product_id, is_picked',
  products: 'id, wc_id, sku, qr_code',
  qrMappings: 'id, qr_code, sku',
  syncQueue: '++id, type, timestamp, synced'
})

export const ordersDB = db.orders
export const orderItemsDB = db.orderItems
export const productsDB = db.products
export const qrMappingsDB = db.qrMappings
export const syncQueueDB = db.syncQueue

export async function clearAllData() {
  await Promise.all([
    ordersDB.clear(),
    orderItemsDB.clear(),
    productsDB.clear(),
    qrMappingsDB.clear(),
    syncQueueDB.clear()
  ])
}

export async function addToSyncQueue(type, data) {
  return await syncQueueDB.add({
    type,
    data,
    timestamp: new Date(),
    synced: false
  })
}

export async function getPendingSyncs() {
  return await syncQueueDB.filter(item => !item.synced).toArray()
}

export async function markSyncComplete(id) {
  return await syncQueueDB.update(id, { synced: true })
}

export async function cleanDuplicateItems() {
  // Nettoyer les doublons d'items en ne gardant que les plus récents par ID
  const allItems = await orderItemsDB.toArray()
  const itemsByIdAndOrder = new Map()

  // Grouper par order_id + item.id
  allItems.forEach(item => {
    const key = `${item.order_id}_${item.id}`
    const existing = itemsByIdAndOrder.get(key)

    if (!existing || !itemsByIdAndOrder.has(key)) {
      itemsByIdAndOrder.set(key, item)
    }
  })

  // Supprimer tous les items et réinsérer les uniques
  await orderItemsDB.clear()
  await orderItemsDB.bulkAdd(Array.from(itemsByIdAndOrder.values()))

  console.log(`🧹 Nettoyage: ${allItems.length} items -> ${itemsByIdAndOrder.size} items uniques`)
}

export default db
