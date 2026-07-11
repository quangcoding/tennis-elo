import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { provideDataStore } from './data/provider'
import { createSupabaseDataStore } from './data/supabase/supabaseDataStore'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// --- Storage injection ---
// Đổi DB lưu trữ ở đây: chỉ cần thay bằng một DataStore khác (vd: createLocalDataStore()).
provideDataStore(app, createSupabaseDataStore())

app.mount('#app')
