import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

export const useQuotesStore = defineStore('quotes', () => {
  const quotes = ref([])
  const currentQuote = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const shippingMethods = ref([])

  const draftQuotes = computed(() => quotes.value.filter(q => q.status === 'draft'))
  const sentQuotes = computed(() => quotes.value.filter(q => q.status === 'sent'))
  const acceptedQuotes = computed(() => quotes.value.filter(q => q.status === 'accepted'))
  const convertedQuotes = computed(() => quotes.value.filter(q => q.status === 'converted'))
  const rejectedQuotes = computed(() => quotes.value.filter(q => q.status === 'rejected'))

  async function fetchQuotes() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/quotes')
      quotes.value = response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors du chargement des devis'
      console.error('fetchQuotes error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchQuote(id) {
    loading.value = true
    error.value = null
    try {
      const response = await api.get(`/quotes/${id}`)
      currentQuote.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors du chargement du devis'
      console.error('fetchQuote error:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createQuote(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.post('/quotes', data)
      quotes.value.unshift(response.data)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la création'
      console.error('createQuote error:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateQuote(id, data) {
    error.value = null
    try {
      const response = await api.put(`/quotes/${id}`, data)
      const index = quotes.value.findIndex(q => q.id === id)
      if (index !== -1) quotes.value[index] = response.data
      if (currentQuote.value?.id === id) {
        currentQuote.value = { ...currentQuote.value, ...response.data }
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la mise à jour'
      console.error('updateQuote error:', err)
      return null
    }
  }

  async function deleteQuote(id) {
    error.value = null
    try {
      await api.delete(`/quotes/${id}`)
      quotes.value = quotes.value.filter(q => q.id !== id)
      return true
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la suppression'
      console.error('deleteQuote error:', err)
      return false
    }
  }

  async function updateStatus(id, status) {
    error.value = null
    try {
      const response = await api.put(`/quotes/${id}/status`, { status })
      const index = quotes.value.findIndex(q => q.id === id)
      if (index !== -1) quotes.value[index] = response.data
      if (currentQuote.value?.id === id) {
        currentQuote.value = { ...currentQuote.value, ...response.data }
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur'
      return null
    }
  }

  async function addItem(quoteId, itemData) {
    error.value = null
    try {
      const response = await api.post(`/quotes/${quoteId}/items`, itemData)
      if (currentQuote.value?.id === quoteId) {
        currentQuote.value = { ...currentQuote.value, ...response.data.quote }
        if (!currentQuote.value.items) currentQuote.value.items = []
        currentQuote.value.items.push(response.data.item)
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de l\'ajout'
      return null
    }
  }

  async function updateItem(quoteId, itemId, itemData) {
    error.value = null
    try {
      const response = await api.put(`/quotes/${quoteId}/items/${itemId}`, itemData)
      if (currentQuote.value?.id === quoteId && currentQuote.value.items) {
        const index = currentQuote.value.items.findIndex(i => i.id === itemId)
        if (index !== -1) currentQuote.value.items[index] = response.data.item
        Object.assign(currentQuote.value, response.data.quote)
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur'
      return null
    }
  }

  async function deleteItem(quoteId, itemId) {
    error.value = null
    try {
      const response = await api.delete(`/quotes/${quoteId}/items/${itemId}`)
      if (currentQuote.value?.id === quoteId && currentQuote.value.items) {
        currentQuote.value.items = currentQuote.value.items.filter(i => i.id !== itemId)
        Object.assign(currentQuote.value, response.data.quote)
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur'
      return null
    }
  }

  async function recalculate(quoteId, data = {}) {
    error.value = null
    try {
      const response = await api.post(`/quotes/${quoteId}/recalculate`, data)
      if (currentQuote.value?.id === quoteId) {
        Object.assign(currentQuote.value, response.data)
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur'
      return null
    }
  }

  async function convertToOrder(quoteId) {
    loading.value = true
    error.value = null
    try {
      const response = await api.post(`/quotes/${quoteId}/convert`)
      if (currentQuote.value?.id === quoteId) {
        currentQuote.value = response.data.quote
      }
      const index = quotes.value.findIndex(q => q.id === quoteId)
      if (index !== -1) quotes.value[index] = response.data.quote
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Erreur lors de la conversion'
      return null
    } finally {
      loading.value = false
    }
  }

  async function searchProducts(query) {
    try {
      const response = await api.get('/quotes/search-products', { params: { q: query } })
      return response.data
    } catch (err) {
      console.error('searchProducts error:', err)
      return []
    }
  }

  async function fetchShippingMethods() {
    try {
      const response = await api.get('/quotes/shipping-methods')
      shippingMethods.value = response.data
      return response.data
    } catch (err) {
      console.error('fetchShippingMethods error:', err)
      return []
    }
  }

  return {
    quotes,
    currentQuote,
    loading,
    error,
    shippingMethods,
    draftQuotes,
    sentQuotes,
    acceptedQuotes,
    convertedQuotes,
    rejectedQuotes,
    fetchQuotes,
    fetchQuote,
    createQuote,
    updateQuote,
    deleteQuote,
    updateStatus,
    addItem,
    updateItem,
    deleteItem,
    recalculate,
    convertToOrder,
    searchProducts,
    fetchShippingMethods
  }
})
