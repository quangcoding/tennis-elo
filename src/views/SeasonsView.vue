<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { BatchSession, Season } from '@/domain/types'
import { formatDate } from '@/services/format'
import { useSeasonsManager } from '@/composables/useSeasonsManager'

const router = useRouter()

const {
  seasons,
  load,
  sessionsForSeason,
  createSeason,
  updateSeason,
  deleteSeason,
  updateSessionMeta,
  deleteSession,
} = useSeasonsManager()

// --- View-local navigation / modal / toast / form state ---
const selectedSeason = ref<Season | null>(null)
const showAddSeasonModal = ref(false)
const showEditSeasonModal = ref(false)
const showEditSessionModal = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')
const formError = ref('')

const addSeasonForm = ref({ name: '', start_date: '', end_date: '', description: '' })
const editSeasonForm = ref({ _id: '', name: '', start_date: '', end_date: '', description: '' })
const editSessionForm = ref({ _id: '', date: '', note: '', season_id: null as string | null })

onMounted(load)

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = message
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

const sortedSeasons = computed(() =>
  [...seasons.value].sort((a, b) => b.start_date.localeCompare(a.start_date)),
)

const selectedSeasonSessions = computed<BatchSession[]>(() =>
  selectedSeason.value ? sessionsForSeason(selectedSeason.value._id) : [],
)

const sessionChangeSummary = (session: BatchSession) =>
  session.changes.map((c) => `${c.name} ${c.elo_gain >= 0 ? '+' : ''}${c.elo_gain.toFixed(2)}`).join(' • ')

// --- Season CRUD handlers ---
const handleCreateSeason = async () => {
  formError.value = ''
  const { season, error } = await createSeason(addSeasonForm.value)
  if (error) {
    formError.value = error
    return
  }
  showToast(`Đã thêm mùa giải ${season!.name}!`)
  addSeasonForm.value = { name: '', start_date: '', end_date: '', description: '' }
  showAddSeasonModal.value = false
}

const openEditSeasonModal = (season: Season) => {
  editSeasonForm.value = {
    _id: season._id,
    name: season.name,
    start_date: season.start_date,
    end_date: season.end_date,
    description: season.description,
  }
  formError.value = ''
  showEditSeasonModal.value = true
}

const handleUpdateSeason = async () => {
  formError.value = ''
  const { season, error } = await updateSeason(editSeasonForm.value)
  if (error) {
    formError.value = error
    return
  }
  showToast(`Đã cập nhật mùa giải ${season!.name}!`)
  showEditSeasonModal.value = false
}

const handleDeleteSeason = async (season: Season) => {
  if (!confirm(`Bạn có chắc chắn muốn xóa mùa giải ${season.name}?`)) return
  const { error } = await deleteSeason(season._id)
  if (error) {
    showToast(error, 'error')
    return
  }
  showToast(`Đã xóa mùa giải ${season.name}!`)
}

// --- Season detail navigation ---
const openSeasonDetail = (season: Season) => {
  selectedSeason.value = season
}

const backToSeasonList = () => {
  selectedSeason.value = null
}

// --- Session CRUD handlers ---
const openEditSessionModal = (session: BatchSession) => {
  editSessionForm.value = {
    _id: session._id,
    date: session.date.slice(0, 10),
    note: session.note,
    season_id: session.season_id,
  }
  formError.value = ''
  showEditSessionModal.value = true
}

const handleUpdateSession = async () => {
  formError.value = ''
  const { error } = await updateSessionMeta(editSessionForm.value)
  if (error) {
    formError.value = error
    return
  }
  showToast('Đã cập nhật buổi chơi!')
  showEditSessionModal.value = false
}

const handleDeleteSession = async (session: BatchSession) => {
  if (
    !confirm(
      `Bạn có chắc chắn muốn xóa buổi chơi ngày ${formatDate(session.date)}? Điểm Elo đã cộng/trừ cho các tuyển thủ sẽ được hoàn tác.`,
    )
  )
    return
  await deleteSession(session._id)
  showToast('Đã xóa buổi chơi!')
}

