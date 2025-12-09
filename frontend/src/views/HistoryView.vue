<template>
  <div class="history-container">
    <header class="history-header">
      <button @click="router.push('/dashboard')" class="btn-back">← Retour</button>
      <h1>Historique et Statistiques</h1>
    </header>

    <main class="history-content">
      <div class="stats-section">
        <h2>Vos Statistiques</h2>
        <div v-if="loading" class="loading">Chargement...</div>
        <div v-else-if="error" class="error-message">{{ error }}</div>
        <div v-else class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-details">
              <p class="stat-label">Commandes complétées</p>
              <p class="stat-value">{{ statistics.completed_orders || 0 }}</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-details">
              <p class="stat-label">Articles pickés</p>
              <p class="stat-value">{{ statistics.items_picked || 0 }}</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-details">
              <p class="stat-label">Articles manquants</p>
              <p class="stat-value">{{ statistics.items_missing || 0 }}</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-details">
              <p class="stat-label">Taux de réussite</p>
              <p class="stat-value">{{ successRate }}%</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="authStore.isAdmin" class="performance-section">
        <h2>Performance par utilisateur</h2>
        <div v-if="loadingPerformance" class="loading">Chargement...</div>
        <div v-else-if="performance.length === 0" class="empty-state">
          Aucune donnée de performance disponible
        </div>
        <div v-else class="performance-table">
          <table>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Commandes</th>
                <th>Articles pickés</th>
                <th>Manquants</th>
                <th>Durée moyenne</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in performance" :key="user.id">
                <td class="user-cell">
                  <strong>{{ user.first_name }} {{ user.last_name }}</strong>
                  <span class="username">{{ user.email }}</span>
                </td>
                <td>{{ user.completed_orders || 0 }}</td>
                <td>{{ user.items_picked || 0 }}</td>
                <td>{{ user.items_missing || 0 }}</td>
                <td>{{ formatDuration(user.avg_duration) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="history-section">
        <h2>Historique récent</h2>
        <div v-if="loadingHistory" class="loading">Chargement...</div>
        <div v-else-if="history.length === 0" class="empty-state">
          Aucun historique disponible
        </div>
        <div v-else class="history-list">
          <div v-for="item in history" :key="item.id" class="history-item" :class="`action-${item.action}`">
            <div class="history-icon">{{ getActionIcon(item.action) }}</div>
            <div class="history-details">
              <p class="history-action">{{ getActionLabel(item.action) }}</p>
              <p class="history-meta">
                <span v-if="item.order_number">Commande #{{ item.order_number }}</span>
                <span v-if="item.customer_name">{{ item.customer_name }}</span>
                <span v-if="item.details && item.details.productName">{{ item.details.productName }}</span>
              </p>
              <p class="history-date">{{ formatDate(item.created_at) }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const loadingHistory = ref(false)
const loadingPerformance = ref(false)
const error = ref('')
const statistics = ref({})
const history = ref([])
const performance = ref([])

const successRate = computed(() => {
  const picked = statistics.value.items_picked || 0
  const missing = statistics.value.items_missing || 0
  const total = picked + missing
  if (total === 0) return 0
  return Math.round((picked / total) * 100)
})

onMounted(async () => {
  await Promise.all([
    fetchStatistics(),
    fetchHistory(),
    authStore.isAdmin ? fetchPerformance() : Promise.resolve()
  ])
})

async function fetchStatistics() {
  loading.value = true
  error.value = ''
  try {
    const response = await api.get('/history/statistics')
    statistics.value = response.data.statistics
  } catch (err) {
    console.error('Erreur chargement statistiques:', err)
    error.value = 'Impossible de charger les statistiques'
  } finally {
    loading.value = false
  }
}

async function fetchHistory() {
  loadingHistory.value = true
  try {
    const response = await api.get('/history/user?limit=50')
    history.value = response.data.history
  } catch (err) {
    console.error('Erreur chargement historique:', err)
  } finally {
    loadingHistory.value = false
  }
}

async function fetchPerformance() {
  loadingPerformance.value = true
  try {
    const response = await api.get('/history/performance')
    performance.value = response.data.performance
  } catch (err) {
    console.error('Erreur chargement performance:', err)
  } finally {
    loadingPerformance.value = false
  }
}

function getActionIcon(action) {
  const icons = {
    started: '▶️',
    item_picked: '✅',
    item_missing: '❌',
    completed: '🎉'
  }
  return icons[action] || '📝'
}

function getActionLabel(action) {
  const labels = {
    started: 'Picking démarré',
    item_picked: 'Article pické',
    item_missing: 'Article manquant',
    completed: 'Commande complétée'
  }
  return labels[action] || action
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes}min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7) return `Il y a ${days}j`

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(seconds) {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins === 0) return `${secs}s`
  return `${mins}min ${secs}s`
}
</script>

<style scoped>
.history-container {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.history-header {
  background: var(--bg-card);
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.history-header h1 {
  font-size: 1.25rem;
  color: var(--text-primary);
  margin: 0;
  font-weight: 600;
}

.btn-back {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.btn-back:hover {
  background: #3a3a3a;
}

.history-content {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.stats-section,
.performance-section,
.history-section {
  margin-bottom: 2rem;
}

.stats-section h2,
.performance-section h2,
.history-section h2 {
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: var(--bg-card);
  padding: 1.5rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-details {
  flex: 1;
}

.stat-label {
  margin: 0 0 0.25rem 0;
  font-size: 0.813rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--success);
}

.performance-table {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--bg-secondary);
}

th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

td {
  padding: 1rem;
  border-top: 1px solid var(--border);
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.username {
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  background: var(--bg-card);
  padding: 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.history-item.action-started {
  border-left: 3px solid var(--primary);
}

.history-item.action-item_picked {
  border-left: 3px solid var(--success);
}

.history-item.action-item_missing {
  border-left: 3px solid var(--warning);
}

.history-item.action-completed {
  border-left: 3px solid #9c27b0;
}

.history-icon {
  font-size: 1.5rem;
}

.history-details {
  flex: 1;
}

.history-action {
  margin: 0 0 0.25rem 0;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.938rem;
}

.history-meta {
  margin: 0 0 0.25rem 0;
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.history-meta span {
  margin-right: 0.75rem;
}

.history-date {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
  padding: 1rem;
  border-radius: var(--radius-sm);
  text-align: center;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

@media (max-width: 768px) {
  .history-header {
    padding: 1rem;
  }

  .history-header h1 {
    font-size: 1.125rem;
  }

  .history-content {
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .performance-table {
    font-size: 0.875rem;
  }

  th, td {
    padding: 0.75rem 0.5rem;
  }

  .history-item {
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .stat-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
