<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Dashboard - Picking WebApp</h1>
      <div class="user-info">
        <span>{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
        <span class="role-badge" :class="authStore.user?.role">{{ authStore.user?.role }}</span>
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
            <h3>Commandes en attente</h3>
            <p class="stat-number">{{ ordersStore.pendingOrders.length }}</p>
          </div>
          <div class="stat-card">
            <h3>Commandes traitées</h3>
            <p class="stat-number">{{ ordersStore.completedOrders.length }}</p>
          </div>
          <div class="stat-card">
            <h3>Total commandes</h3>
            <p class="stat-number">{{ ordersStore.ordersCount }}</p>
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
        <h2>Commandes disponibles</h2>

        <div v-if="ordersStore.loading" class="loading">
          Chargement des commandes...
        </div>

        <div v-else-if="ordersStore.error" class="error-message">
          {{ ordersStore.error }}
        </div>

        <div v-else-if="ordersStore.orders.length === 0" class="empty-state">
          <p>Aucune commande disponible</p>
          <p class="hint">Cliquez sur "Synchroniser les commandes" pour récupérer les commandes</p>
        </div>

        <div v-else class="orders-grid">
          <OrderCard
            v-for="order in ordersStore.pendingOrders"
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

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useOrdersStore } from '../stores/orders'
import OrderCard from '../components/common/OrderCard.vue'

const router = useRouter()
const authStore = useAuthStore()
const ordersStore = useOrdersStore()

const syncMessage = ref('')
const syncMessageType = ref('')

onMounted(async () => {
  await ordersStore.fetchOrders()
})

async function handleSync() {
  syncMessage.value = ''
  const result = await ordersStore.syncOrders()

  if (result.success) {
    syncMessage.value = `✅ ${result.stats.orders} commandes et ${result.stats.products} produits synchronisés ${result.stats.mockMode ? '(mode démo)' : ''}`
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
  router.push(`/picking/${order.id}`)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.dashboard-header {
  background: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  color: #667eea;
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.role-badge.admin {
  background: #ffeaa7;
  color: #d63031;
}

.role-badge.preparateur {
  background: #dfe6e9;
  color: #2d3436;
}

.btn-admin {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-admin:hover {
  background: #5568d3;
}

.btn-logout {
  padding: 0.5rem 1rem;
  background: #ff7675;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-logout:hover {
  background: #d63031;
}

.dashboard-content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  text-align: center;
}

.welcome-card h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
}

.welcome-card p {
  margin: 0;
  opacity: 0.9;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.stat-number {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 700;
  color: #667eea;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.action-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  text-align: center;
}

.action-card:not(:disabled):hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.action-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
}

.action-card p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.top-section {
  margin-bottom: 2rem;
}

.sync-section {
  margin-top: 1.5rem;
  text-align: center;
}

.btn-sync {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-sync:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.btn-sync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 500;
}

.sync-message.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.sync-message.error {
  background: #ffebee;
  color: #c62828;
}

.orders-section {
  margin-top: 2rem;
}

.orders-section h2 {
  margin-bottom: 1.5rem;
  color: #333;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.empty-state .hint {
  color: #999;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .dashboard-content {
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .orders-grid {
    grid-template-columns: 1fr;
  }
}
</style>
