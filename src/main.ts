import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import { t } from './composables/useUiLanguage'
import { installAuthFetch } from './api/authToken'

console.log('Welcome to codexui. github: https://github.com/puper/codexUI')

installAuthFetch()
createApp(App).use(router).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error(t('Service worker registration failed.'), error)
    })
  })
}
