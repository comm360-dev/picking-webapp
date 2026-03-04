<template>
  <div class="editor-container">
    <header class="editor-header">
      <button @click="goBack" class="btn-back">Retour</button>
      <div class="header-center">
        <h1>{{ quote?.quote_number || 'Nouveau devis' }}</h1>
        <span class="quote-status-badge" :class="quote?.status">{{ statusLabel(quote?.status) }}</span>
      </div>
      <div class="header-actions">
        <button v-if="isEditable" @click="saveQuote" class="btn-save" :disabled="saving">
          {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading">Chargement du devis...</div>

    <main v-else-if="quote" class="editor-content">
      <!-- Section Client -->
      <section class="editor-section">
        <h2>Client</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Nom complet *</label>
            <input v-model="form.customerName" type="text" placeholder="Nom du client" :disabled="!isEditable" />
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input v-model="form.customerPhone" type="tel" placeholder="06 00 00 00 00" :disabled="!isEditable" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input v-model="form.customerEmail" type="email" placeholder="email@exemple.com" :disabled="!isEditable" />
          </div>
        </div>
      </section>

      <!-- Section Adresse de livraison -->
      <section class="editor-section">
        <h2>Adresse de livraison</h2>
        <div class="form-grid">
          <div class="form-group full-width">
            <label>Adresse</label>
            <input v-model="form.shippingAddress" type="text" placeholder="Rue, numéro..." :disabled="!isEditable" />
          </div>
          <div class="form-group">
            <label>Code postal</label>
            <input v-model="form.shippingPostcode" type="text" placeholder="75001" :disabled="!isEditable" />
          </div>
          <div class="form-group">
            <label>Ville</label>
            <input v-model="form.shippingCity" type="text" placeholder="Paris" :disabled="!isEditable" />
          </div>
          <div class="form-group">
            <label>Pays</label>
            <input v-model="form.shippingCountry" type="text" placeholder="FR" :disabled="!isEditable" />
          </div>
        </div>
      </section>

      <!-- Section Articles -->
      <section class="editor-section">
        <div class="section-header">
          <h2>Articles</h2>
          <div v-if="isEditable" class="add-item-buttons">
            <button @click="showProductSearch = true" class="btn-add">+ Produit du site</button>
            <button @click="addManualItem" class="btn-add btn-add-manual">+ Ligne manuelle</button>
          </div>
        </div>

        <!-- Recherche produit -->
        <div v-if="showProductSearch" class="product-search">
          <div class="search-input-wrapper">
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Rechercher un produit (nom ou SKU)..."
              @input="onSearchInput"
              class="search-input"
            />
            <button @click="showProductSearch = false; searchQuery = ''; searchResults = []" class="btn-close-search">x</button>
          </div>
          <div v-if="searchResults.length" class="search-results">
            <div
              v-for="product in searchResults"
              :key="product.id"
              class="search-result-item"
              @click="addProductItem(product)"
            >
              <span class="result-name">{{ product.name }}</span>
              <span class="result-sku">{{ product.sku }}</span>
              <span class="result-price">{{ formatPrice(product.price) }}</span>
            </div>
          </div>
          <div v-else-if="searchQuery.length >= 2 && !searching" class="search-no-results">
            Aucun produit trouvé
          </div>
        </div>

        <!-- Liste des items -->
        <div v-if="quote.items && quote.items.length" class="items-list">
          <div v-for="(item, index) in quote.items" :key="item.id" class="item-row">
            <div class="item-info">
              <div class="item-name">
                <input
                  v-if="!item.product_id && isEditable"
                  v-model="item.custom_name"
                  type="text"
                  placeholder="Nom de l'article"
                  class="inline-input"
                  @change="updateItemField(item)"
                />
                <span v-else>{{ item.product_name || item.custom_name || 'Article' }}</span>
              </div>
              <div class="item-sku" v-if="item.product_sku || item.custom_sku">
                SKU: {{ item.product_sku || item.custom_sku }}
              </div>
            </div>
            <div class="item-fields">
              <div class="item-field">
                <label>Qté</label>
                <input
                  v-model.number="item.quantity"
                  type="number"
                  min="1"
                  :disabled="!isEditable"
                  class="field-input qty-input"
                  @change="updateItemField(item)"
                />
              </div>
              <div class="item-field">
                <label>Prix unit. TTC</label>
                <input
                  v-model.number="item.unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  :disabled="!isEditable"
                  class="field-input price-input"
                  @change="updateItemField(item)"
                />
              </div>
              <div class="item-field">
                <label>Poids (kg)</label>
                <input
                  v-model.number="item.weight"
                  type="number"
                  step="0.001"
                  min="0"
                  :disabled="!isEditable"
                  class="field-input weight-input"
                  @change="updateItemField(item)"
                />
              </div>
              <div class="item-line-total">
                {{ formatPrice((item.unit_price || 0) * (item.quantity || 0)) }}
              </div>
              <button v-if="isEditable" @click="removeItem(item)" class="btn-remove-item">x</button>
            </div>
          </div>
        </div>
        <div v-else class="no-items">
          Aucun article ajouté
        </div>
      </section>

      <!-- Section Livraison & Remise -->
      <section class="editor-section" v-if="isEditable || quote.shipping_method">
        <h2>Livraison & Remise</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Méthode de livraison</label>
            <select v-model="form.shippingMethod" :disabled="!isEditable" @change="onShippingChange">
              <option value="">-- Sélectionner --</option>
              <option v-for="method in shippingMethods" :key="method.id" :value="method.title">
                {{ method.title }} ({{ formatPrice(method.cost) }})
              </option>
              <option value="custom">Montant personnalisé</option>
            </select>
          </div>
          <div class="form-group">
            <label>Frais de livraison TTC</label>
            <input
              v-model.number="form.shippingCost"
              type="number"
              step="0.01"
              min="0"
              :disabled="!isEditable"
              @change="recalculate"
            />
          </div>
          <div class="form-group">
            <label>Remise</label>
            <div class="discount-row">
              <select v-model="form.discountType" :disabled="!isEditable" @change="recalculate">
                <option :value="null">Aucune</option>
                <option value="percent">%</option>
                <option value="fixed">EUR</option>
              </select>
              <input
                v-if="form.discountType"
                v-model.number="form.discountValue"
                type="number"
                step="0.01"
                min="0"
                :disabled="!isEditable"
                placeholder="Valeur"
                @change="recalculate"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Section Notes -->
      <section class="editor-section">
        <h2>Notes</h2>
        <textarea v-model="form.notes" placeholder="Notes internes..." :disabled="!isEditable" rows="3"></textarea>
      </section>

      <!-- Récapitulatif -->
      <section class="editor-section summary-section">
        <h2>Récapitulatif</h2>
        <div class="summary">
          <div class="summary-row">
            <span>Sous-total TTC</span>
            <span>{{ formatPrice(quote.subtotal) }}</span>
          </div>
          <div v-if="form.discountType && form.discountValue" class="summary-row discount">
            <span>Remise ({{ form.discountType === 'percent' ? form.discountValue + '%' : formatPrice(form.discountValue) }})</span>
            <span>-{{ formatPrice(discountAmount) }}</span>
          </div>
          <div class="summary-row">
            <span>Livraison</span>
            <span>{{ formatPrice(form.shippingCost) }}</span>
          </div>
          <div class="summary-row">
            <span>Poids total</span>
            <span>{{ totalWeight.toFixed(2) }} kg</span>
          </div>
          <div class="summary-row total">
            <span>Total TTC</span>
            <span>{{ formatPrice(quote.total) }}</span>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <section class="editor-actions" v-if="quote.status !== 'converted'">
        <button v-if="quote.status === 'draft'" @click="changeStatus('sent')" class="btn-action btn-send">
          Marquer comme envoyé
        </button>
        <button v-if="quote.status === 'sent'" @click="changeStatus('accepted')" class="btn-action btn-accept">
          Accepter
        </button>
        <button v-if="quote.status === 'sent'" @click="changeStatus('rejected')" class="btn-action btn-reject">
          Refuser
        </button>
        <button v-if="['accepted', 'draft'].includes(quote.status)" @click="convertToOrder" class="btn-action btn-convert" :disabled="converting || !quote.items?.length">
          {{ converting ? 'Conversion...' : 'Convertir en commande' }}
        </button>
      </section>

      <div v-if="quote.status === 'converted' && quote.wc_order_id" class="converted-info">
        Commande WooCommerce créée : #{{ quote.wc_order_id }}
      </div>

      <div v-if="feedback" class="feedback" :class="feedbackType">{{ feedback }}</div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuotesStore } from '../stores/quotes'

