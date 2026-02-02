<template>
  <div class="admin-container">
    <header class="admin-header">
      <button @click="goBack" class="btn-back">← Retour</button>
      <h1>Gestion QR Codes ↔ SKU</h1>
    </header>

    <main class="admin-content">
      <div class="products-section">
        <div class="section-header">
          <h2>Produits et QR Codes</h2>
          <div class="header-actions">
            <button @click="syncProducts" class="btn-sync" :disabled="syncing">
              {{ syncing ? '⏳ Synchronisation...' : '🔄 Sync WooCommerce' }}
            </button>
            <button @click="syncNewProducts" class="btn-sync-new" :disabled="syncingNew">
              {{ syncingNew ? '⏳ Recherche...' : '🆕 Nouveaux produits' }}
            </button>
            <button @click="generateAllQR" class="btn-generate" :disabled="generatingAll">
              {{ generatingAll ? `⏳ ${generationProgress.current}/${generationProgress.total}...` : '🔄 Générer QR pour tous' }}
            </button>
            <button @click="printAllQR" class="btn-print" :disabled="!hasQRCodes">
              🖨️ Imprimer tous les QR
            </button>
          </div>
        </div>

        <!-- Onglets -->
        <div class="tabs">
          <button
            class="tab"
            :class="{ active: activeTab === 'all' }"
            @click="activeTab = 'all'"
          >
            Tous les produits ({{ products.length }})
          </button>
          <button
            class="tab"
            :class="{ active: activeTab === 'new' }"
            @click="activeTab = 'new'"
          >
            🆕 Nouveaux ({{ newProducts.length }})
          </button>
          <button
            class="tab"
            :class="{ active: activeTab === 'noqr' }"
            @click="activeTab = 'noqr'"
          >
            ⚠️ Sans QR ({{ productsWithoutQR.length }})
          </button>
        </div>

        <div v-if="loading" class="loading">
          Chargement des produits...
        </div>

        <div v-else-if="displayedProducts.length === 0" class="empty-state">
          <p v-if="activeTab === 'new'">Aucun nouveau produit. Cliquez sur "🆕 Nouveaux produits" pour synchroniser.</p>
          <p v-else-if="activeTab === 'noqr'">Tous les produits ont un QR code !</p>
          <p v-else>Aucun produit. Cliquez sur "🔄 Sync WooCommerce" pour synchroniser.</p>
        </div>

        <div v-else class="products-table">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nom</th>
                <th>Emplacement</th>
                <th>QR Code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in displayedProducts" :key="product.id" :class="{ 'new-product': product.isNew }">
                <td data-label="SKU" class="sku">{{ product.sku }}</td>
                <td data-label="Nom">{{ product.name }}</td>
                <td data-label="Emplacement">
                  <input
                    v-model="product.location"
                    type="text"
                    placeholder="Ex: A1-B2"
                    @blur="updateProduct(product)"
                    class="input-location"
                  />
                </td>
                <td data-label="QR Code">
                  <div v-if="product.qr_code" class="qr-display">
                    <canvas :id="`qr-${product.id}`" class="qr-canvas"></canvas>
                    <span class="qr-value">{{ product.qr_code }}</span>
                  </div>
                  <button v-else @click="generateQR(product)" class="btn-small">
                    Générer QR
                  </button>
                </td>
                <td data-label="Actions">
                  <div class="action-buttons">
                    <button @click="editQR(product)" class="btn-action" :disabled="!product.qr_code" title="Modifier QR">
                      ✏️
                    </button>
                    <button @click="printSingleQR(product)" class="btn-action" :disabled="!product.qr_code" title="Imprimer">
                      🖨️
                    </button>
                    <button @click="downloadQR(product)" class="btn-action" :disabled="!product.qr_code" title="Télécharger">
                      📥
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="import-section">
        <h2>Import CSV</h2>
        <p>Format: SKU,QR_CODE,LOCATION</p>
        <input type="file" @change="handleFileUpload" accept=".csv" />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import api from '../services/api'

const router = useRouter()
const products = ref([])
const loading = ref(true)
const syncing = ref(false)
const syncingNew = ref(false)
const activeTab = ref('all')
const newProducts = ref([])

const hasQRCodes = computed(() => {
  return products.value.some(p => p.qr_code)
})

const productsWithoutQR = computed(() => {
  return products.value.filter(p => !p.qr_code)
})

const displayedProducts = computed(() => {
  switch (activeTab.value) {
    case 'new':
      return newProducts.value
    case 'noqr':
      return productsWithoutQR.value
    default:
      return products.value
  }
})

