import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { provideDataStore } from './data/provider'
import { createSupabaseDataStore } from './data/supabase/supabaseDataStore'
import { createLocalDataStore } from './data/local/localDataStore'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// --- Storage injection ---
// Đổi DB lưu trữ ở đây: chỉ cần thay bằng một DataStore khác.
// Hiện tại: players lưu Supabase, matches/sessions/seasons tạm lưu localStorage
// (bảng "seasons" và cột "season_id" trên "sessions" chưa được tạo trên Supabase).
const supabaseStore = createSupabaseDataStore()
const localStore = createLocalDataStore()
provideDataStore(app, {
  ...supabaseStore,
  matches: localStore.matches,
  sessions: localStore.sessions,
  seasons: localStore.seasons,
})

app.mount('#app')
