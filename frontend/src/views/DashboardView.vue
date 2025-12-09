<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Dashboard - Picking WebApp</h1>
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

.dashboard-header h1 {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin: 0;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
}

.role-badge.admin {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
}

.role-badge.preparateur {
  background: linear-gradient(135deg, var(--accent-purple) 0%, var(--primary) 100%);
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
  background: linear-gradient(135deg, var(--accent-purple) 0%, var(--secondary) 100%);
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
  background: linear-gradient(90deg, var(--primary) 0%, var(--accent-purple) 100%);
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
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
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
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-base);
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn-sync:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
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
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.3);
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

.orders-section h2 {
  margin-bottom: 1.5rem;
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 700;
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

  .dashboard-header h1 {
    font-size: 1.125rem;
    width: 100%;
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
