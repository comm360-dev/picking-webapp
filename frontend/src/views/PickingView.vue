<template>
  <div class="picking-container">
    <header class="picking-header">
      <button @click="goBack" class="btn-back">← Retour</button>
      <h1>Picking - Commande #{{ order?.order_number }}</h1>
    </header>

    <div v-if="loading" class="loading">
      Chargement de la commande...
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <main v-else-if="order" class="picking-content">
      <div class="order-info-card">
        <div class="customer-info">
          <h3>Client</h3>
          <p class="customer-name">{{ order.customer_name }}</p>
          <p class="customer-email">{{ order.customer_email }}</p>
        </div>
        <div class="order-stats">
          <div class="stat">
            <span class="label">Total</span>
            <span class="value">{{ parseFloat(order.total).toFixed(2) }} €</span>
          </div>
          <div class="stat">
            <span class="label">Articles</span>
            <span class="value">{{ totalItems }}</span>
          </div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-header">
          <h3>Progression</h3>
          <span class="progress-text">{{ pickedItems }} / {{ totalItems }} articles</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
      </div>

      <div class="items-section">
        <h3>Articles à préparer</h3>

        <div class="items-list">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="item-card"
            :class="{ 'picked': item.is_picked, 'current': currentItemId === item.id }"
          >
            <div class="item-header">
              <div v-if="item.image_url" class="item-image">
                <img :src="item.image_url" :alt="item.name" />
              </div>
              <div class="item-info">
                <h4>{{ item.name }}</h4>
                <p class="item-sku">SKU: {{ item.sku }}</p>
                <p v-if="item.location" class="item-location">📍 {{ item.location }}</p>
              </div>
              <div class="item-status">
                <span v-if="item.is_picked" class="status-badge picked">✓ Scanné</span>
                <span v-else class="status-badge pending">En attente</span>
              </div>
            </div>

            <div class="item-footer">
              <div class="quantity-info">
                <span class="label">Quantité:</span>
                <span class="quantity">{{ item.picked_quantity || 0 }} / {{ item.quantity }}</span>
              </div>

              <div class="item-actions">
                <button
                  v-if="!item.is_picked && !item.is_missing"
                  @click="selectItem(item)"
                  class="btn-scan"
                  :disabled="currentItemId && currentItemId !== item.id"
                >
                  {{ currentItemId === item.id ? '📷 Scanner maintenant' : 'Sélectionner' }}
                </button>

                <button
                  v-if="!item.is_picked && !item.is_missing"
                  @click="openMissingModal(item)"
                  class="btn-missing"
                  :disabled="currentItemId && currentItemId !== item.id"
                >
                  ⚠️ Manquant
                </button>

                <span v-if="item.is_missing" class="missing-badge">
                  ⚠️ Produit manquant
                </span>
              </div>
            </div>

            <div v-if="item.is_missing && item.notes" class="item-notes">
              <strong>Note:</strong> {{ item.notes }}
            </div>

            <div v-if="currentItemId === item.id" class="scan-section">
              <p class="scan-instruction">Scannez le QR code ou entrez le SKU manuellement</p>

              <QRScanner @scan="handleScan" class="scanner-wrapper" />

              <div class="manual-input">
                <input
                  v-model="manualSku"
                  type="text"
                  placeholder="Entrer le SKU manuellement"
                  @keyup.enter="validateManualSku(item)"
                />
                <button @click="validateManualSku(item)" class="btn-validate">
                  Valider
                </button>
              </div>

              <button @click="cancelScan" class="btn-cancel-scan">
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="allItemsPicked" class="completion-section">
        <div class="completion-card" :class="{ 'partial-completion': hasMissingItems }">
          <h3 v-if="!hasMissingItems">🎉 Tous les articles ont été scannés !</h3>
          <h3 v-else>⚠️ Préparation terminée (avec produits manquants)</h3>

          <p v-if="!hasMissingItems">Vous pouvez maintenant finaliser la commande</p>
          <p v-else>Certains produits sont manquants. La commande sera finalisée comme partiellement préparée.</p>

          <button @click="completeOrder" :disabled="completing" class="btn-complete">
            {{ completing ? 'Finalisation...' : 'Finaliser la commande' }}
          </button>
        </div>
      </div>
    </main>

    <div v-if="feedback" class="feedback-toast" :class="feedback.type">
      {{ feedback.message }}
    </div>

    <!-- Modal pour produit manquant -->
    <div v-if="showMissingModal" class="modal-overlay" @click="closeMissingModal">
      <div class="modal-content" @click.stop>
        <h2>⚠️ Produit manquant</h2>
        <p class="modal-product-name">{{ missingItem?.name }}</p>
        <p class="modal-product-sku">SKU: {{ missingItem?.sku }}</p>

        <div class="form-group">
          <label for="missing-notes">Raison / Note:</label>
          <textarea
            id="missing-notes"
            v-model="missingNotes"
            placeholder="Ex: Rupture de stock, produit endommagé, non trouvé..."
            rows="4"
          ></textarea>
        </div>

        <div class="modal-actions">
          <button @click="closeMissingModal" class="btn-cancel">Annuler</button>
          <button @click="confirmMissing" class="btn-confirm-missing">Confirmer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useOrdersStore } from '../stores/orders'