onMounted(async () => {
  await loadProducts()
})

async function syncProducts() {
  if (!confirm('Synchroniser tous les produits depuis WooCommerce ?')) {
    return
  }

  syncing.value = true
  try {
    console.log('🔄 Synchronisation des produits WooCommerce...')
    const response = await api.post('/products/sync')

    products.value = response.data.products
    newProducts.value = [] // Reset nouveaux produits après sync complète

    // Attendre le rendu puis afficher les QR codes existants
    await nextTick()
    products.value.forEach(product => {
      if (product.qr_code) {
        renderQRCode(product)
      }
    })

    alert(`✅ ${response.data.count} produits synchronisés avec succès !`)
  } catch (error) {
    console.error('Erreur sync produits:', error)
    alert('Erreur lors de la synchronisation des produits')
  } finally {
    syncing.value = false
  }
}

async function syncNewProducts() {
  syncingNew.value = true
  try {
    console.log('🆕 Recherche de nouveaux produits WooCommerce...')

    // Garder les IDs des produits existants avant sync
    const existingIds = new Set(products.value.map(p => p.wc_id))

    // Synchroniser tous les produits
    const response = await api.post('/products/sync')

    // Identifier les nouveaux produits (ceux qui n'existaient pas avant)
    const allProducts = response.data.products
    const newOnes = allProducts.filter(p => !existingIds.has(p.wc_id))

    // Marquer les nouveaux produits
    newOnes.forEach(p => p.isNew = true)

    products.value = allProducts
    newProducts.value = newOnes

    // Attendre le rendu puis afficher les QR codes existants
    await nextTick()
    products.value.forEach(product => {
      if (product.qr_code) {
        renderQRCode(product)
      }
    })

    if (newOnes.length > 0) {
      activeTab.value = 'new' // Basculer sur l'onglet des nouveaux produits
      alert(`✅ ${newOnes.length} nouveau(x) produit(s) trouvé(s) !`)
    } else {
      alert('Aucun nouveau produit trouvé.')
    }
  } catch (error) {
    console.error('Erreur sync nouveaux produits:', error)
    alert('Erreur lors de la recherche de nouveaux produits')
  } finally {
    syncingNew.value = false
  }
}

async function loadProducts() {
  loading.value = true
  try {
    const response = await api.get('/products')
    products.value = response.data.products

    // Générer les QR codes visuels après chargement
    await nextTick()
    products.value.forEach(product => {
      if (product.qr_code) {
        renderQRCode(product)
      }
    })
  } catch (error) {
    console.error('Erreur chargement produits:', error)
  } finally {
    loading.value = false
  }
}

async function generateQR(product, showAlert = true) {
  try {
    // Générer un QR code basé sur le SKU
    const qrCode = `QR-${product.sku}`

    await api.put(`/products/${product.id}/qr`, {
      qrCode
    })

    product.qr_code = qrCode

    await nextTick()
    renderQRCode(product)

    if (showAlert) {
      alert(`QR Code généré: ${qrCode}`)
    }
    return true
  } catch (error) {
    console.error('Erreur génération QR:', error)
    if (showAlert) {
      alert('Erreur lors de la génération du QR code')
    }
    return false
  }
}

const generatingAll = ref(false)
const generationProgress = ref({ current: 0, total: 0 })

async function generateAllQR() {
  const productsWithoutQR = products.value.filter(p => !p.qr_code)

  if (productsWithoutQR.length === 0) {
    alert('Tous les produits ont déjà un QR code !')
    return
  }

  if (!confirm(`Générer ${productsWithoutQR.length} QR codes pour les produits sans QR ?`)) {
    return
  }

  generatingAll.value = true
  generationProgress.value = { current: 0, total: productsWithoutQR.length }

  let successCount = 0
  let errorCount = 0

  for (const product of productsWithoutQR) {
    const success = await generateQR(product, false) // false = pas d'alerte individuelle
    if (success) {
      successCount++
    } else {
      errorCount++
    }
    generationProgress.value.current++
  }

  generatingAll.value = false

  // Un seul message récapitulatif à la fin
  if (errorCount === 0) {
    alert(`✅ ${successCount} QR codes générés avec succès !`)
  } else {
    alert(`${successCount} QR codes générés, ${errorCount} erreurs`)
  }
}

async function updateProduct(product) {
  try {
    await api.put(`/products/${product.id}`, {
      location: product.location
    })
  } catch (error) {
    console.error('Erreur mise à jour produit:', error)
  }
}