const route = useRoute()
const router = useRouter()
const quotesStore = useQuotesStore()

const loading = ref(true)
const saving = ref(false)
const converting = ref(false)
const searching = ref(false)
const showProductSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const searchInput = ref(null)
const feedback = ref('')
const feedbackType = ref('success')

const form = ref({
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  shippingAddress: '',
  shippingCity: '',
  shippingPostcode: '',
  shippingCountry: 'FR',
  shippingMethod: '',
  shippingCost: 0,
  discountType: null,
  discountValue: 0,
  notes: ''
})

const quote = computed(() => quotesStore.currentQuote)
const isEditable = computed(() => quote.value && !['converted', 'rejected'].includes(quote.value.status))
const shippingMethods = computed(() => quotesStore.shippingMethods)

const totalWeight = computed(() => {
  if (!quote.value?.items) return 0
  return quote.value.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0) * (item.quantity || 0), 0)
})

const discountAmount = computed(() => {
  const subtotal = parseFloat(quote.value?.subtotal) || 0
  if (form.value.discountType === 'percent') {
    return subtotal * (form.value.discountValue / 100)
  } else if (form.value.discountType === 'fixed') {
    return form.value.discountValue || 0
  }
  return 0
})

function statusLabel(status) {
  const labels = { draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé', converted: 'Converti' }
  return labels[status] || status || ''
}

function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price || 0)
}

