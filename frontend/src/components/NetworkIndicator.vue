<template>
  <Transition name="slide">
    <div v-if="showIndicator" class="network-indicator" :class="indicatorClass">
      <div class="indicator-content">
        <span class="indicator-icon">{{ icon }}</span>
        <span class="indicator-text">{{ message }}</span>
        <span v-if="syncCount > 0" class="sync-count">{{ syncCount }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import syncService from '../services/sync'

const isOnline = ref(navigator.onLine)
const isSyncing = ref(false)
const syncCount = ref(0)
const showIndicator = ref(false)
const hideTimeout = ref(null)

const indicatorClass = computed(() => {
  if (isSyncing.value) return 'syncing'
  if (!isOnline.value) return 'offline'
  return 'online'
})

const icon = computed(() => {
  if (isSyncing.value) return '🔄'
  if (!isOnline.value) return '📡'
  return '✓'
})

const message = computed(() => {
  if (isSyncing.value) return `Synchronisation...`
  if (!isOnline.value) return 'Hors ligne - Les actions seront synchronisées plus tard'
  return 'En ligne'
})

let unsubscribeOnline = null
let unsubscribeSync = null

onMounted(() => {
  // Afficher l'indicateur initialement si offline
  if (!isOnline.value) {
    showIndicator.value = true
  }

  // Écouter les changements de statut réseau
  unsubscribeOnline = syncService.onOnlineStatusChange((status) => {
    isOnline.value = status
    showIndicator.value = true

    // Masquer après 3 secondes si online
    if (status) {
      clearTimeout(hideTimeout.value)
      hideTimeout.value = setTimeout(() => {
        if (!isSyncing.value) {
          showIndicator.value = false
        }
      }, 3000)
    }
  })

  // Écouter les changements de statut de sync
  unsubscribeSync = syncService.onSyncStatusChange((status, count) => {
    if (status === 'syncing') {
      isSyncing.value = true
      syncCount.value = count
      showIndicator.value = true
    } else if (status === 'completed') {
      isSyncing.value = false
      syncCount.value = 0

      // Masquer après 2 secondes
      clearTimeout(hideTimeout.value)
      hideTimeout.value = setTimeout(() => {
        showIndicator.value = false
      }, 2000)
    } else if (status === 'error') {
      isSyncing.value = false
      syncCount.value = 0
    }
  })
})

onUnmounted(() => {
  if (unsubscribeOnline) unsubscribeOnline()
  if (unsubscribeSync) unsubscribeSync()
  clearTimeout(hideTimeout.value)
})
</script>

<style scoped>
.network-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 1rem 1.5rem;
  text-align: center;
  font-size: 0.938rem;
  font-weight: 700;
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-base);
  backdrop-filter: blur(10px);
  letter-spacing: 0.3px;
}

.network-indicator.offline {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
}

.network-indicator.online {
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
}

.network-indicator.syncing {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
}

.indicator-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.indicator-icon {
  font-size: 1rem;
  animation: pulse 2s infinite;
}

.syncing .indicator-icon {
  animation: spin 1s linear infinite;
}

.sync-count {
  background: rgba(255, 255, 255, 0.25);
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from {
  transform: translateY(-100%);
}

.slide-leave-to {
  transform: translateY(-100%);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
