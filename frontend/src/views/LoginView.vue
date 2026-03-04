<template>
  <div class="login-container">
    <div class="login-card">
      <img src="/logo/logo.svg" alt="Retro Car Concept" class="login-logo" />
      <h2>Connexion</h2>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>

        <div v-if="authStore.error" class="error-message">
          {{ authStore.error }}
        </div>

        <button type="submit" :disabled="authStore.loading" class="btn-primary">
          {{ authStore.loading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')

async function handleLogin() {
  const result = await authStore.login(email.value, password.value)

  if (result.success) {
    if (authStore.isCommercial) {
      router.push('/quotes')
    } else {
      router.push('/dashboard')
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

.login-logo {
  display: block;
  width: 100%;
  max-width: 280px;
  height: auto;
  margin: 0 auto 1.5rem auto;
}

.login-container::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: rotate 30s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.login-card {
  background: var(--bg-card);
  padding: 3rem;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
  animation: slideUp 0.6s ease;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h2 {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
  text-align: center;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.625rem;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.938rem;
  letter-spacing: 0.3px;
}

input {
  width: 100%;
  padding: 1rem 1.25rem;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 1rem;
  transition: all var(--transition-fast);
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
}

input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(12, 180, 212, 0.15);
  transform: translateY(-1px);
}

.error-message {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%);
  color: var(--error);
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
  font-size: 0.938rem;
  font-weight: 600;
  border: 1px solid rgba(239, 68, 68, 0.3);
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

.btn-primary {
  width: 100%;
  padding: 1.125rem 1.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: 0 4px 16px rgba(12, 180, 212, 0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(12, 180, 212, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 480px) {
  .login-card {
    padding: 2rem 1.5rem;
  }

  .login-logo {
    max-width: 220px;
  }

  h2 {
    font-size: 1.1rem;
  }
}
</style>
