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

              <button
                v-if="!item.is_picked"
                @click="selectItem(item)"
                class="btn-scan"
                :disabled="currentItemId && currentItemId !== item.id"
              >
                {{ currentItemId === item.id ? '📷 Scanner maintenant' : 'Sélectionner' }}
              </button>
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
        <div class="completion-card">
          <h3>🎉 Tous les articles ont été scannés !</h3>
          <p>Vous pouvez maintenant finaliser la commande</p>
          <button @click="completeOrder" :disabled="completing" class="btn-complete">
            {{ completing ? 'Finalisation...' : 'Finaliser la commande' }}
          </button>
        </div>
      </div>
    </main>

    <div v-if="feedback" class="feedback-toast" :class="feedback.type">
      {{ feedback.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useOrdersStore } from '../stores/orders'
import api from '../services/api'
import QRScanner from '../components/QRScanner.vue'

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
  return order.value.items.every(item => item.is_picked)
})

onMounted(async () => {
  await loadOrder()
})

async function loadOrder() {
  loading.value = true
  error.value = null

  try {
    const orderId = route.params.id
    const response = await api.get(`/orders/${orderId}`)
    order.value = response.data
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
    showFeedback(`❌ QR Code incorrect ! Attendu: ${currentItem.sku}, Scanné: ${extractedSku}`, 'error')
  }
}

async function validateManualSku(item) {
  if (!manualSku.value.trim()) {
    showFeedback('Veuillez entrer un SKU', 'error')
    return
  }

  if (manualSku.value.trim().toUpperCase() === item.sku.toUpperCase()) {
    await markItemAsPicked(item)
  } else {
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

    showFeedback('✅ Article scanné avec succès !', 'success')

    currentItemId.value = null
    manualSku.value = ''

    await loadOrder()
  } catch (err) {
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
</script>

<style scoped>
.picking-container {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 2rem;
}

.picking-header {
  background: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  padding: 0.5rem 1rem;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-back:hover {
  background: #e0e0e0;
}

.picking-header h1 {
  font-size: 1.5rem;
  color: #333;
  margin: 0;
}

.loading,
.error-message {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  margin: 2rem;
  border-radius: 8px;
}

.picking-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.order-info-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.customer-info h3 {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
}

.customer-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.customer-email {
  color: #666;
  margin: 0.25rem 0 0 0;
}

.order-stats {
  display: flex;
  gap: 2rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat .label {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.stat .value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
}

.progress-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-header h3 {
  margin: 0;
  color: #333;
}

.progress-text {
  font-weight: 600;
  color: #667eea;
}

.progress-bar {
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.items-section h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.item-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #e0e0e0;
  transition: all 0.3s;
}

.item-card.picked {
  border-left-color: #4caf50;
  opacity: 0.7;
}

.item-card.current {
  border-left-color: #667eea;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.item-info h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.item-sku {
  color: #666;
  font-size: 0.875rem;
  margin: 0.25rem 0;
  font-family: monospace;
}

.item-location {
  color: #667eea;
  font-size: 0.875rem;
  margin: 0.25rem 0;
  font-weight: 600;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-badge.picked {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.pending {
  background: #fff3e0;
  color: #e65100;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quantity-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.quantity-info .label {
  color: #666;
  font-size: 0.875rem;
}

.quantity-info .quantity {
  font-size: 1.25rem;
  font-weight: 700;
  color: #667eea;
}

.btn-scan {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-scan:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-scan:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scan-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px dashed #e0e0e0;
}

.scan-instruction {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
}

.scanner-wrapper {
  margin-bottom: 1.5rem;
}

.manual-input {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.manual-input input {
  flex: 1;
  padding: 0.875rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
}

.manual-input input:focus {
  outline: none;
  border-color: #667eea;
}

.btn-validate {
  padding: 0.875rem 1.5rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel-scan {
  width: 100%;
  padding: 0.75rem;
  background: #f0f0f0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.completion-section {
  margin-top: 2rem;
}

.completion-card {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
}

.completion-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.completion-card p {
  margin: 0 0 1.5rem 0;
  opacity: 0.9;
}

.btn-complete {
  padding: 1rem 2rem;
  background: white;
  color: #4caf50;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-complete:hover:not(:disabled) {
  transform: scale(1.05);
}

.btn-complete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.feedback-toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

.feedback-toast.success {
  background: #4caf50;
  color: white;
}

.feedback-toast.error {
  background: #f44336;
  color: white;
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

@media (max-width: 768px) {
  .picking-content {
    padding: 1rem;
  }

  .order-info-card {
    flex-direction: column;
    gap: 1rem;
  }

  .order-stats {
    width: 100%;
    justify-content: space-around;
  }
}
</style>
