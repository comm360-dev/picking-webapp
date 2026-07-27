<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <img src="/logo/logo.svg" alt="Retro Car Concept" class="header-logo" />
      <div class="user-info">
        <span>{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
        <span class="role-badge" :class="authStore.user?.role">{{ authStore.user?.role }}</span>
        <button @click="router.push('/history')" class="btn-history">
          📊 Historique
        </button>
        <button v-if="authStore.isAdmin" @click="router.push('/admin/qr')" class="btn-admin">
          ⚙️ Gestion QR
        </button>
        <button @click="handleLogout" class="btn-logout">Déconnexion</button>
      </div>
    </header>

    <main class="dashboard-content">
      <div class="top-section">
        <div class="stats-grid">
          <div class="stat-card">
            <h3>À préparer</h3>
            <p class="stat-number">{{ ordersStore.pendingOrders.length }}</p>
          </div>
          <div class="stat-card">
            <h3>En attente (rupture)</h3>
            <p class="stat-number warning">{{ ordersStore.onHoldOrders.length }}</p>
          </div>
          <div class="stat-card">
            <h3>Terminées</h3>
            <p class="stat-number">{{ ordersStore.completedOrders.length }}</p>
          </div>
        </div>

        <div class="sync-section">
          <button
            @click="handleSync"
            :disabled="ordersStore.syncing"
            class="btn-sync"
          >
            <span v-if="!ordersStore.syncing">🔄 Synchroniser les commandes</span>
            <span v-else>⏳ Synchronisation...</span>
          </button>
          <p v-if="syncMessage" class="sync-message" :class="syncMessageType">
            {{ syncMessage }}
          </p>
        </div>
      </div>

      <div class="orders-section">
        <div class="orders-header">
          <div class="tabs">
            <button
              class="tab"
              :class="{ active: activeTab === 'pending' }"
              @click="activeTab = 'pending'"
            >
              À préparer ({{ ordersStore.pendingOrders.length }})
            </button>
            <button
              class="tab"
              :class="{ active: activeTab === 'on-hold', 'has-items': ordersStore.onHoldOrders.length > 0 }"
              @click="activeTab = 'on-hold'"
            >
              En attente ({{ ordersStore.onHoldOrders.length }})
            </button>
            <button
              class="tab"
              :class="{ active: activeTab === 'completed', 'completed-tab': ordersStore.completedOrders.length > 0 }"
              @click="activeTab = 'completed'"
            >
              Terminées ({{ ordersStore.completedOrders.length }})
            </button>
          </div>
          <div class="sort-filter">
            <label for="sort-order">Trier par date :</label>
            <select id="sort-order" v-model="sortOrder" @change="onSortChange">
              <option value="asc">Croissant (anciennes → récentes)</option>
              <option value="desc">Décroissant (récentes → anciennes)</option>
            </select>
          </div>
        </div>

        <div class="search-bar">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="activeTab === 'pending' ? 'Rechercher par n° commande, nom client...' : 'Rechercher par n° commande, nom client, produit manquant...'"
            class="search-input"
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="btn-clear-search">✕</button>
        </div>

        <div v-if="ordersStore.loading" class="loading">
          Chargement des commandes...
        </div>

        <div v-else-if="ordersStore.error" class="error-message">
          {{ ordersStore.error }}
        </div>

        <div v-else-if="activeTab === 'pending' && ordersStore.pendingOrders.length === 0" class="empty-state">
          <p>Aucune commande à préparer</p>
          <p class="hint">Cliquez sur "Synchroniser les commandes" pour récupérer les commandes</p>
        </div>

        <div v-else-if="activeTab === 'on-hold' && ordersStore.onHoldOrders.length === 0" class="empty-state">
          <p>Aucune commande en attente</p>
          <p class="hint">Les commandes avec des articles en rupture de stock apparaîtront ici</p>
        </div>

        <div v-else-if="activeTab === 'pending' && filteredPendingOrders.length === 0" class="empty-state">
          <p>Aucune commande trouvée pour "{{ searchQuery }}"</p>
          <p class="hint">Essayez un autre terme de recherche</p>
        </div>

        <div v-else-if="activeTab === 'on-hold' && filteredOnHoldOrders.length === 0" class="empty-state">
          <p>Aucune commande trouvée pour "{{ searchQuery }}"</p>
          <p class="hint">Essayez un autre terme de recherche</p>
        </div>

        <div v-else-if="activeTab === 'completed' && ordersStore.completedOrders.length === 0" class="empty-state">
          <p>Aucune commande terminée</p>
          <p class="hint">Les commandes finalisées apparaîtront ici</p>
        </div>

        <div v-else-if="activeTab === 'completed' && filteredCompletedOrders.length === 0" class="empty-state">
          <p>Aucune commande trouvée pour "{{ searchQuery }}"</p>
          <p class="hint">Essayez un autre terme de recherche</p>
        </div>

        <div v-else class="orders-grid">
          <OrderCard
            v-for="order in activeTab === 'pending' ? filteredPendingOrders : activeTab === 'on-hold' ? filteredOnHoldOrders : filteredCompletedOrders"
            :key="order.id"
            :order="order"
            @view="viewOrder"
            @start="startPicking"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script>
// Nom explicite requis pour que <keep-alive include="DashboardView"> cible ce composant
export default { name: 'DashboardView' }
</script>

<script setup>
import { ref, computed, onActivated, onDeactivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useOrdersStore } from '../stores/orders'
import OrderCard from '../components/common/OrderCard.vue'

const router = useRouter()
const authStore = useAuthStore()
const ordersStore = useOrdersStore()

const syncMessage = ref('')
const syncMessageType = ref('')
const sortOrder = ref('asc') // Par défaut : plus anciennes d'abord
const activeTab = ref('pending') // 'pending', 'on-hold' ou 'completed'
const searchQuery = ref('')

// Filtrer les commandes par recherche
const filteredPendingOrders = computed(() => {
  if (!searchQuery.value.trim()) {
    return ordersStore.pendingOrders
  }
  const query = searchQuery.value.toLowerCase().trim()
  return ordersStore.pendingOrders.filter(order => {
    // Recherche par numéro de commande
    if (order.order_number?.toString().toLowerCase().includes(query)) return true
    // Recherche par nom du client
    if (order.customer_name?.toLowerCase().includes(query)) return true
    // Recherche par email du client
    if (order.customer_email?.toLowerCase().includes(query)) return true
    return false
  })
})

const filteredOnHoldOrders = computed(() => {
  if (!searchQuery.value.trim()) {
    return ordersStore.onHoldOrders
  }
  const query = searchQuery.value.toLowerCase().trim()
  return ordersStore.onHoldOrders.filter(order => {
    // Recherche par numéro de commande
    if (order.order_number?.toString().toLowerCase().includes(query)) return true
    // Recherche par nom du client
    if (order.customer_name?.toLowerCase().includes(query)) return true
    // Recherche par email du client
    if (order.customer_email?.toLowerCase().includes(query)) return true
    // Recherche par produit manquant (si items disponibles)
    if (order.items && Array.isArray(order.items)) {
      const hasMissingMatch = order.items.some(item =>
        item.is_missing && item.name?.toLowerCase().includes(query)
      )
      if (hasMissingMatch) return true
    }
    return false
  })
})

const filteredCompletedOrders = computed(() => {
  if (!searchQuery.value.trim()) {
    return ordersStore.completedOrders
  }
  const query = searchQuery.value.toLowerCase().trim()
  return ordersStore.completedOrders.filter(order => {
    if (order.order_number?.toString().toLowerCase().includes(query)) return true
    if (order.customer_name?.toLowerCase().includes(query)) return true
    if (order.customer_email?.toLowerCase().includes(query)) return true
    return false
  })
})

// Position de défilement mémorisée pour la restaurer au retour sur le Dashboard.
const savedScroll = ref(0)

// Mémorise la position de défilement quand on quitte le Dashboard (vers Détails, etc.)
onDeactivated(() => {
  savedScroll.value = window.scrollY
})

// onActivated se déclenche au premier affichage ET à chaque retour sur le Dashboard
// (composant gardé en vie par keep-alive), ce qui garde la liste à jour sans le remonter.
// On restaure la position de défilement après le rechargement des données et le rendu,
// car le keep-alive + la transition de page empêchent le scrollBehavior du routeur d'y arriver.
onActivated(async () => {
  await ordersStore.fetchOrders()
  await nextTick()
  window.scrollTo(0, savedScroll.value)
})

function onSortChange() {
  ordersStore.setSortOrder(sortOrder.value)
}

async function handleSync() {
  syncMessage.value = ''
  const result = await ordersStore.syncOrders()

  if (result.success) {
    syncMessage.value = `✅ ${result.stats.orders} commande(s) synchronisée(s) ${result.stats.mockMode ? '(mode démo)' : ''}`
    syncMessageType.value = 'success'
  } else {
    syncMessage.value = `❌ ${result.error}`
    syncMessageType.value = 'error'
  }

  setTimeout(() => {
    syncMessage.value = ''
  }, 5000)
}

function viewOrder(order) {
  router.push(`/picking/${order.id}`)
}

function startPicking(order) {
  router.push(`/picking/${order.id}/fast`)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dashboard-header {
  background: var(--bg-card);
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(10px);
}

.header-logo {
  height: 40px;
  width: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex-wrap: wrap;
  font-size: 0.938rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.role-badge {
  padding: 0.375rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(12, 180, 212, 0.2);
}

.role-badge.admin {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
}

.role-badge.commercial {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
}

.role-badge.preparateur {
  background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%);
}

.btn-history, .btn-admin, .btn-logout {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.btn-history {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white;
}

.btn-history:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-admin {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%);
  color: white;
}

.btn-admin:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-logout {
  background: linear-gradient(135deg, var(--error) 0%, #DC2626 100%);
  color: white;
}

.btn-logout:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

.dashboard-content {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.top-section {
  margin-bottom: 2.5rem;
  animation: slideUp 0.4s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-card);
  padding: 2rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--transition-base);
}

.stat-card:hover::before {
  transform: scaleX(1);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary-light);
}

.stat-card h3 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-number {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-number.warning {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sync-section {
  text-align: center;
  padding: 2rem;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
}

.btn-sync {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-base);
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 4px 16px rgba(12, 180, 212, 0.3);
}

.btn-sync:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(12, 180, 212, 0.4);
}

.btn-sync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.sync-message {
  margin-top: 1.25rem;
  padding: 1rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.938rem;
  animation: slideUp 0.3s ease;
}

.sync-message.success {
  background: linear-gradient(135deg, rgba(153, 207, 181, 0.15) 0%, rgba(12, 180, 212, 0.1) 100%);
  color: var(--secondary-dark);
  border: 1px solid rgba(153, 207, 181, 0.4);
}

.sync-message.error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%);
  color: var(--error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.orders-section {
  margin-top: 2.5rem;
  animation: slideUp 0.5s ease 0.1s backwards;
}

.orders-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.orders-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: 0.5rem;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab:hover {
  background: var(--bg-card);
  border-color: var(--primary-light);
  color: var(--text-primary);
}

.tab.active {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(12, 180, 212, 0.3);
}

.tab.has-items {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%);
  border-color: rgba(245, 158, 11, 0.5);
  color: var(--warning);
}

