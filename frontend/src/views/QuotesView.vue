<template>
  <div class="quotes-container">
    <header class="quotes-header">
      <img src="/logo/logo.svg" alt="Retro Car Concept" class="header-logo" />
      <div class="user-info">
        <span>{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
        <span class="role-badge commercial">{{ authStore.user?.role }}</span>
        <button @click="handleLogout" class="btn-logout">Déconnexion</button>
      </div>
    </header>

    <main class="quotes-content">
      <div class="quotes-toolbar">
        <h1>Devis</h1>
        <button @click="createNewQuote" class="btn-new" :disabled="quotesStore.loading">
          + Nouveau devis
        </button>
      </div>

      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span class="tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <div v-if="quotesStore.loading && !filteredQuotes.length" class="loading">
        Chargement...
      </div>

      <div v-else-if="filteredQuotes.length === 0" class="empty-state">
        <p>Aucun devis {{ activeTab === 'all' ? '' : 'dans cette catégorie' }}</p>
      </div>

      <div v-else class="quotes-list">
        <div
          v-for="quote in filteredQuotes"
          :key="quote.id"
          class="quote-card"
          @click="openQuote(quote.id)"
        >
          <div class="quote-card-header">
            <span class="quote-number">{{ quote.quote_number }}</span>
            <span class="quote-status" :class="quote.status">{{ statusLabel(quote.status) }}</span>
          </div>
          <div class="quote-card-body">
            <div class="quote-customer">{{ quote.customer_name || 'Client non renseigné' }}</div>
            <div class="quote-meta">
              <span v-if="quote.customer_phone">{{ quote.customer_phone }}</span>
              <span>{{ formatDate(quote.created_at) }}</span>
            </div>
          </div>
          <div class="quote-card-footer">
            <span class="quote-total">{{ formatPrice(quote.total) }}</span>
            <div class="quote-actions" @click.stop>
              <button v-if="quote.status === 'draft'" @click="deleteQuote(quote)" class="btn-delete-small">Supprimer</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useQuotesStore } from '../stores/quotes'

const router = useRouter()
const authStore = useAuthStore()
const quotesStore = useQuotesStore()

const activeTab = ref('all')

const tabs = computed(() => [
  { key: 'all', label: 'Tous', count: quotesStore.quotes.length },
  { key: 'draft', label: 'Brouillons', count: quotesStore.draftQuotes.length },
  { key: 'sent', label: 'Envoyés', count: quotesStore.sentQuotes.length },
  { key: 'accepted', label: 'Acceptés', count: quotesStore.acceptedQuotes.length },
  { key: 'converted', label: 'Convertis', count: quotesStore.convertedQuotes.length }
])

const filteredQuotes = computed(() => {
  if (activeTab.value === 'all') return quotesStore.quotes
  return quotesStore.quotes.filter(q => q.status === activeTab.value)
})

function statusLabel(status) {
  const labels = { draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé', converted: 'Converti' }
  return labels[status] || status
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price || 0)
}

async function createNewQuote() {
  const quote = await quotesStore.createQuote({
    customerName: 'Nouveau client'
  })
  if (quote) {
    router.push(`/quotes/${quote.id}`)
  }
}

function openQuote(id) {
  router.push(`/quotes/${id}`)
}

async function deleteQuote(quote) {
  if (confirm(`Supprimer le devis ${quote.quote_number} ?`)) {
    await quotesStore.deleteQuote(quote.id)
  }
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

onMounted(() => {
  quotesStore.fetchQuotes()
})
</script>

<style scoped>
.quotes-container {
  min-height: 100vh;
  background: var(--bg-primary);
}

.quotes-header {
  background: var(--bg-card);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
  border-bottom: 1px solid var(--border);
}

.header-logo {
  height: 40px;
  width: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.role-badge.commercial {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: white;
}

.btn-logout {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.813rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-logout:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.quotes-content {
  padding: 1.5rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.quotes-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.quotes-toolbar h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-new {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-new:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.35);
}

.btn-new:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  border-bottom: 2px solid var(--border);
  padding-bottom: 0;
}

.tab {
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  white-space: nowrap;
}

.tab.active {
  color: #8b5cf6;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #8b5cf6;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.tab.active .tab-count {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}

.loading, .empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
  font-size: 1rem;
}

.quotes-list {
  display: grid;
  gap: 1rem;
}

.quote-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--border);
}

.quote-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: #8b5cf6;
}

.quote-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.quote-number {
  font-weight: 700;
  font-size: 0.938rem;
  color: var(--text-primary);
}

.quote-status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.quote-status.draft { background: rgba(107, 114, 128, 0.15); color: #6b7280; }
.quote-status.sent { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.quote-status.accepted { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.quote-status.rejected { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.quote-status.converted { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }

.quote-card-body {
  margin-bottom: 0.75rem;
}

.quote-customer {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.quote-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.quote-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}

.quote-total {
  font-size: 1.125rem;
  font-weight: 700;
  color: #8b5cf6;
}

.btn-delete-small {
  padding: 0.375rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-delete-small:hover {
  background: rgba(239, 68, 68, 0.2);
}

@media (max-width: 768px) {
  .quotes-header {
    padding: 0.75rem 1rem;
    flex-direction: column;
    gap: 0.75rem;
  }

  .quotes-content {
    padding: 1rem;
  }

  .quotes-toolbar {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .tabs {
    gap: 0;
  }

  .tab {
    padding: 0.625rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>
