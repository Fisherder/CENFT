import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CheckIn from '../views/CheckIn.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/checkin/:eventId/:qrCodeHash',
      name: 'checkin',
      component: CheckIn
    }
  ]
})

export default router 