function showFeedback(msg, type = 'success') {
  feedback.value = msg
  feedbackType.value = type
  setTimeout(() => { feedback.value = '' }, 3000)
}

function goBack() {
  router.push('/quotes')
}

function populateForm(q) {
  form.value = {
    customerName: q.customer_name || '',
    customerEmail: q.customer_email || '',
    customerPhone: q.customer_phone || '',
    shippingAddress: q.shipping_address || '',
    shippingCity: q.shipping_city || '',
    shippingPostcode: q.shipping_postcode || '',
    shippingCountry: q.shipping_country || 'FR',
    shippingMethod: q.shipping_method || '',
    shippingCost: parseFloat(q.shipping_cost) || 0,
    discountType: q.discount_type || null,
    discountValue: parseFloat(q.discount_value) || 0,
    notes: q.notes || ''
  }
}

async function saveQuote() {
  saving.value = true
  try {
    await quotesStore.updateQuote(quote.value.id, form.value)
    showFeedback('Devis sauvegardé')
  } catch {
    showFeedback('Erreur lors de la sauvegarde', 'error')
  } finally {
    saving.value = false
  }
}

let searchTimeout = null
function onSearchInput() {
  clearTimeout(searchTimeout)
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  searching.value = true
  searchTimeout = setTimeout(async () => {
    searchResults.value = await quotesStore.searchProducts(searchQuery.value)
    searching.value = false
  }, 300)
}

async function addProductItem(product) {
  await quotesStore.addItem(quote.value.id, {
    productId: product.id,
    customName: product.name,
    customSku: product.sku,
    quantity: 1,
    unitPrice: parseFloat(product.price) || 0,
    weight: parseFloat(product.weight) || 0
  })
  // Recharger le devis pour avoir les items à jour
  await quotesStore.fetchQuote(quote.value.id)
  showProductSearch.value = false
  searchQuery.value = ''
  searchResults.value = []
}

async function addManualItem() {
  await quotesStore.addItem(quote.value.id, {
    customName: 'Nouvel article',
    quantity: 1,
    unitPrice: 0,
    weight: 0
  })
  await quotesStore.fetchQuote(quote.value.id)
}

async function updateItemField(item) {
  await quotesStore.updateItem(quote.value.id, item.id, {
    customName: item.custom_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    weight: item.weight
  })
  await quotesStore.fetchQuote(quote.value.id)
}

async function removeItem(item) {
  await quotesStore.deleteItem(quote.value.id, item.id)
  await quotesStore.fetchQuote(quote.value.id)
}

async function onShippingChange() {
  if (form.value.shippingMethod === 'custom') {
    form.value.shippingMethod = 'Personnalisé'
  } else {
    const method = shippingMethods.value.find(m => m.title === form.value.shippingMethod)
    if (method) {
      form.value.shippingCost = parseFloat(method.cost) || 0
    }
  }
  await recalculate()
}

async function recalculate() {
  await quotesStore.recalculate(quote.value.id, {
    shippingCost: form.value.shippingCost,
    discountType: form.value.discountType,
    discountValue: form.value.discountValue
  })
  await quotesStore.fetchQuote(quote.value.id)
}

async function changeStatus(status) {
  // Sauvegarder d'abord
  await saveQuote()
  await quotesStore.updateStatus(quote.value.id, status)
  await quotesStore.fetchQuote(quote.value.id)
  showFeedback(`Statut mis à jour : ${statusLabel(status)}`)
}

async function convertToOrder() {
  if (!confirm('Convertir ce devis en commande WooCommerce ? Cette action est irréversible.')) return
  converting.value = true
  try {
    // Sauvegarder d'abord
    await saveQuote()
    const result = await quotesStore.convertToOrder(quote.value.id)
    if (result) {
      showFeedback(`Commande #${result.wcOrderNumber} créée sur WooCommerce !`)
      await quotesStore.fetchQuote(quote.value.id)
    } else {
      showFeedback(quotesStore.error || 'Erreur lors de la conversion', 'error')
    }
  } finally {
    converting.value = false
  }
}