.tab.has-items.active {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.tab.completed-tab {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
  border-color: rgba(16, 185, 129, 0.5);
  color: var(--success);
}

.tab.completed-tab.active {
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.sort-filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sort-filter label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.sort-filter select {
  padding: 0.625rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sort-filter select:hover {
  border-color: var(--primary-light);
}

.sort-filter select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(12, 180, 212, 0.1);
}

.search-bar {
  position: relative;
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  padding: 1rem 3rem 1rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 1rem;
  transition: all var(--transition-fast);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-input:hover {
  border-color: var(--primary-light);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(12, 180, 212, 0.1);
}

.btn-clear-search {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-secondary);
  border: none;
  color: var(--text-secondary);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-clear-search:hover {
  background: var(--error);
  color: white;
}

.loading,
.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-secondary);
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}

.empty-state .hint {
  color: var(--text-tertiary);
  font-size: 0.938rem;
  margin-top: 0.75rem;
}

.error-message {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%);
  color: var(--error);
  padding: 1.25rem;
  border-radius: var(--radius-md);
  text-align: center;
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-weight: 500;
}

.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .dashboard-header {
    padding: 1rem;
  }

  .header-logo {
    height: 32px;
    width: 100%;
    max-width: 200px;
  }

  .user-info {
    width: 100%;
    justify-content: space-between;
    font-size: 0.813rem;
  }

  .dashboard-content {
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-number {
    font-size: 1.75rem;
  }

  .btn-sync {
    width: 100%;
    padding: 1rem;
  }

  .orders-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .tabs {
    width: 100%;
  }

  .tab {
    flex: 1;
    padding: 0.625rem 0.75rem;
    font-size: 0.813rem;
    text-align: center;
  }

  .sort-filter {
    width: 100%;
  }

  .sort-filter select {
    flex: 1;
  }

  .orders-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .user-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .user-info > button {
    width: 100%;
  }
}
</style>
