<template>
  <div class="qr-scanner">
    <div class="scanner-header">
      <h3>📷 Scanner QR Code</h3>
      <button v-if="isScanning" @click="stopScanner" class="btn-stop">
        ⏸️ Arrêter
      </button>
    </div>

    <div v-if="isScanning" class="scanner-container">
      <div id="qr-reader" ref="qrReader"></div>
      <p class="scanner-info">Positionnez le QR code dans le cadre</p>
    </div>

    <div v-else-if="scanError" class="scanner-error">
      <p>{{ scanError }}</p>
      <button @click="startScanner" class="btn-retry">🔄 Réessayer</button>
    </div>

    <div v-else class="scanner-loading">
      <p>⏳ Activation de la caméra...</p>
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
const scanError = ref('')

// Démarrer automatiquement le scanner au montage
onMounted(async () => {
  await startScanner()
})

async function startScanner() {
  scanError.value = ''

  try {
    // Vérifier si HTTPS est actif (requis pour la caméra sur iOS)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      scanError.value = '⚠️ HTTPS requis pour la caméra sur iPhone.'
      return
    }

    // Activer l'affichage du scanner pour créer l'élément DOM
    isScanning.value = true

    // Attendre que le DOM soit mis à jour
    await new Promise(resolve => setTimeout(resolve, 100))

    // Vérifier que l'élément existe
    const element = document.getElementById('qr-reader')
    if (!element) {
      throw new Error('Élément qr-reader non trouvé dans le DOM')
    }

    qrScanner.value = new Html5Qrcode('qr-reader')

    // Calculer la taille du QR box en fonction de la taille de l'écran
    const qrBoxSize = Math.min(window.innerWidth * 0.8, 300)

    // Essayer d'abord avec la caméra arrière
    try {
      await qrScanner.value.start(
        { facingMode: 'environment' }, // Caméra arrière
        {
          fps: 10,
          qrbox: { width: qrBoxSize, height: qrBoxSize },
          aspectRatio: 1.0
        },
        onScanSuccess,
        onScanFailure
      )
    } catch (backCameraError) {
      console.warn('Caméra arrière non disponible, essai avec caméra frontale:', backCameraError)
      // Si la caméra arrière échoue, essayer la frontale
      await qrScanner.value.start(
        { facingMode: 'user' }, // Caméra frontale
        {
          fps: 10,
          qrbox: { width: qrBoxSize, height: qrBoxSize },
          aspectRatio: 1.0
        },
        onScanSuccess,
        onScanFailure
      )
    }
  } catch (error) {
    console.error('Erreur démarrage scanner:', error)

    // Remettre isScanning à false en cas d'erreur
    isScanning.value = false

    if (error.name === 'NotAllowedError') {
      scanError.value = '❌ Permission caméra refusée. Autorisez l\'accès dans les réglages.'
    } else if (error.name === 'NotFoundError') {
      scanError.value = '❌ Aucune caméra détectée.'
    } else if (error.name === 'NotReadableError') {
      scanError.value = '❌ Caméra déjà utilisée.'
    } else if (error.name === 'SecurityError') {
      scanError.value = '❌ HTTPS requis pour la caméra.'
    } else {
      scanError.value = '❌ Erreur caméra: ' + (error.message || 'Inconnue')
    }
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

.btn-stop {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-stop:active {
  transform: scale(0.98);
}

.btn-retry {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-retry:active {
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

.scanner-loading {
  padding: 3rem;
  text-align: center;
  background: #f5f7fa;
  border-radius: 8px;
  border: 2px dashed #667eea;
}

.scanner-loading p {
  margin: 0;
  color: #667eea;
  font-size: 1rem;
  font-weight: 600;
}

.scanner-error {
  padding: 2rem;
  text-align: center;
  background: #fef2f2;
  border-radius: 8px;
  border: 2px solid #ef4444;
}

.scanner-error p {
  margin: 0;
  color: #dc2626;
  font-size: 0.95rem;
  font-weight: 500;
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