watch(showProductSearch, (val) => {
  if (val) {
    nextTick(() => {
      searchInput.value?.focus()
    })
  }
})

onMounted(async () => {
  const id = route.params.id
  await quotesStore.fetchQuote(id)
  if (quote.value) {
    populateForm(quote.value)
  }
  quotesStore.fetchShippingMethods()
  loading.value = false
})
</script>

<style scoped>
.editor-container {
  min-height: 100vh;
  background: var(--bg-primary);
}

.editor-header {
  background: var(--bg-card);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.btn-back {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  font-size: 0.875rem;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-center h1 {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.quote-status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.quote-status-badge.draft { background: rgba(107, 114, 128, 0.15); color: #6b7280; }
.quote-status-badge.sent { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.quote-status-badge.accepted { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.quote-status-badge.rejected { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.quote-status-badge.converted { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }

.btn-save {
  padding: 0.5rem 1.25rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.editor-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
}

.editor-section {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  margin-bottom: 1rem;
  border: 1px solid var(--border);
}

.editor-section h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  margin-bottom: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.813rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
}

textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
  resize: vertical;
}

.add-item-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-add {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-add-manual {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

/* Product search */
.product-search {
  margin-bottom: 1rem;
  position: relative;
}

.search-input-wrapper {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #8b5cf6;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-close-search {
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 700;
  color: var(--text-primary);
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 250px;
  overflow-y: auto;
  z-index: 20;
}

.search-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}

.search-result-item:hover {
  background: rgba(139, 92, 246, 0.08);
}

.search-result-item:last-child {
  border-bottom: none;
}

.result-name {
  font-weight: 600;
  font-size: 0.875rem;
  flex: 1;
}

.result-sku {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0 1rem;
}

.result-price {
  font-weight: 700;
  color: #8b5cf6;
  font-size: 0.875rem;
}

.search-no-results {
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Items list */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  gap: 1rem;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.item-name span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-sku {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 0.125rem;
}

.inline-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 600;
  background: var(--bg-card);
  color: var(--text-primary);
  box-sizing: border-box;
}

.item-fields {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.item-field label {
  display: block;
  font-size: 0.65rem;
  color: var(--text-secondary);
  margin-bottom: 0.125rem;
  text-transform: uppercase;
  font-weight: 600;
}

.field-input {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.813rem;
  background: var(--bg-card);
  color: var(--text-primary);
  text-align: right;
}

.qty-input { width: 55px; }
.price-input { width: 85px; }
.weight-input { width: 75px; }

.item-line-total {
  font-weight: 700;
  font-size: 0.875rem;
  color: #8b5cf6;
  min-width: 80px;
  text-align: right;
}

.btn-remove-item {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-remove-item:hover {
  background: rgba(239, 68, 68, 0.25);
}

.no-items {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Discount */
.discount-row {
  display: flex;
  gap: 0.5rem;
}

.discount-row select {
  width: 100px;
}

.discount-row input {
  flex: 1;
}

/* Summary */
.summary-section {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);
  border-color: rgba(139, 92, 246, 0.2);
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.938rem;
  color: var(--text-primary);
}

.summary-row.discount {
  color: #ef4444;
}

.summary-row.total {
  font-size: 1.25rem;
  font-weight: 700;
  color: #8b5cf6;
  border-top: 2px solid rgba(139, 92, 246, 0.2);
  padding-top: 0.75rem;
  margin-top: 0.25rem;
}

/* Actions */
.editor-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding: 1rem 0;
  flex-wrap: wrap;
}

.btn-action {
  padding: 0.875rem 2rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.938rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-send {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-accept {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.btn-reject {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.btn-convert {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.btn-action:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.converted-info {
  text-align: center;
  padding: 1rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: var(--radius-md);
  color: #16a34a;
  font-weight: 700;
}

.feedback {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.875rem;
  z-index: 100;
  animation: slideUp 0.3s ease;
}

.feedback.success {
  background: #22c55e;
  color: white;
}

.feedback.error {
  background: #ef4444;
  color: white;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (max-width: 768px) {
  .editor-header {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .editor-content {
    padding: 1rem;
  }

  .item-row {
    flex-direction: column;
    align-items: stretch;
  }

  .item-fields {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .add-item-buttons {
    flex-direction: column;
  }

  .editor-actions {
    flex-direction: column;
  }

  .btn-action {
    width: 100%;
  }
}
</style>