import api from '../services/api'
import feedbackService from '../services/feedback'
import QRScanner from '../components/QRScanner.vue'
import { ordersDB, orderItemsDB } from '../services/db'
import syncService from '../services/sync'

const router = useRouter()
const route = useRoute()
const ordersStore = useOrdersStore()

const order = ref(null)
const loading = ref(true)
const error = ref(null)
const currentItemId = ref(null)
const manualSku = ref('')
const feedback = ref(null)
const completing = ref(false)
const showMissingModal = ref(false)
const missingItem = ref(null)
const missingNotes = ref('')

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
  // Une commande peut être finalisée si tous les items sont soit scannés, soit marqués comme manquants
  return order.value.items.every(item => item.is_picked || item.is_missing)
})

const hasMissingItems = computed(() => {
  if (!order.value?.items) return false
  return order.value.items.some(item => item.is_missing)
})

onMounted(async () => {
  await loadOrder()
})

async function loadOrder() {
  loading.value = true
  error.value = null

  try {
    const orderId = parseInt(route.params.id)

    // Si online, charger depuis l'API
    if (syncService.isOnline()) {
      try {
        const response = await api.get(`/orders/${orderId}`)
        order.value = response.data

        // LOG: Vérifier les images reçues
        console.log('🖼️ PICKING VIEW - Commande chargée:', response.data.order_number)
        if (response.data.items) {
          response.data.items.forEach(item => {
            console.log(`  Item: ${item.name}`)
            console.log(`    - image_url: ${item.image_url ? 'OUI (' + item.image_url.substring(0, 60) + '...)' : 'NON'}`)
          })
        }

        // Sauvegarder dans le cache
        await ordersDB.put({ ...response.data, synced: true })

        // Sauvegarder les items
        if (response.data.items) {
          for (const item of response.data.items) {
            await orderItemsDB.put({ ...item, order_id: orderId })
          }
        }

        return
      } catch (err) {
        console.warn('Erreur API, tentative de chargement depuis le cache:', err)
      }
    }

    // Si offline ou erreur API, charger depuis le cache
    const cachedOrder = await ordersDB.get(orderId)

    if (!cachedOrder) {
      error.value = 'Commande non disponible hors ligne. Veuillez vous connecter pour la charger.'
      return
    }

    // Charger les items depuis le cache
    const cachedItems = await orderItemsDB.where('order_id').equals(orderId).toArray()

    order.value = {
      ...cachedOrder,
      items: cachedItems
    }

  } catch (err) {
    error.value = err.response?.data?.message || 'Erreur lors du chargement de la commande'
  } finally {
    loading.value = false
  }
}

function selectItem(item) {
  currentItemId.value = item.id
  manualSku.value = ''
}

function cancelScan() {
  currentItemId.value = null
  manualSku.value = ''
}

function handleScan(scannedCode) {
  if (!currentItemId.value) return

  const currentItem = order.value.items.find(item => item.id === currentItemId.value)
  if (!currentItem) return

  // Le QR code peut être au format "QR-SKU123" ou directement "SKU123"
  const extractedSku = scannedCode.startsWith('QR-') ? scannedCode.substring(3) : scannedCode

  if (extractedSku.toUpperCase() === currentItem.sku.toUpperCase()) {
    markItemAsPicked(currentItem)
  } else {
    feedbackService.error()
    showFeedback(`❌ QR Code incorrect ! Attendu: ${currentItem.sku}, Scanné: ${extractedSku}`, 'error')
  }
}

async function validateManualSku(item) {
  if (!manualSku.value.trim()) {
    feedbackService.error()
    showFeedback('Veuillez entrer un SKU', 'error')
    return
  }

  if (manualSku.value.trim().toUpperCase() === item.sku.toUpperCase()) {
    await markItemAsPicked(item)
  } else {
    feedbackService.error()
    showFeedback('❌ SKU incorrect ! Attendu: ' + item.sku, 'error')
  }
}

