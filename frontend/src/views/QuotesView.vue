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
      <div class="quotes-placeholder">
        <div class="placeholder-icon">📋</div>
        <h2>Module Devis</h2>
        <p>Cette section est en cours de développement.</p>
        <p class="placeholder-detail">Vous pourrez bientôt créer et gérer vos devis clients depuis cette interface.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
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

.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge.commercial {
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
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 80px);
}

.quotes-placeholder {
  text-align: center;
  background: var(--bg-card);
  padding: 3rem;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  max-width: 500px;
  width: 100%;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.quotes-placeholder h2 {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  font-weight: 700;
}

.quotes-placeholder p {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.placeholder-detail {
  font-size: 0.875rem !important;
  color: var(--text-tertiary) !important;
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

  .quotes-placeholder {
    padding: 2rem 1.5rem;
  }
}
</style>
