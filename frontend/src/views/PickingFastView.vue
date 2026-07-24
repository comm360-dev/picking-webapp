<template>
  <div class="picking-fast-container">
    <div v-if="loading" class="loading">
      Chargement de la commande...
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <main v-else-if="order" class="picking-fast-content">
      <!-- Header avec progression -->
      <header class="fast-header">
        <button @click="goBack" class="btn-back">← Retour</button>
        <div class="order-info">
          <span class="order-number">#{{ order.order_number }}</span>
          <span class="customer-name">{{ order.customer_name }}</span>
          <span v-if="order.shipping_method" class="shipping-method-badge">🚚 {{ order.shipping_method }}</span>
        </div>
        <div class="progress-badge">
          {{ currentItemIndex + 1 }} / {{ unpickedItems.length }}
        </div>
      </header>

      <!-- Barre de progression globale -->
      <div class="global-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <span class="progress-text">{{ pickedItems }} / {{ totalItems }} articles scannés</span>
      </div>

      <!-- Commande terminée -->
      <div v-if="allItemsPicked && !hasMissingItems" class="completion-screen">
        <div class="completion-card">
          <div class="completion-icon">🎉</div>
          <h2>Tous les articles sont scannés !</h2>

          <div class="order-recap">
            <div class="recap-details">
              <div class="recap-row">
                <span class="recap-label">Commande</span>
                <span class="recap-value">#{{ order.order_number }}</span>
              </div>
              <div class="recap-row">
                <span class="recap-label">Client</span>
                <span class="recap-value">{{ order.customer_name }}</span>
              </div>
              <div v-if="order.customer_phone" class="recap-row">
                <span class="recap-label">Tél.</span>
                <span class="recap-value">{{ order.customer_phone }}</span>
              </div>
              <div v-if="order.shipping_address || order.shipping_city" class="recap-row">
                <span class="recap-label">Adresse</span>
                <span class="recap-value">
                  {{ order.shipping_address }}
                  <br v-if="order.shipping_address && order.shipping_city" />
                  {{ order.shipping_postcode }} {{ order.shipping_city }}
                </span>
              </div>
              <div v-if="order.shipping_method" class="recap-row">
                <span class="recap-label">Livraison</span>
                <span class="recap-value recap-shipping">{{ order.shipping_method }}</span>
              </div>
            </div>

            <div class="recap-items">
              <p class="recap-items-title">🔍 Vérification ({{ pickedItems }} / {{ totalItems }})</p>
              <ul class="recap-items-list">
                <li v-for="item in order.items.filter(i => i.is_picked)" :key="item.id" class="recap-item">
                  <div class="recap-item-thumb" v-if="item.image_url">
                    <img :src="getImageUrl(item.image_url)" :alt="item.name" />
                  </div>
                  <div class="recap-item-thumb recap-item-thumb-placeholder" v-else>📦</div>
                  <span class="recap-item-name">{{ item.name }}</span>
                  <span class="recap-item-qty">x{{ item.picked_quantity }}</span>
                </li>
              </ul>
            </div>
          </div>

          <button @click="completeAndNext" :disabled="completing" class="btn-complete-large">
            {{ completing ? 'Finalisation...' : '✅ Finaliser et passer à la suivante' }}
          </button>
        </div>
      </div>

      <!-- Articles manquants - proposer mise en attente ou finalisation -->
      <div v-else-if="allItemsPicked && hasMissingItems" class="hold-screen">
        <div class="hold-card">
          <div class="hold-icon">⚠️</div>
          <h2>Commande incomplète</h2>
          <p>{{ missingItemsCount }} article(s) en rupture de stock.</p>
          <div class="missing-items-recap" v-if="missingItemsList.length > 0">
            <ul>
              <li v-for="item in missingItemsList" :key="item.id">{{ item.name }} (x{{ item.quantity }})</li>
            </ul>
          </div>
          <div class="hold-actions">
            <button @click="holdOrderAndNext" :disabled="holdingOrder" class="btn-hold-large">
              {{ holdingOrder ? 'Mise en attente...' : '⏸️ Mettre en attente' }}
            </button>
            <button v-if="pickedItems > 0" @click="requestCompleteWithMissing" :disabled="completing" class="btn-complete-partial">
              {{ completing ? 'Finalisation...' : '✅ Finaliser avec les articles scannés' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Mode picking article par article -->
      <div v-else class="item-picking">
        <!-- Article actuel -->
        <div class="current-item-card" v-if="currentItem">
          <div class="item-image-large" v-if="currentItem.image_url">
            <img :src="getImageUrl(currentItem.image_url)" :alt="currentItem.name" />
          </div>
          <div class="item-image-placeholder" v-else>
            <span>📦</span>
          </div>

          <div class="item-details">
            <h2 class="item-name">{{ currentItem.name }}</h2>
            <p class="item-sku">SKU: <strong>{{ currentItem.sku }}</strong></p>
            <p v-if="currentItem.location" class="item-location">📍 {{ currentItem.location }}</p>
          </div>

          <div class="quantity-display">
            <span class="qty-picked">{{ currentItem.picked_quantity || 0 }}</span>
            <span class="qty-separator">/</span>
            <span class="qty-total">{{ currentItem.quantity }}</span>
          </div>
        </div>

        <!-- Scanner -->
        <div class="scanner-section">
          <QRScanner v-if="!scannerPaused" @scan="handleScan" class="scanner-wrapper" />
          <div v-else class="scanner-paused">
            <span>Scanner en pause...</span>
          </div>

          <div class="manual-input">
            <input
              v-model="manualSku"
              type="text"
              placeholder="Ou entrez le SKU manuellement..."
              @keyup.enter="validateManualSku"
              class="sku-input"
            />
            <button @click="validateManualSku" class="btn-validate">OK</button>
          </div>
        </div>

        <!-- Actions rapides -->
        <div class="quick-actions">
          <button @click="openMissingModal" class="btn-missing-quick">
            ⚠️ Produit manquant
          </button>
          <button v-if="unpickedItems.length > 1" @click="skipToNext" class="btn-skip">
            ⏭️ Passer au suivant
          </button>
        </div>

        <!-- Bouton voir la liste complète -->
        <button @click="goToFullView" class="btn-full-list">
          📋 Voir la liste complète
        </button>
      </div>

      <!-- Overlay de confirmation après scan réussi -->
      <transition name="success-overlay">
        <div v-if="successOverlay" class="success-overlay">
          <div class="success-content">
            <div class="success-icon">✓</div>
            <h2 class="success-title">{{ successOverlay.productName }}</h2>
            <p class="success-subtitle">Article scanné</p>
            <p class="success-next" v-if="successOverlay.nextProduct">
              Prochain : <strong>{{ successOverlay.nextProduct }}</strong>
            </p>
          </div>
        </div>
      </transition>

      <!-- Feedback -->
      <transition name="fade">
        <div v-if="feedback" class="feedback-toast" :class="feedback.type">
          {{ feedback.message }}
        </div>
      </transition>

      <!-- Modal de confirmation finalisation avec articles manquants -->
      <div v-if="showCompleteConfirm" class="modal-overlay" @click.self="cancelCompleteWithMissing">
        <div class="modal-content">
          <h3>⚠️ Finaliser une commande incomplète ?</h3>
          <p>
            Cette commande contient <strong>{{ missingItemsCount }} article(s) manquant(s)</strong>.
            Une fois finalisée, la commande sera marquée terminée.
          </p>
          <div class="missing-items-recap" v-if="missingItemsList.length > 0">
            <ul>
              <li v-for="item in missingItemsList" :key="item.id">{{ item.name }} (x{{ item.quantity }})</li>
            </ul>
          </div>
          <div class="modal-actions">
            <button @click="cancelCompleteWithMissing" class="btn-cancel">Annuler</button>
            <button @click="confirmCompleteWithMissing" :disabled="completing" class="btn-confirm-danger">
              {{ completing ? 'Finalisation...' : 'Confirmer la finalisation' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal produit manquant -->
      <div v-if="showMissingModal" class="modal-overlay" @click.self="closeMissingModal">
        <div class="modal-content">
          <h3>Produit manquant</h3>
          <p>{{ currentItem?.name }}</p>
          <div class="modal-options">
            <label class="checkbox-option">
              <input type="checkbox" v-model="outOfStock" />
              Rupture de stock
            </label>
          </div>
          <textarea
            v-model="missingNotes"
            placeholder="Notes (optionnel)..."
            rows="2"
          ></textarea>
          <div class="modal-actions">
            <button @click="closeMissingModal" class="btn-cancel">Annuler</button>
            <button @click="confirmMissing" class="btn-confirm">Confirmer</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../services/api'
import syncService from '../services/sync'
import { ordersDB, orderItemsDB } from '../services/db'
import feedbackService from '../services/feedback'
import { useOrdersStore } from '../stores/orders'
import QRScanner from '../components/QRScanner.vue'

const router = useRouter()
const route = useRoute()
const ordersStore = useOrdersStore()

const order = ref(null)
const loading = ref(true)
const error = ref(null)
const manualSku = ref('')
const feedback = ref(null)
const completing = ref(false)
const holdingOrder = ref(false)
const showMissingModal = ref(false)
const showCompleteConfirm = ref(false)
const outOfStock = ref(false)
const missingNotes = ref('')
const currentItemIndex = ref(0)
const scannerPaused = ref(false)
const successOverlay = ref(null)

// Liste des articles non encore complètement scannés (ni picked ni missing)
// Triés par QR code pour optimiser le parcours dans l'entrepôt
const unpickedItems = computed(() => {
  if (!order.value?.items) return []
  return order.value.items
    .filter(item => !item.is_picked && !item.is_missing)
    .sort((a, b) => (a.qr_code || '').localeCompare(b.qr_code || '', 'fr', { numeric: true, sensitivity: 'base' }))
})

// Article actuel à scanner
const currentItem = computed(() => {
  return unpickedItems.value[currentItemIndex.value] || null
})

const totalItems = computed(() => {
  if (!order.value?.items) return 0
  return order.value.items.reduce((sum, item) => sum + item.quantity, 0)
})

const pickedItems = computed(() => {
  if (!order.value?.items) return 0
  return order.value.items.reduce((sum, item) => sum + (item.picked_quantity || 0), 0)
})

const progressPercentage = computed(() => {
  if (totalItems.value === 0) return 0
  return Math.round((pickedItems.value / totalItems.value) * 100)
})

const allItemsPicked = computed(() => {
  if (!order.value?.items) return false
  return order.value.items.every(item => item.is_picked || item.is_missing)
})

const hasMissingItems = computed(() => {
  if (!order.value?.items) return false
  return order.value.items.some(item => item.is_missing)
})

const missingItemsCount = computed(() => {
  if (!order.value?.items) return 0
  return order.value.items.filter(item => item.is_missing).length
})

const missingItemsList = computed(() => {
  if (!order.value?.items) return []
  return order.value.items.filter(item => item.is_missing)
})

onMounted(async () => {
  await loadOrder()
})

watch(() => route.params.id, async (newId, oldId) => {
  if (newId && newId !== oldId) {
    currentItemIndex.value = 0
    manualSku.value = ''
    feedback.value = null
    await loadOrder()
  }
})

async function loadOrder() {
  loading.value = true
  error.value = null

  try {
    const orderId = parseInt(route.params.id)

    if (syncService.isOnline()) {
      try {
        const response = await api.get(`/orders/${orderId}`)
        order.value = response.data
        await ordersDB.put({ ...response.data, synced: true })
        if (response.data.items) {
          for (const item of response.data.items) {
            await orderItemsDB.put({ ...item, order_id: orderId })
          }
        }

        // Auto-reprendre les commandes en attente pour permettre le scan
        if (order.value.status === 'on-hold') {
          await resumeOnHoldOrder()
        }

        return
      } catch (err) {
        console.warn('Erreur API, tentative de chargement depuis le cache:', err)
      }
    }

    const cachedOrder = await ordersDB.get(orderId)
    if (!cachedOrder) {
      error.value = 'Commande non disponible hors ligne.'
      return
    }

    const cachedItems = await orderItemsDB.where('order_id').equals(orderId).toArray()
    order.value = { ...cachedOrder, items: cachedItems }

    // Auto-reprendre en mode offline aussi
    if (order.value.status === 'on-hold') {
      order.value.status = 'processing'
      // Réinitialiser les articles manquants
      for (const item of order.value.items || []) {
        if (item.is_missing) {
          item.is_missing = false
          item.notes = null
          await orderItemsDB.update(item.id, { is_missing: false, notes: null })
        }
      }
    }

  } catch (err) {
    error.value = err.response?.data?.message || 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
}

async function resumeOnHoldOrder() {
  try {
    // Remettre en processing
    await api.put(`/orders/${order.value.id}/status`, { status: 'processing' })
    order.value.status = 'processing'

    // Réinitialiser tous les articles manquants pour qu'ils soient scannables
    const orderId = order.value.id
    for (const item of order.value.items) {
      if (item.is_missing) {
        item.is_missing = false
        item.notes = null
        await orderItemsDB.update(item.id, { is_missing: false, notes: null })
        // Sync API en arrière-plan
        api.put(`/orders/${orderId}/items/${item.id}/reset-missing`)
          .catch(err => console.warn('Reset missing sync error:', err.message))
      }
    }

    showFeedback('▶️ Commande reprise, scannez les articles', 'success')
  } catch (err) {
    console.warn('Erreur lors de la reprise:', err)
  }
}

function getImageUrl(url) {
  if (!url) return ''
  if (url.startsWith('/api/image-proxy')) {
    return import.meta.env.VITE_API_URL?.replace('/api', '') + url || url
  }
  return url
}

function handleScan(scannedCode) {
  if (!currentItem.value) return

  const extractedSku = scannedCode.startsWith('QR-') ? scannedCode.substring(3) : scannedCode

  if (extractedSku.toUpperCase() === currentItem.value.sku.toUpperCase()) {
    markItemAsPicked(currentItem.value)
  } else {
    feedbackService.error()
    showFeedback(`❌ Mauvais produit ! Attendu: ${currentItem.value.sku}`, 'error')
  }
}

function validateManualSku() {
  if (!manualSku.value.trim() || !currentItem.value) return

  if (manualSku.value.trim().toUpperCase() === currentItem.value.sku.toUpperCase()) {
    markItemAsPicked(currentItem.value)
  } else {
    feedbackService.error()
    showFeedback(`❌ SKU incorrect ! Attendu: ${currentItem.value.sku}`, 'error')
  }
  manualSku.value = ''
}

async function markItemAsPicked(item) {
  try {
    // Pause le scanner immédiatement
    scannerPaused.value = true

    const newPickedQty = (item.picked_quantity || 0) + 1
    const isPicked = newPickedQty >= item.quantity
    const orderId = parseInt(route.params.id)

    item.picked_quantity = newPickedQty
    item.is_picked = isPicked

    await orderItemsDB.update(item.id, {
      picked_quantity: newPickedQty,
      is_picked: isPicked
    })

    await syncService.markItemPicked(orderId, item.id, newPickedQty)

    feedbackService.success()

    // Trouver le prochain article (après que l'item actuel sorte de unpickedItems)
    const remainingItems = order.value.items
      .filter(i => !i.is_picked && !i.is_missing && i.id !== item.id)
      .sort((a, b) => (a.qr_code || '').localeCompare(b.qr_code || '', 'fr', { numeric: true, sensitivity: 'base' }))
    const nextItem = remainingItems[0]

    // Afficher l'overlay de confirmation
    successOverlay.value = {
      productName: item.name,
      nextProduct: isPicked ? (nextItem?.name || null) : item.name
    }

    // Masquer l'overlay et réactiver le scanner après un délai
    const pauseDuration = isPicked ? 1200 : 750 // Plus long si on passe à un autre article
    setTimeout(() => {
      successOverlay.value = null
      scannerPaused.value = false
    }, pauseDuration)

    if (syncService.isOnline()) {
      api.put(`/orders/${orderId}/items/${item.id}/pick`, {
        pickedQuantity: newPickedQty
      }).catch(err => console.warn('Sync API error:', err.message))
    }
  } catch (err) {
    console.error('Erreur markItemAsPicked:', err)
    feedbackService.error()
    showFeedback('❌ Erreur', 'error')
    // Réactiver le scanner en cas d'erreur
    scannerPaused.value = false
    successOverlay.value = null
  }
}

function skipToNext() {
  if (currentItemIndex.value < unpickedItems.value.length - 1) {
    currentItemIndex.value++
  } else {
    currentItemIndex.value = 0
  }
}

function openMissingModal() {
  showMissingModal.value = true
  outOfStock.value = false
  missingNotes.value = ''
}

function closeMissingModal() {
  showMissingModal.value = false
}

async function confirmMissing() {
  if (!currentItem.value) return

  try {
    const item = currentItem.value
    const orderId = parseInt(route.params.id)
    const notes = outOfStock.value ? 'Rupture de stock' : (missingNotes.value || 'Produit manquant')

    item.is_missing = true
    item.notes = notes

    await orderItemsDB.update(item.id, { is_missing: true, notes })
    await syncService.markItemMissing(orderId, item.id, notes)

    feedbackService.warning()
    showFeedback('⚠️ Produit marqué manquant', 'warning')
    closeMissingModal()

    if (syncService.isOnline()) {
      api.put(`/orders/${orderId}/items/${item.id}/missing`, { notes })
        .catch(err => console.warn('Sync API error:', err.message))
    }
  } catch (err) {
    console.error('Erreur confirmMissing:', err)
    showFeedback('❌ Erreur', 'error')
  }
}

function requestCompleteWithMissing() {
  showCompleteConfirm.value = true
}

function cancelCompleteWithMissing() {
  showCompleteConfirm.value = false
}

async function confirmCompleteWithMissing() {
  showCompleteConfirm.value = false
  await completeAndNext()
}

async function completeAndNext() {
  completing.value = true

  try {
    await ordersStore.completeOrder(order.value.id)
    await ordersStore.fetchOrders()

    const nextOrder = ordersStore.pendingOrders[0]

    if (nextOrder) {
      showFeedback('🎉 Commande finalisée !', 'success')
      setTimeout(() => {
        router.push(`/picking/${nextOrder.id}/fast`)
      }, 800)
    } else {
      showFeedback('🎉 Toutes les commandes sont terminées !', 'success')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1000)
    }
  } catch (err) {
    showFeedback('❌ Erreur lors de la finalisation', 'error')
  } finally {
    completing.value = false
  }
}

async function holdOrderAndNext() {
  holdingOrder.value = true

  try {
    await api.put(`/orders/${order.value.id}/hold`)
    await ordersStore.fetchOrders()

    const nextOrder = ordersStore.pendingOrders[0]

    if (nextOrder) {
      showFeedback('⏸️ Commande mise en attente !', 'success')
      setTimeout(() => {
        router.push(`/picking/${nextOrder.id}/fast`)
      }, 800)
    } else {
      showFeedback('⏸️ Commande mise en attente !', 'success')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1000)
    }
  } catch (err) {
    showFeedback('❌ Erreur', 'error')
  } finally {
    holdingOrder.value = false
  }
}

function showFeedback(message, type) {
  feedback.value = { message, type }
  setTimeout(() => {
    feedback.value = null
  }, 2500)
}

function goBack() {
  router.push('/dashboard')
}

function goToFullView() {
  router.push(`/picking/${route.params.id}`)
}
</script>

<style scoped>
.picking-fast-container {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.loading,
.error-message {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
  margin: 1rem;
  border-radius: var(--radius-md);
}

.picking-fast-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 0;
}

/* Header */
.fast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.btn-back {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
}

.order-info {
  text-align: center;
}

.order-number {
  font-weight: 800;
  color: var(--primary);
  display: block;
}

.customer-name {
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.shipping-method-badge {
  font-size: 0.688rem;
  color: var(--primary);
  font-weight: 600;
  background: rgba(12, 180, 212, 0.1);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.progress-badge {
  background: var(--primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 700;
}

/* Global progress */
.global-progress {
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.progress-bar {
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
  display: block;
}

/* Item picking */
.item-picking {
  padding: 1rem;
}

.current-item-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  text-align: center;
  margin-bottom: 1rem;
  border: 2px solid var(--primary);
  box-shadow: 0 4px 20px rgba(12, 180, 212, 0.15);
}

.item-image-large {
  width: 150px;
  height: 150px;
  margin: 0 auto 1rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
}

.item-image-large img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-image-placeholder {
  width: 150px;
  height: 150px;
  margin: 0 auto 1rem;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

.item-details {
  margin-bottom: 1rem;
}

.item-name {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.item-sku {
  font-size: 1rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem;
}

.item-sku strong {
  color: var(--primary);
  font-family: monospace;
  font-size: 1.125rem;
}

.item-location {
  color: var(--success);
  font-weight: 600;
  margin: 0;
}

.quantity-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 1rem;
}

.qty-picked {
  font-size: 3rem;
  font-weight: 800;
  color: var(--primary);
}

.qty-separator {
  font-size: 2rem;
  color: var(--text-tertiary);
}

.qty-total {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-secondary);
}

/* Scanner */
.scanner-section {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1rem;
  margin-bottom: 1rem;
}

.scanner-wrapper {
  margin-bottom: 1rem;
}

.manual-input {
  display: flex;
  gap: 0.5rem;
}

.sku-input {
  flex: 1;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 1rem;
}

.btn-validate {
  padding: 0.875rem 1.5rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
}

/* Quick actions */
.quick-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.btn-missing-quick {
  flex: 1;
  padding: 1rem;
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.938rem;
}

.btn-skip {
  flex: 1;
  padding: 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.938rem;
}

.btn-full-list {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
}

/* Completion screen */
.completion-screen,
.hold-screen {
  padding: 2rem 1rem;
}

.completion-card,
.hold-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  text-align: center;
}

.completion-icon,
.hold-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.completion-card h2,
.hold-card h2 {
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.completion-card p,
.hold-card p {
  color: var(--text-secondary);
  margin: 0 0 2rem;
}

.order-recap {
  text-align: left;
  margin: 1.5rem 0;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  border: 1px solid var(--border);
}

.recap-details {
  margin-bottom: 1rem;
}

.recap-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--border-light);
}

.recap-row:last-child {
  border-bottom: none;
}

.recap-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  flex-shrink: 0;
  margin-right: 0.75rem;
}

.recap-value {
  font-size: 0.813rem;
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
}

.recap-shipping {
  color: var(--primary);
  font-weight: 700;
}

.recap-items {
  border-top: 2px solid var(--border);
  padding-top: 0.75rem;
}

.recap-items-title {
  font-size: 0.813rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.recap-items-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
}

.recap-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--border-light);
}

.recap-item:last-child {
  border-bottom: none;
}

.recap-item-thumb {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-card);
  margin-right: 0.625rem;
}

