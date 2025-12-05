<template>
  <div class="qr-scanner">
    <div class="scanner-header">
      <h3>Scanner QR Code</h3>
      <button @click="toggleScanner" class="btn-toggle">
        {{ isScanning ? '⏸️ Arrêter' : '📷 Démarrer' }}
      </button>
    </div>

    <div v-if="isScanning" class="scanner-container">
      <div id="qr-reader" ref="qrReader"></div>
      <p class="scanner-info">Positionnez le QR code dans le cadre</p>
    </div>

    <div v-else class="scanner-placeholder">
      <p>📷 Cliquez sur "Démarrer" pour activer la caméra</p>
    </div>

    <div v-if="lastScan" class="last-scan">
      <p>Dernier scan: <strong>{{ lastScan }}</strong></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

const emit = defineEmits(['scan'])

const isScanning = ref(false)
const lastScan = ref('')
const qrScanner = ref(null)

async function toggleScanner() {
  if (isScanning.value) {
    await stopScanner()
  } else {
    await startScanner()
  }
}

async function startScanner() {
  try {
    qrScanner.value = new Html5Qrcode('qr-reader')

    await qrScanner.value.start(
      { facingMode: 'environment' }, // Caméra arrière
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      onScanSuccess,
      onScanFailure
    )

    isScanning.value = true
  } catch (error) {
    console.error('Erreur démarrage scanner:', error)
    alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
  }
}

async function stopScanner() {
  if (qrScanner.value) {
    try {
      await qrScanner.value.stop()
      qrScanner.value.clear()
      qrScanner.value = null
      isScanning.value = false
    } catch (error) {
      console.error('Erreur arrêt scanner:', error)
    }
  }
}

function onScanSuccess(decodedText) {
  lastScan.value = decodedText
  emit('scan', decodedText)
}

function onScanFailure(error) {
  // Ignorer les erreurs de scan (trop fréquentes)
}

onBeforeUnmount(async () => {
  await stopScanner()
})
</script>

<style scoped>
.qr-scanner {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.scanner-header h3 {
  margin: 0;
  color: #333;
}

.btn-toggle {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-toggle:active {
  transform: scale(0.98);
}

.scanner-container {
  margin: 1rem 0;
}

#qr-reader {
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #667eea;
}

.scanner-info {
  text-align: center;
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.scanner-placeholder {
  padding: 3rem;
  text-align: center;
  background: #f5f7fa;
  border-radius: 8px;
  border: 2px dashed #e0e0e0;
}

.scanner-placeholder p {
  margin: 0;
  color: #666;
  font-size: 1rem;
}

.last-scan {
  margin-top: 1rem;
  padding: 1rem;
  background: #e8f5e9;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.last-scan p {
  margin: 0;
  color: #2e7d32;
}

.last-scan strong {
  font-family: monospace;
  font-size: 1.1rem;
}
</style>
