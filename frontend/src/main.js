import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const authStore = useAuthStore()
authStore.initAuth()

// Enregistrer le Service Worker - DÉSACTIVÉ temporairement
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/service-worker.js')
//       .then(registration => {
//         console.log('✅ Service Worker enregistré:', registration.scope)
//       })
//       .catch(error => {
//         console.error('❌ Erreur Service Worker:', error)
//       })
//   })
// }

app.mount('#app')
