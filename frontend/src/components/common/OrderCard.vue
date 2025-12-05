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
        Commencer
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

const statusLabel = computed(() => {
  const labels = {
    pending: 'En attente',
    processing: 'En traitement',
    picking: 'En préparation',
    completed: 'Terminée',
    failed: 'Échouée'
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
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid #e0e0e0;
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.order-card.status-pending {
  border-left-color: #ff9800;
}

.order-card.status-processing {
  border-left-color: #2196f3;
}

.order-card.status-picking {
  border-left-color: #9c27b0;
}

.order-card.status-completed {
  border-left-color: #4caf50;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.order-number {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.order-number .label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.order-number .number {
  font-size: 1.25rem;
  font-weight: 700;
  color: #333;
}

.order-status {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: capitalize;
}

.order-status.pending {
  background: #fff3e0;
  color: #e65100;
}

.order-status.processing {
  background: #e3f2fd;
  color: #0d47a1;
}

.order-status.picking {
  background: #f3e5f5;
  color: #4a148c;
}

.order-status.completed {
  background: #e8f5e9;
  color: #1b5e20;
}

.order-customer {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.order-customer strong {
  font-size: 1rem;
  color: #333;
}

.order-customer .email {
  font-size: 0.875rem;
  color: #666;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.order-date {
  color: #666;
}

.order-total {
  font-size: 1.25rem;
  font-weight: 700;
  color: #667eea;
}

.order-actions {
  display: flex;
  gap: 0.75rem;
}

.order-actions button {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-view {
  background: #f5f5f5;
  color: #333;
}

.btn-view:hover {
  background: #e0e0e0;
}

.btn-start {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-start:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

@media (max-width: 480px) {
  .order-card {
    padding: 1rem;
  }

  .order-actions {
    flex-direction: column;
  }
}
</style>
