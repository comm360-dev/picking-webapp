<template>
  <div class="order-card" :class="`status-${order.status}`">
    <div class="order-header">
      <div class="order-number">
        <span class="label">Commande</span>
        <span class="number">#{{ order.order_number }}</span>
      </div>
      <div class="order-status" :class="order.status">
        {{ statusLabel }}
      </div>
    </div>

    <div class="order-customer">
      <strong>{{ order.customer_name }}</strong>
      <span class="email">{{ order.customer_email }}</span>
    </div>

    <div v-if="order.shipping_method" class="order-shipping">
      <span class="shipping-badge">🚚 {{ order.shipping_method }}</span>
    </div>

    <div v-if="missingItems.length > 0" class="missing-items-section">
      <div class="missing-items-header">⚠️ Articles manquants ({{ missingItems.length }})</div>
      <ul class="missing-items-list">
        <li v-for="item in missingItems" :key="item.id" class="missing-item">
          <span class="missing-item-name">{{ item.name }}</span>
          <span class="missing-item-qty">x{{ item.quantity }}</span>
        </li>
      </ul>
    </div>

    <div class="order-footer">
      <div class="order-date">
        {{ formatDate(order.order_date) }}
      </div>
      <div class="order-total">
        {{ parseFloat(order.total).toFixed(2) }} €
      </div>
    </div>

    <div class="order-actions">
      <button @click="$emit('view', order)" class="btn-view">
        Détails
      </button>
      <button
        v-if="order.status !== 'completed'"
        @click="$emit('start', order)"
        class="btn-start"
      >
        {{ order.status === 'on-hold' ? 'Reprendre' : 'Commencer' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  order: {
    type: Object,
    required: true
  }
})

defineEmits(['view', 'start'])

const missingItems = computed(() => {
  if (!props.order.items || !Array.isArray(props.order.items)) return []
  return props.order.items.filter(item => item.is_missing)
})

const statusLabel = computed(() => {
  const labels = {
    pending: 'En attente',
    processing: 'En traitement',
    picking: 'En préparation',
    completed: 'Terminée',
    failed: 'Échouée',
    'on-hold': 'En attente'
  }
  return labels[props.order.status] || props.order.status
})

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.order-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border);
  transition: all var(--transition-base);
  border-left: 4px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
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

.order-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--transition-base);
}

.order-card:hover::before {
  transform: scaleX(1);
}

.order-card:hover {
  border-color: var(--primary-light);
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
}

.order-card.status-pending {
  border-left-color: var(--warning);
}

.order-card.status-processing {
  border-left-color: var(--primary);
}

.order-card.status-picking {
  border-left-color: var(--primary);
}

.order-card.status-completed {
  border-left-color: var(--success);
}

.order-card.status-on-hold {
  border-left-color: var(--warning);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 0.75rem;
}

.order-number {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.order-number .label {
  font-size: 0.688rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
}

.order-number .number {
  font-size: 1.25rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.order-status {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(12, 180, 212, 0.15);
}

.order-status.pending {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
}

.order-status.processing {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%);
  color: white;
}

.order-status.picking {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white;
}

.order-status.completed {
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
}

.order-status.on-hold {
  background: linear-gradient(135deg, var(--warning) 0%, #F97316 100%);
  color: white;
}

.order-customer {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-light);
}

.order-customer strong {
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.order-customer .email {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.order-shipping {
  margin-bottom: 1rem;
}

.shipping-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  background: rgba(12, 180, 212, 0.1);
  color: var(--primary);
  border-radius: var(--radius-sm);
  font-size: 0.813rem;
  font-weight: 600;
  border: 1px solid rgba(12, 180, 212, 0.2);
}

.missing-items-section {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-sm);
}

.missing-items-header {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--error);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.missing-items-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.missing-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.5rem;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 4px;
}

.missing-item-name {
  font-size: 0.813rem;
  color: var(--text-primary);
  font-weight: 500;
}

.missing-item-qty {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--error);
  background: rgba(239, 68, 68, 0.1);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
}

.order-date {
  color: var(--text-secondary);
  font-weight: 500;
}

.order-total {
  font-size: 1.25rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.order-actions {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 0.75rem;
}

.order-actions button {
  padding: 0.875rem;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 0.813rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn-view {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-view:hover {
  background: var(--bg-card);
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.btn-start {
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

@media (max-width: 768px) {
  .order-card {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .order-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .order-status {
    align-self: flex-start;
  }

  .order-actions {
    grid-template-columns: 1fr;
  }
}
</style>