const navigateToAddSession = () => {
  if (!selectedSeason.value) return
  router.push({ path: '/', query: { tab: 'leaderboard', openBatchSeason: selectedSeason.value._id } })
}

const navigateToHome = (tab: 'leaderboard' | 'matches') => {
  router.push({ path: '/', query: { tab } })
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-0 md:p-6 font-sans">
    <div
      class="w-full md:max-w-md h-screen md:h-[880px] bg-slate-900 shadow-2xl md:rounded-[40px] md:ring-8 md:ring-slate-800 overflow-hidden relative flex flex-col">
      <!-- Top Status Bar Mockup (Desktop only) -->
      <div
        class="hidden md:flex justify-between items-center px-8 pt-4 pb-2 bg-slate-900 text-[11px] font-medium text-slate-400 select-none z-10 shrink-0">
        <span>9:41</span>
      </div>

      <!-- App Header -->
      <header
        class="px-5 py-4 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 shrink-0 flex justify-between items-center z-10">
        <div class="flex items-center space-x-2 min-w-0">
          <button v-if="selectedSeason" @click="backToSeasonList"
            class="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-tr from-lime-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-lime-500/20 shrink-0">
            <svg class="w-5 h-5 text-slate-950 stroke-current" fill="none" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div class="min-w-0">
            <h1
              class="text-sm font-extrabold tracking-tight bg-gradient-to-r from-slate-50 to-slate-200 bg-clip-text text-transparent truncate">
              {{ selectedSeason ? selectedSeason.name : 'Quản lý mùa giải' }}
            </h1>
            <p class="text-[9px] text-slate-400 font-bold tracking-wide truncate">
              {{ selectedSeason
                ? `${formatDate(selectedSeason.start_date)} - ${formatDate(selectedSeason.end_date)}`
                : 'Các mùa giải của câu lạc bộ' }}
            </p>
          </div>
        </div>

        <button v-if="!selectedSeason" @click="showAddSeasonModal = true"
          class="p-2 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 hover:text-lime-300 transition-all border border-lime-500/20 text-xs font-bold flex items-center space-x-1 shrink-0">
          <svg class="w-3.5 h-3.5 stroke-current" fill="none" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Thêm</span>
        </button>
        <button v-else @click="navigateToAddSession"
          class="p-2 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 hover:text-lime-300 transition-all border border-lime-500/20 text-xs font-bold flex items-center space-x-1 shrink-0">
          <svg class="w-3.5 h-3.5 stroke-current" fill="none" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Buổi chơi</span>
        </button>
      </header>

      <!-- Main Scrollable Content -->
      <div class="flex-1 overflow-y-auto pb-6 bg-slate-900/20">
        <!-- Toast Notification -->
        <transition enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform -translate-y-4 opacity-0" enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in" leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform -translate-y-4 opacity-0">
          <div v-if="toastMessage"
            class="mx-5 mt-4 p-3 rounded-xl border flex items-center space-x-2 text-xs font-semibold z-55 relative"
            :class="toastType === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400'
              : 'bg-red-950/80 border-red-500/30 text-red-400'
              ">
            <span>{{ toastMessage }}</span>
          </div>
        </transition>

        <!-- SEASON LIST SCREEN -->
        <div v-if="!selectedSeason" class="px-5 pt-4 pb-6 space-y-2.5">
          <div v-if="sortedSeasons.length === 0" class="text-center py-12 text-slate-500 text-xs">
            Chưa có mùa giải nào, bấm "Thêm" để tạo mùa giải đầu tiên.
          </div>

          <div v-for="season in sortedSeasons" :key="season._id" @click="openSeasonDetail(season)"
            class="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3.5 hover:border-lime-500/40 transition-all cursor-pointer">
            <div class="flex items-center justify-between">
              <div class="min-w-0 pr-2">
                <h4 class="text-xs font-bold text-slate-200 truncate">{{ season.name }}</h4>
                <p class="text-[9px] text-slate-400 mt-0.5">
                  {{ formatDate(season.start_date) }} - {{ formatDate(season.end_date) }}
                </p>
                <p v-if="season.description" class="text-[9px] text-slate-500 mt-1 line-clamp-2">
                  {{ season.description }}
                </p>
                <p class="text-[8px] text-lime-400 font-semibold mt-1">
                  {{ sessionsForSeason(season._id).length }} buổi chơi
                </p>
              </div>
              <div class="flex flex-col space-y-1.5 shrink-0" @click.stop>
                <button @click="openEditSeasonModal(season)"
                  class="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-colors border border-slate-700/50"
                  title="Sửa mùa giải">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.013a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button @click="handleDeleteSeason(season)"
                  class="p-1 rounded-md bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-colors border border-slate-700/50"
                  title="Xóa mùa giải">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- SESSION LIST SCREEN (for selected season) -->
        <div v-else class="px-5 pt-4 pb-6 space-y-2.5">
          <div v-if="selectedSeason.description" class="text-[10px] text-slate-400 pb-1">
            {{ selectedSeason.description }}
          </div>

          <div v-if="selectedSeasonSessions.length === 0" class="text-center py-12 text-slate-500 text-xs">
            Mùa giải chưa có buổi chơi nào. Bấm "Buổi chơi" để ghi nhận.
          </div>

          <div v-for="session in selectedSeasonSessions" :key="session._id"
            class="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3.5 hover:border-slate-700/80 transition-all">
            <div class="flex items-center justify-between">
              <div class="min-w-0 pr-2">
                <h4 class="text-xs font-bold text-slate-200">{{ formatDate(session.date) }}</h4>
                <p class="text-[9px] text-slate-400 mt-0.5 truncate">{{ session.note }}</p>
                <p class="text-[8px] text-slate-500 mt-1 truncate">{{ sessionChangeSummary(session) }}</p>
              </div>
              <div class="flex flex-col space-y-1.5 shrink-0">
                <button @click="openEditSessionModal(session)"
                  class="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-colors border border-slate-700/50"
                  title="Sửa buổi chơi">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.013a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button @click="handleDeleteSession(session)"
                  class="p-1 rounded-md bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-colors border border-slate-700/50"
                  title="Xóa buổi chơi">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- App Bottom Tab Bar -->
      <nav
        class="h-[64px] bg-slate-900 border-t border-slate-800/85 backdrop-blur-md flex justify-around items-center px-4 pb-2 z-30 shrink-0">
        <button @click="navigateToHome('leaderboard')"
          class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-slate-500 hover:text-slate-300">
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 15v5m-3 0h6M21 8a3 3 0 00-3-3H6a3 3 0 00-3 3v2a3 3 0 003 3h12a3 3 0 003-3V8z" />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Hạng</span>
        </button>

        <button @click="router.push('/players')"
          class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-slate-500 hover:text-slate-300">
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A3.318 3.318 0 0112 22.5c-1.258 0-2.4-.698-3-1.847V19.13M8.25 12h7.5m-7.5 3H12" />
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M18 9a3 3 0 11-6 0 3 3 0 016 0zM6 15a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Tuyển thủ</span>
        </button>

        <button class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-lime-400 scale-105">
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Mùa giải</span>
        </button>
      </nav>

      <!-- MODAL: ADD SEASON -->
      <transition enter-active-class="transition duration-300 ease-out" enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0" leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0" leave-to-class="transform translate-y-full">
        <div v-if="showAddSeasonModal"
          class="absolute inset-x-0 bottom-0 max-h-[85%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-6">
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>
          <div class="px-5 pb-3 flex justify-between items-center shrink-0">
            <h2 class="text-sm font-extrabold text-slate-100">Thêm mùa giải mới</h2>
            <button @click="showAddSeasonModal = false"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="px-5 space-y-4">
            <div v-if="formError"
              class="p-2.5 bg-red-950/80 border border-red-500/30 text-red-400 rounded-xl text-2xs font-semibold">
              {{ formError }}
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tên mùa giải</label>
              <input v-model="addSeasonForm.name" type="text" placeholder="Ví dụ: Mùa hè 2026"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 placeholder-slate-650 focus:outline-none focus:border-lime-500/50" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bắt đầu</label>
                <input v-model="addSeasonForm.start_date" type="date"
                  class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kết thúc</label>
                <input v-model="addSeasonForm.end_date" type="date"
                  class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mô tả</label>
              <textarea v-model="addSeasonForm.description" rows="2" placeholder="Ghi chú về mùa giải (tùy chọn)"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 placeholder-slate-650 focus:outline-none focus:border-lime-500/50 resize-none"></textarea>
            </div>

            <button @click="handleCreateSeason"
              class="w-full py-3 bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 rounded-xl font-bold text-xs shadow-lg shadow-lime-500/10 active:scale-98 transition-all mt-4">
              Thêm mùa giải
            </button>
          </div>
        </div>
      </transition>

      <!-- MODAL: EDIT SEASON -->
      <transition enter-active-class="transition duration-300 ease-out" enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0" leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0" leave-to-class="transform translate-y-full">
        <div v-if="showEditSeasonModal"
          class="absolute inset-x-0 bottom-0 max-h-[85%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-6">
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>
          <div class="px-5 pb-3 flex justify-between items-center shrink-0">
            <h2 class="text-sm font-extrabold text-slate-100">Sửa mùa giải</h2>
            <button @click="showEditSeasonModal = false"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="px-5 space-y-4">
            <div v-if="formError"
              class="p-2.5 bg-red-950/80 border border-red-500/30 text-red-400 rounded-xl text-2xs font-semibold">
              {{ formError }}
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tên mùa giải</label>
              <input v-model="editSeasonForm.name" type="text"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bắt đầu</label>
                <input v-model="editSeasonForm.start_date" type="date"
                  class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kết thúc</label>
                <input v-model="editSeasonForm.end_date" type="date"
                  class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mô tả</label>
              <textarea v-model="editSeasonForm.description" rows="2"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50 resize-none"></textarea>
            </div>

            <button @click="handleUpdateSeason"
              class="w-full py-3 bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 rounded-xl font-bold text-xs shadow-lg shadow-lime-500/10 active:scale-98 transition-all mt-4">
              Lưu thay đổi
            </button>
          </div>
        </div>
      </transition>

      <!-- MODAL: EDIT SESSION -->
      <transition enter-active-class="transition duration-300 ease-out" enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0" leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0" leave-to-class="transform translate-y-full">
        <div v-if="showEditSessionModal"
          class="absolute inset-x-0 bottom-0 max-h-[85%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-6">
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>
          <div class="px-5 pb-3 flex justify-between items-center shrink-0">
            <h2 class="text-sm font-extrabold text-slate-100">Sửa buổi chơi</h2>
            <button @click="showEditSessionModal = false"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="px-5 space-y-4">
            <div v-if="formError"
              class="p-2.5 bg-red-950/80 border border-red-500/30 text-red-400 rounded-xl text-2xs font-semibold">
              {{ formError }}
            </div>

            <p class="text-[9px] text-slate-500">
              Chỉ có thể sửa ngày, ghi chú và mùa giải. Để sửa kết quả thắng/thua, hãy xóa buổi chơi này và ghi nhận lại.
            </p>

            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ngày chơi</label>
              <input v-model="editSessionForm.date" type="date"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ghi chú</label>
              <input v-model="editSessionForm.note" type="text"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mùa giải</label>
              <select v-model="editSessionForm.season_id"
                class="w-full bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 px-3 py-2.5 rounded-xl appearance-none focus:outline-none focus:border-lime-500/50">
                <option :value="null">Không thuộc mùa giải nào</option>
                <option v-for="season in sortedSeasons" :key="season._id" :value="season._id">
                  {{ season.name }}
                </option>
              </select>
            </div>

            <button @click="handleUpdateSession"
              class="w-full py-3 bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 rounded-xl font-bold text-xs shadow-lg shadow-lime-500/10 active:scale-98 transition-all mt-4">
              Lưu thay đổi
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>