async function markItemAsPicked(item) {
  try {
    const newPickedQty = (item.picked_quantity || 0) + 1

    await api.put(`/orders/${order.value.id}/items/${item.id}/pick`, {
      pickedQuantity: newPickedQty
    })

    item.picked_quantity = newPickedQty
    item.is_picked = newPickedQty >= item.quantity

    feedbackService.success()
    showFeedback('✅ Article scanné avec succès !', 'success')

    currentItemId.value = null
    manualSku.value = ''

    await loadOrder()
  } catch (err) {
    feedbackService.error()
    showFeedback('❌ Erreur lors de la mise à jour', 'error')
  }
}

async function completeOrder() {
  if (!confirm('Êtes-vous sûr de vouloir finaliser cette commande ?')) {
    return
  }

  completing.value = true

  try {
    await ordersStore.completeOrder(order.value.id)
    showFeedback('🎉 Commande finalisée avec succès !', 'success')

    setTimeout(() => {
      router.push('/dashboard')
    }, 1500)
  } catch (err) {
    showFeedback('❌ Erreur lors de la finalisation', 'error')
  } finally {
    completing.value = false
  }
}

function showFeedback(message, type) {
  feedback.value = { message, type }
  setTimeout(() => {
    feedback.value = null
  }, 3000)
}

function goBack() {
  router.push('/dashboard')
}

function openMissingModal(item) {
  missingItem.value = item
  missingNotes.value = ''
  showMissingModal.value = true
  currentItemId.value = null
}

function closeMissingModal() {
  showMissingModal.value = false
  missingItem.value = null
  missingNotes.value = ''
}

async function confirmMissing() {
  if (!missingItem.value) return

  try {
    await api.put(`/orders/${order.value.id}/items/${missingItem.value.id}/missing`, {
      notes: missingNotes.value || 'Produit manquant'
    })

    missingItem.value.is_missing = true
    missingItem.value.notes = missingNotes.value || 'Produit manquant'

    showFeedback('⚠️ Produit marqué comme manquant', 'error')
    closeMissingModal()
    await loadOrder()
  } catch (err) {
    showFeedback('❌ Erreur lors de la mise à jour', 'error')
  }
}
</script>

<style scoped>
/* === BASE === */
.picking-container {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding-bottom: 1rem;
}

