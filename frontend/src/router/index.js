import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import PickingView from '../views/PickingView.vue'
import PickingFastView from '../views/PickingFastView.vue'
import AdminQRView from '../views/AdminQRView.vue'
import HistoryView from '../views/HistoryView.vue'
import QuotesView from '../views/QuotesView.vue'
import QuoteEditorView from '../views/QuoteEditorView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/picking/:id',
      name: 'picking',
      component: PickingView,
      meta: { requiresAuth: true }
    },
    {
      path: '/picking/:id/fast',
      name: 'picking-fast',
      component: PickingFastView,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin/qr',
      name: 'admin-qr',
      component: AdminQRView,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView,
      meta: { requiresAuth: true }
    },
    {
      path: '/quotes',
      name: 'quotes',
      component: QuotesView,
      meta: { requiresAuth: true, requiresCommercial: true }
    },
    {
      path: '/quotes/:id',
      name: 'quote-editor',
      component: QuoteEditorView,
      meta: { requiresAuth: true, requiresCommercial: true }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard'
    }
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    // Rediriger selon le rôle
    if (authStore.isCommercial) {
      next('/quotes')
    } else {
      next('/dashboard')
    }
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/dashboard')
  } else if (to.meta.requiresCommercial && !authStore.isCommercial && !authStore.isAdmin) {
    next('/dashboard')
  } else if (authStore.isCommercial && !to.meta.requiresCommercial && to.name !== 'login') {
    // Le commercial ne peut accéder qu'aux pages devis
    next('/quotes')
  } else {
    next()
  }
})

export default router
