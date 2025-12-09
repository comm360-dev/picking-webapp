<template>
  <NetworkIndicator />
  <transition name="page" mode="out-in">
    <router-view />
  </transition>
</template>

<script setup>
import { onMounted } from 'vue'
import NetworkIndicator from './components/NetworkIndicator.vue'
import { cleanDuplicateItems } from './services/db'

onMounted(async () => {
  // Nettoyer les doublons au démarrage
  try {
    await cleanDuplicateItems()
  } catch (error) {
    console.error('Erreur lors du nettoyage des doublons:', error)
  }
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

:root {
  /* Palette moderne inspirée de l'image */
  --primary: #6366F1;
  --primary-light: #818CF8;
  --primary-dark: #4F46E5;
  --secondary: #EC4899;
  --secondary-light: #F472B6;

  --accent-purple: #A78BFA;
  --accent-pink: #F9A8D4;
  --accent-blue: #60A5FA;

  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;

  --bg-primary: #F8FAFC;
  --bg-secondary: #F1F5F9;
  --bg-card: #FFFFFF;

  --text-primary: #0F172A;
  --text-secondary: #64748B;
  --text-tertiary: #94A3B8;

  --border: #E2E8F0;
  --border-light: #F1F5F9;

  --shadow-sm: 0 2px 8px rgba(99, 102, 241, 0.08);
  --shadow-md: 0 4px 16px rgba(99, 102, 241, 0.12);
  --shadow-lg: 0 8px 32px rgba(99, 102, 241, 0.16);

  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;

  --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-weight: 400;
  line-height: 1.6;
}

#app {
  min-height: 100vh;
}

/* Animations de transitions de page */
.page-enter-active,
.page-leave-active {
  transition: all var(--transition-base);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Animation de fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Animation de slide */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all var(--transition-base);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Animation de scale */
.scale-enter-active,
.scale-leave-active {
  transition: all var(--transition-fast);
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Scrollbar personnalisé */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--primary-light);
  border-radius: 4px;
  transition: background var(--transition-fast);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--primary);
}
</style>