/* === HEADER === */
.picking-header {
  background: var(--bg-card);
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.btn-back {
  padding: 0.75rem 1.25rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 700;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-back:hover {
  background: var(--bg-card);
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.picking-header h1 {
  font-size: 1.25rem;
  margin: 0;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* === LOADING/ERROR === */
.loading,
.error-message {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
  margin: 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* === MAIN CONTENT === */
.picking-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

/* === ORDER INFO CARD === */
.order-info-card {
  background: var(--bg-card);
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  margin-bottom: 1rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: start;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  animation: slideUp 0.4s ease;
}

.order-info-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.customer-info h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.customer-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.customer-email {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.875rem;
}

.order-stats {
  display: flex;
  gap: 1.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat .label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat .value {
  font-size: 1.25rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* === PROGRESS === */
.progress-section {
  background: var(--bg-card);
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  margin-bottom: 1rem;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  animation: slideUp 0.5s ease;
}

.progress-section:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.938rem;
  font-weight: 600;
}

.progress-text {
  font-weight: 600;
  color: var(--success);
  font-size: 0.875rem;
}

.progress-bar {
  height: 12px;
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--success) 0%, #059669 100%);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* === ITEMS SECTION === */
.items-section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 0.938rem;
  font-weight: 600;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* === ITEM CARD === */
.item-card {
  background: var(--bg-card);
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  border-left: 4px solid var(--border);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
  animation: slideUp 0.6s ease;
  position: relative;
  overflow: hidden;
}

.item-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary) 0%, var(--accent-purple) 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--transition-base);
}

.item-card:hover::before {
  transform: scaleX(1);
}

.item-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.item-card.picked {
  border-left-color: var(--success);
  opacity: 0.7;
  background: linear-gradient(to right, rgba(16, 185, 129, 0.05) 0%, var(--bg-card) 100%);
}

.item-card.current {
  border-left-color: var(--primary);
  border-color: var(--primary-light);
  background: linear-gradient(to right, rgba(99, 102, 241, 0.05) 0%, var(--bg-card) 100%);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.item-image {
  flex-shrink: 0;
  width: 90px;
  height: 90px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border-light);
  transition: all var(--transition-base);
}

.item-image:hover {
  transform: scale(1.05);
  border-color: var(--primary-light);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-base);
}

.item-image:hover img {
  transform: scale(1.1);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-info h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 0.938rem;
  font-weight: 600;
}

.item-sku {
  color: var(--text-secondary);
  font-size: 0.813rem;
  margin: 0.25rem 0;
  font-family: monospace;
}

.item-location {
  color: var(--primary);
  font-size: 0.813rem;
  margin: 0.25rem 0;
  font-weight: 600;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
  transition: all var(--transition-fast);
}

.status-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.status-badge.picked {
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
}

.status-badge.pending {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.quantity-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.quantity-info .label {
  color: var(--text-secondary);
  font-size: 0.813rem;
}

.quantity-info .quantity {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--success);
}

/* === ITEM ACTIONS === */
.item-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.item-actions button {
  padding: 0.625rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 0.813rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-scan {
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-scan:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.btn-scan:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-missing {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-missing:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
}

.btn-missing:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.missing-badge {
  padding: 0.625rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.813rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.item-notes {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-card);
  border-left: 3px solid var(--warning);
  border-radius: 8px;
  font-size: 0.813rem;
  color: var(--text-primary);
}

.item-notes strong {
  color: var(--warning);
}

/* === SCAN SECTION === */
.scan-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.scan-instruction {
  color: var(--primary);
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.875rem;
}

.scanner-wrapper {
  margin-bottom: 1rem;
}

.manual-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.manual-input input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 0.938rem;
}

.manual-input input:focus {
  outline: none;
  border-color: var(--primary);
}

.btn-validate {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transition: all var(--transition-fast);
}

.btn-validate:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.btn-cancel-scan {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 700;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all var(--transition-fast);
}

.btn-cancel-scan:hover {
  background: var(--bg-card);
  border-color: var(--error);
  color: var(--error);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

/* === COMPLETION === */
.completion-section {
  margin-top: 1.5rem;
}

.completion-card {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
  color: var(--text-primary);
  padding: 2rem;
  border-radius: var(--radius-lg);
  text-align: center;
  border: 2px solid rgba(16, 185, 129, 0.3);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.15);
  animation: slideUp 0.5s ease, pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.completion-card.partial-completion {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%);
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.15);
}

.completion-card h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.completion-card.partial-completion h3 {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.completion-card p {
  margin: 0 0 1.5rem 0;
  color: var(--text-secondary);
  font-size: 0.938rem;
  line-height: 1.6;
}

.btn-complete {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: all var(--transition-base);
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn-complete:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

.btn-complete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* === FEEDBACK TOAST === */
.feedback-toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  animation: slideUp 0.3s ease;
  max-width: 90%;
  text-align: center;
  font-size: 0.938rem;
  letter-spacing: 0.3px;
}

.feedback-toast.success {
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

.feedback-toast.error {
  background: linear-gradient(135deg, var(--error) 0%, #DC2626 100%);
  color: white;
  box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
}

/* === MODAL === */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-card);
  padding: 2rem;
  border-radius: var(--radius-lg);
  max-width: 500px;
  width: 100%;
  border: 1px solid var(--border);
  animation: slideUp 0.3s ease;
  box-shadow: var(--shadow-lg);
}

.modal-content h2 {
  margin: 0 0 1rem 0;
  color: var(--warning);
  font-size: 1.125rem;
}

.modal-product-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.5rem 0;
  color: var(--text-primary);
}

.modal-product-sku {
  font-size: 0.813rem;
  color: var(--text-secondary);
  font-family: monospace;
  margin: 0 0 1rem 0;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 0.938rem;
  resize: vertical;
}

.form-group textarea:focus {
  outline: none;
  border-color: var(--warning);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.btn-cancel:hover {
  background: var(--bg-card);
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.btn-confirm-missing {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  transition: all var(--transition-fast);
}

.btn-confirm-missing:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
}

/* === ANIMATIONS === */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translate(-50%, 20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* === RESPONSIVE === */
@media (max-width: 768px) {
  .picking-header h1 {
    font-size: 1rem;
    flex: 1;
  }

  .order-info-card {
    grid-template-columns: 1fr;
  }

  .order-stats {
    justify-content: space-between;
    width: 100%;
  }

  .stat {
    align-items: flex-start;
  }

  .item-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .item-actions {
    width: 100%;
  }

  .item-actions button {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .picking-header {
    padding: 0.75rem;
  }

  .btn-back {
    padding: 0.5rem 0.75rem;
    font-size: 0.813rem;
  }

  .picking-content {
    padding: 0.75rem;
  }

  .order-info-card,
  .progress-section,
  .item-card {
    padding: 0.875rem;
  }

  .item-actions {
    flex-direction: column;
  }

  .item-actions button {
    width: 100%;
  }

  .manual-input {
    flex-direction: column;
  }

  .modal-actions {
    flex-direction: column;
  }

  .modal-actions button {
    width: 100%;
  }
}
</style>