.recap-item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.recap-item-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.recap-item-name {
  font-size: 0.813rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 0.5rem;
  flex: 1;
}

.recap-item-qty {
  font-size: 0.813rem;
  font-weight: 700;
  color: var(--primary);
  background: rgba(12, 180, 212, 0.1);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.btn-complete-large {
  width: 100%;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.missing-items-recap {
  text-align: left;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-sm);
}

.missing-items-recap ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.missing-items-recap li {
  padding: 0.375rem 0;
  font-size: 0.875rem;
  color: var(--error);
  font-weight: 500;
  border-bottom: 1px solid rgba(239, 68, 68, 0.1);
}

.missing-items-recap li:last-child {
  border-bottom: none;
}

.hold-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-hold-large {
  width: 100%;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
}

.btn-complete-partial {
  width: 100%;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

/* Feedback toast */
.feedback-toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  z-index: 100;
  animation: slideUp 0.3s ease;
}

.feedback-toast.success {
  background: var(--success);
  color: white;
}

.feedback-toast.error {
  background: var(--error);
  color: white;
}

.feedback-toast.warning {
  background: var(--warning);
  color: white;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  width: 100%;
  max-width: 400px;
}

.modal-content h3 {
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.modal-content > p {
  color: var(--text-secondary);
  margin: 0 0 1rem;
  font-size: 0.938rem;
}

.modal-options {
  margin-bottom: 1rem;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.modal-content textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  resize: none;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-cancel {
  flex: 1;
  padding: 0.875rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm {
  flex: 1;
  padding: 0.875rem;
  background: var(--warning);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm-danger {
  flex: 1;
  padding: 0.875rem;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Scanner en pause */
.scanner-paused {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 1rem;
}

/* Overlay de confirmation */
.success-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(34, 197, 94, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.success-content {
  text-align: center;
  color: white;
  padding: 2rem;
}

.success-icon {
  font-size: 5rem;
  margin-bottom: 1rem;
  animation: pop 0.3s ease-out;
}

@keyframes pop {
  0% { transform: scale(0); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.success-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.success-subtitle {
  font-size: 1.125rem;
  opacity: 0.9;
  margin-bottom: 1.5rem;
}

.success-next {
  font-size: 1rem;
  opacity: 0.85;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  display: inline-block;
}

.success-next strong {
  display: block;
  font-size: 1.125rem;
  margin-top: 0.25rem;
}

/* Transition pour l'overlay */
.success-overlay-enter-active,
.success-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.success-overlay-enter-from,
.success-overlay-leave-to {
  opacity: 0;
}
</style>
