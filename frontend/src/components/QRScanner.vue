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
    // Vérifier si HTTPS est actif (requis pour la caméra sur iOS)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      alert('⚠️ HTTPS requis pour la caméra sur iPhone. Utilisez l\'URL ngrok.')
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
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      full: JSON.stringify(error, null, 2)
    })

    // Remettre isScanning à false en cas d'erreur
    isScanning.value = false

    let errorMsg = 'Impossible d\'accéder à la caméra.\n\n'

    if (error.name === 'NotAllowedError') {
      errorMsg += '❌ Permission refusée. Allez dans Réglages > Safari > Caméra et autorisez l\'accès.'
    } else if (error.name === 'NotFoundError') {
      errorMsg += '❌ Aucune caméra détectée sur cet appareil.'
    } else if (error.name === 'NotReadableError') {
      errorMsg += '❌ Caméra déjà utilisée par une autre application.'
    } else if (error.name === 'SecurityError') {
      errorMsg += '❌ Accès refusé. HTTPS requis sur iPhone.'
    } else if (error.name === 'OverconstrainedError') {
      errorMsg += '❌ Configuration caméra incompatible. Essayez avec la caméra frontale.'
    } else if (error.message && error.message.includes('Permission')) {
      errorMsg += '❌ Permission caméra refusée. Vérifiez les réglages Safari.'
    } else {
      errorMsg += `Erreur: ${error.message || error.name || JSON.stringify(error) || 'Inconnue'}\n\n`
      errorMsg += 'Type: ' + (typeof error) + '\n'
      errorMsg += 'Protocol: ' + location.protocol
    }

    alert(errorMsg)
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
