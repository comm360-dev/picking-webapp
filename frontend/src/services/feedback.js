// Service de feedback audio et haptique pour l'application

class FeedbackService {
  constructor() {
    // Créer les sons de feedback
    this.sounds = {
      success: this.createBeep(800, 0.1, 'sine'), // Son aigu court
      error: this.createBeep(200, 0.3, 'sawtooth') // Son grave long
    }
  }

  /**
   * Crée un son beep avec Web Audio API
   */
  createBeep(frequency, duration, type = 'sine') {
    return () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = type

        // Envelope pour adoucir le son
        gainNode.gain.setValueAtTime(0, audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + duration)
      } catch (error) {
        console.warn('Erreur lors de la lecture du son:', error)
      }
    }
  }

  /**
   * Vibration pour le succès
   */
  vibrateSuccess() {
    if ('vibrate' in navigator) {
      // Pattern: courte vibration (succès)
      navigator.vibrate(100)
    }
  }

  /**
   * Vibration pour l'erreur
   */
  vibrateError() {
    if ('vibrate' in navigator) {
      // Pattern: double vibration (erreur)
      navigator.vibrate([100, 50, 100])
    }
  }

  /**
   * Feedback complet de succès
   */
  success() {
    this.sounds.success()
    this.vibrateSuccess()
  }

  /**
   * Feedback complet d'erreur
   */
  error() {
    this.sounds.error()
    this.vibrateError()
  }

  /**
   * Teste les feedbacks
   */
  test() {
    console.log('🔊 Test du feedback SUCCESS')
    this.success()

    setTimeout(() => {
      console.log('🔊 Test du feedback ERROR')
      this.error()
    }, 1000)
  }
}

// Export une instance singleton
export default new FeedbackService()