async function renderQRCode(product) {
  const canvas = document.getElementById(`qr-${product.id}`)
  if (canvas) {
    try {
      await QRCode.toCanvas(canvas, product.qr_code, {
        width: 100,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
    } catch (error) {
      console.error('Erreur génération QR visuel:', error)
    }
  }
}

async function editQR(product) {
  if (!product.qr_code) return

  const newQRCode = prompt('Modifier le QR Code:', product.qr_code)

  if (newQRCode && newQRCode !== product.qr_code) {
    try {
      await api.put(`/products/${product.id}/qr`, {
        qrCode: newQRCode,
        location: product.location
      })

      product.qr_code = newQRCode

      await nextTick()
      renderQRCode(product)

      alert(`QR Code modifié: ${newQRCode}`)
    } catch (error) {
      console.error('Erreur modification QR:', error)
      alert('Erreur lors de la modification du QR code')
    }
  }
}

async function printSingleQR(product) {
  if (!product.qr_code) return

  try {
    // Générer le QR code en haute résolution
    const qrDataUrl = await QRCode.toDataURL(product.qr_code, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })

    // Créer une fenêtre d'impression pour un seul QR
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Impression QR Code - ${product.sku}</title>
        <style>
          @media print {
            @page { margin: 1cm; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .qr-item {
            border: 2px solid #333;
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 20px;
            border-radius: 12px;
            max-width: 500px;
          }
          .qr-image {
            flex-shrink: 0;
          }
          .qr-image img {
            width: 120px;
            height: 120px;
            display: block;
          }
          .qr-info {
            flex: 1;
            text-align: left;
          }
          .qr-sku {
            font-weight: bold;
            font-size: 24px;
            margin-bottom: 6px;
          }
          .qr-name {
            font-size: 16px;
            color: #333;
            margin-bottom: 8px;
            line-height: 1.3;
          }
          .qr-code-text {
            font-family: monospace;
            font-size: 12px;
            color: #999;
          }
          .qr-location {
            font-size: 14px;
            color: #10B981;
            margin-top: 6px;
            font-weight: 600;
          }
          .print-btn {
            margin-top: 20px;
            padding: 10px 20px;
            background: #6366F1;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div>
          <div class="qr-item">
            <div class="qr-image">
              <img src="${qrDataUrl}" alt="QR Code ${product.sku}">
            </div>
            <div class="qr-info">
              <div class="qr-sku">${product.sku}</div>
              <div class="qr-name">${product.name}</div>
              <div class="qr-code-text">${product.qr_code}</div>
              ${product.location ? `<div class="qr-location">📍 ${product.location}</div>` : ''}
            </div>
          </div>
          <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer</button>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
  } catch (error) {
    console.error('Erreur impression QR:', error)
    alert('Erreur lors de l\'impression du QR code')
  }
}

async function downloadQR(product) {
  if (!product.qr_code) return

  try {
    // Générer un QR code haute résolution pour l'impression
    const url = await QRCode.toDataURL(product.qr_code, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })

    const a = document.createElement('a')
    a.href = url
    a.download = `QR_${product.sku}.png`
    a.click()
  } catch (error) {
    console.error('Erreur téléchargement QR:', error)
    alert('Erreur lors du téléchargement du QR code')
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    const text = e.target.result
    const lines = text.split('\n')

    for (let i = 1; i < lines.length; i++) {
      const [sku, qrCode, location] = lines[i].split(',')
      if (sku && qrCode) {
        const product = products.value.find(p => p.sku === sku.trim())
        if (product) {
          try {
            await api.put(`/products/${product.id}/qr`, {
              qrCode: qrCode.trim(),
              location: location?.trim()
            })
            product.qr_code = qrCode.trim()
            if (location) product.location = location.trim()
          } catch (error) {
            console.error(`Erreur import ${sku}:`, error)
          }
        }
      }
    }

    await loadProducts()
    alert('Import terminé !')
  }
  reader.readAsText(file)
}

async function printAllQR() {
  try {
    // Créer une fenêtre d'impression avec tous les QR codes
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Impression QR Codes</title>
        <style>
          @media print {
            @page { margin: 0.5cm; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 10px;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 15px;
          }
          .qr-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .qr-item {
            border: 1px solid #333;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            page-break-inside: avoid;
            border-radius: 8px;
          }
          .qr-image {
            flex-shrink: 0;
          }
          .qr-image img {
            width: 80px;
            height: 80px;
            display: block;
          }
          .qr-info {
            flex: 1;
            text-align: left;
            overflow: hidden;
          }
          .qr-sku {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 3px;
          }
          .qr-name {
            font-size: 11px;
            color: #333;
            margin-bottom: 4px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .qr-code-text {
            font-family: monospace;
            font-size: 9px;
            color: #999;
          }
          .qr-location {
            font-size: 10px;
            color: #10B981;
            margin-top: 3px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <h1>QR Codes - Picking WebApp</h1>
        <div class="qr-grid">
    `)

    // Générer et ajouter chaque QR code
    for (const product of products.value) {
      if (product.qr_code) {
        const qrDataUrl = await QRCode.toDataURL(product.qr_code, {
          width: 200,
          margin: 1
        })

        printWindow.document.write(`
          <div class="qr-item">
            <div class="qr-image">
              <img src="${qrDataUrl}" alt="QR Code ${product.sku}" />
            </div>
            <div class="qr-info">
              <div class="qr-sku">${product.sku}</div>
              <div class="qr-name">${product.name}</div>
              <div class="qr-code-text">${product.qr_code}</div>
              ${product.location ? `<div class="qr-location">📍 ${product.location}</div>` : ''}
            </div>
          </div>
        `)
      }
    }

    printWindow.document.write(`
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()

    // Attendre le chargement des images puis imprimer
    setTimeout(() => {
      printWindow.print()
    }, 500)
  } catch (error) {
    console.error('Erreur impression QR:', error)
    alert('Erreur lors de la préparation de l\'impression')
  }
}

function goBack() {
  router.push('/dashboard')
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-header {
  background: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  padding: 0.5rem 1rem;
  background: #f0f0f0;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
}

.admin-header h1 {
  font-size: 1.5rem;
  color: #333;
  margin: 0;
}

.admin-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.products-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-sync {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-sync:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-sync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sync-new {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-sync-new:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-sync-new:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-generate {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-generate:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-generate:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-print {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, var(--success) 0%, #45a049 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}

.btn-print:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #ccc;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 0;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-weight: 600;
  color: #666;
  transition: all 0.2s;
  margin-bottom: -2px;
}

.tab:hover {
  color: var(--primary);
}

.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  background: rgba(12, 180, 212, 0.05);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
  background: #f9f9f9;
  border-radius: var(--radius-md);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

tr.new-product {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%);
}

tr.new-product td:first-child::before {
  content: '🆕 ';
}

.products-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #f5f7fa;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e0e0e0;
}

td {
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.sku {
  font-family: monospace;
  font-weight: 600;
  color: #667eea;
}

.input-location {
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  width: 100%;
}

.qr-display {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.qr-canvas {
  width: 100px;
  height: 100px;
  border: 1px solid #e0e0e0;
}

.qr-value {
  font-family: monospace;
  color: #666;
  font-size: 0.875rem;
}

.btn-small {
  padding: 0.5rem 1rem;
  background: var(--success);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.btn-action {
  padding: 0.5rem 0.75rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
}

.btn-action:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(12, 180, 212, 0.3);
}

.btn-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: #ccc;
}

.btn-download {
  padding: 0.5rem 1rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-download:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.import-section h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.import-section p {
  color: #666;
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
}

input[type="file"] {
  padding: 0.75rem;
  border: 2px dashed #e0e0e0;
  border-radius: var(--radius-md);
  width: 100%;
  cursor: pointer;
}

/* === RESPONSIVE MOBILE === */
@media (max-width: 768px) {
  .admin-header {
    padding: 1rem;
  }

  .admin-header h1 {
    font-size: 1.125rem;
  }

  .admin-content {
    padding: 1rem;
  }

  .products-section {
    padding: 1rem;
    overflow-x: auto;
  }

  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .header-actions {
    flex-direction: column;
    width: 100%;
  }

  .header-actions button {
    width: 100%;
  }

  /* Transformer le tableau en cards sur mobile */
  .products-table {
    overflow-x: visible;
  }

  table {
    display: block;
  }

  thead {
    display: none;
  }

  tbody {
    display: block;
  }

  tr {
    display: block;
    margin-bottom: 1.5rem;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1rem;
    background: white;
  }

  td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border: none;
  }

  td::before {
    content: attr(data-label);
    font-weight: 600;
    color: #666;
    margin-right: 1rem;
  }

  .input-location {
    max-width: 200px;
  }

  .qr-display {
    flex-direction: column;
    align-items: flex-end;
  }

  .qr-canvas {
    width: 80px !important;
    height: 80px !important;
  }

  .action-buttons {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .btn-action {
    min-width: 45px;
    height: 45px;
    font-size: 1.5rem;
  }
}
</style>
