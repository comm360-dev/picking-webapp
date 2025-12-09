<template>
  <div class="register-container">
    <div class="register-card">
      <h1>Picking WebApp</h1>
      <h2>Créer un compte</h2>

      <form @submit.prevent="handleRegister">
        <div class="form-row">
          <div class="form-group">
            <label for="firstName">Prénom</label>
            <input
              id="firstName"
              v-model="firstName"
              type="text"
              placeholder="Prénom"
              required
            />
          </div>

          <div class="form-group">
            <label for="lastName">Nom</label>
            <input
              id="lastName"
              v-model="lastName"
              type="text"
              placeholder="Nom"
              required
            />
          </div>
        </div>

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
            minlength="6"
          />
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirmer le mot de passe</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button type="submit" :disabled="authStore.loading" class="btn-primary">
          {{ authStore.loading ? 'Inscription...' : 'S\'inscrire' }}
        </button>
      </form>

      <p class="login-link">
        Déjà un compte ?
        <router-link to="/login">Se connecter</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const errorMessage = computed(() => {
  if (authStore.error) return authStore.error
  if (password.value && confirmPassword.value && password.value !== confirmPassword.value) {
    return 'Les mots de passe ne correspondent pas'
  }
  return null
})

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    return
  }

  const result = await authStore.register({
    email: email.value,
    password: password.value,
    firstName: firstName.value,
    lastName: lastName.value
  })

  if (result.success) {
    router.push('/dashboard')
  }
}
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 50%, var(--secondary) 100%);
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

.register-container::before {
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

.register-card {
  background: var(--bg-card);
  padding: 3rem;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 520px;
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

h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  text-align: center;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
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
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.login-link {
  text-align: center;
  margin-top: 2rem;
  color: var(--text-secondary);
  font-size: 0.938rem;
}

.login-link a {
  color: var(--primary);
  text-decoration: none;
  font-weight: 700;
  transition: all var(--transition-fast);
  position: relative;
}

.login-link a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary) 0%, var(--accent-purple) 100%);
  transition: width var(--transition-fast);
}

.login-link a:hover {
  color: var(--accent-purple);
}

.login-link a:hover::after {
  width: 100%;
}

@media (max-width: 480px) {
  .register-card {
    padding: 2rem 1.5rem;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 1.5rem;
  }

  h2 {
    font-size: 1.1rem;
  }
}
</style>
