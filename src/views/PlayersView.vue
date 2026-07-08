<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Player } from '@/domain/types'
import { getAvatarGradient, getInitials } from '@/services/format'
import { usePlayersManager } from '@/composables/usePlayersManager'

const router = useRouter()

// Player data + CRUD come from the composable (storage-agnostic via DI).
const {
  players,
  searchQuery,
  sortBy,
  filteredPlayers,
  load,
  createPlayer,
  updatePlayer,
  deletePlayer,
} = usePlayersManager()

// --- View-local modal / toast / form state ---
const showAddModal = ref(false)
const showEditModal = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')

const addForm = ref({ name: '', initial_score: 6.0 })
const editForm = ref({ _id: '', name: '', initial_score: 6.0, current_score: 6.0 })
const formError = ref('')

onMounted(load)

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = message
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

// --- CRUD handlers (validation + persistence live in the composable) ---
const handleCreatePlayer = async () => {
  formError.value = ''
  const { player, error } = await createPlayer(addForm.value)
  if (error) {
    formError.value = error
    return
  }
  showToast(`Đã thêm thành công tuyển thủ ${player!.name}!`)
  addForm.value.name = ''
  addForm.value.initial_score = 6.0
  showAddModal.value = false
}

const openEditModal = (player: Player) => {
  editForm.value = {
    _id: player._id,
    name: player.name,
    initial_score: player.initial_score,
    current_score: player.current_score,
  }
  formError.value = ''
  showEditModal.value = true
}

const handleUpdatePlayer = async () => {
  formError.value = ''
  const { player, error } = await updatePlayer(editForm.value)
  if (error) {
    formError.value = error
    return
  }
  showToast(`Đã cập nhật thông tin tuyển thủ ${player!.name}!`)
  showEditModal.value = false
}

const handleDeletePlayer = async (id: string, name: string) => {
  const player = players.value.find((p) => p._id === id)
  if (!player) return

  const message =
    player.matches_played > 0
      ? `Tuyển thủ ${name} đã tham gia ${player.matches_played} trận đấu. Việc xóa tuyển thủ sẽ giữ lại tên của họ trong lịch sử các trận đấu đã chơi nhưng họ sẽ không còn xuất hiện trên bảng xếp hạng. Bạn có chắc chắn muốn xóa không?`
      : `Bạn có chắc chắn muốn xóa tuyển thủ ${name} khỏi danh sách?`

  if (confirm(message)) {
    await deletePlayer(id)
    showToast(`Đã xóa tuyển thủ ${name}!`)
  }
}

const navigateToHome = (tab: 'leaderboard' | 'matches') => {
  router.push({ path: '/', query: { tab } })
}
</script>

<template>
  <!-- Responsive App Shell -->
  <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-0 md:p-6 font-sans">
    <!-- Phone Screen Container Mockup -->
    <div
      class="w-full md:max-w-md h-screen md:h-[880px] bg-slate-900 shadow-2xl md:rounded-[40px] md:ring-8 md:ring-slate-800 overflow-hidden relative flex flex-col">
      <!-- Top Status Bar Mockup (Desktop only) -->
      <div
        class="hidden md:flex justify-between items-center px-8 pt-4 pb-2 bg-slate-900 text-[11px] font-medium text-slate-400 select-none z-10 shrink-0">
        <span>9:41</span>
        <div class="flex items-center space-x-2">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path
              d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c3.9 3.89 10.21 3.89 14.1 0l1.38-1.79C21.06 16.07 21.8 14.12 21.8 12c0-4.97-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6 0-1.42.49-2.72 1.32-3.75l8.43 10.95c-1.03.83-2.33 1.32-3.75 1.32zm5.1-2.55L8.67 4.5c1.03-.83 2.33-1.32 3.75-1.32 3.31 0 6 2.69 6 6 0 1.42-.49 2.72-1.32 3.75z" />
          </svg>
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 21l-12-12c5-5 14-5 19 0l-7 12zm-3-3l3 3 3-3c-1.5-1.5-4.5-1.5-6 0z" />
          </svg>
          <div class="w-5 h-2.5 border border-slate-400 rounded-xs p-0.5 flex items-center">
            <div class="h-full w-3.5 bg-slate-400 rounded-3xs"></div>
          </div>
        </div>
      </div>

      <!-- App Header -->
      <header
        class="px-5 py-4 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 shrink-0 flex justify-between items-center z-10">
        <div class="flex items-center space-x-2">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-tr from-lime-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-lime-500/20">
            <!-- Users Icon -->
            <svg class="w-5 h-5 text-slate-950 stroke-current" fill="none" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A3.318 3.318 0 0112 22.5c-1.258 0-2.4-.698-3-1.847V19.13M8.25 12h7.5m-7.5 3H12" />
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M18 9a3 3 0 11-6 0 3 3 0 016 0zM6 15a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1
              class="text-sm font-extrabold tracking-tight bg-gradient-to-r from-slate-50 to-slate-200 bg-clip-text text-transparent">
              Quản lý tuyển thủ
            </h1>
            <p class="text-[9px] text-slate-400 font-bold tracking-wide">Danh sách tay vợt câu lạc bộ</p>
          </div>
        </div>

        <button @click="showAddModal = true"
          class="p-2 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 hover:text-lime-300 transition-all border border-lime-500/20 text-xs font-bold flex items-center space-x-1">
          <svg class="w-3.5 h-3.5 stroke-current" fill="none" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Thêm</span>
        </button>
      </header>

      <!-- Main Scrollable Content -->
      <div class="flex-1 overflow-y-auto pb-24 bg-slate-900/20">
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

        <!-- Search and Sort controls -->
        <div class="px-5 pt-4 pb-2 sticky top-0 bg-slate-900/85 backdrop-blur-md z-20 py-2 space-y-3">
          <div class="relative">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              <svg class="w-3.5 h-3.5 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input v-model="searchQuery" type="text" placeholder="Tìm tuyển thủ..."
              class="w-full bg-slate-950/90 text-xs text-slate-200 pl-9 pr-8 py-2.5 rounded-xl border border-slate-800/80 placeholder-slate-500 focus:outline-none focus:border-lime-500/50 transition-colors" />
            <button v-if="searchQuery" @click="searchQuery = ''"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sắp xếp theo</label>
            <div class="relative w-[60%]">
              <select v-model="sortBy"
                class="w-full bg-slate-950 border border-slate-800 text-[9px] font-bold text-slate-350 px-3 py-1.5 rounded-lg appearance-none focus:outline-none focus:border-lime-500/50">
                <option value="name">Tên (A-Z)</option>
                <option value="elo_desc">Elo cao nhất</option>
                <option value="elo_asc">Elo thấp nhất</option>
                <option value="matches_desc">Số trận nhiều nhất</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Players List -->
        <div class="px-5 pt-2 pb-6 space-y-2.5">
          <div v-if="filteredPlayers.length === 0" class="text-center py-12 text-slate-500 text-xs">
            Không tìm thấy tuyển thủ phù hợp
          </div>

          <div v-for="player in filteredPlayers" :key="player._id"
            class="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between hover:border-slate-700/80 transition-all">
            <!-- Avatar & Details -->
            <div class="flex items-center space-x-3 min-w-0">
              <div :class="[
                'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-black text-slate-100 shadow-md shrink-0 uppercase',
                getAvatarGradient(player.name),
              ]">
                {{ getInitials(player.name) }}
              </div>

              <div class="min-w-0">
                <h4 class="text-xs font-bold text-slate-200 truncate pr-1">{{ player.name }}</h4>
                <p class="text-[9px] text-slate-400 mt-0.5">
                  {{ player.matches_played }} trận • Thắng: {{ player.wins }} • Thua: {{ player.losses }}
                </p>
                <p class="text-[8px] text-lime-400 font-semibold">
                  Tỷ lệ thắng:
                  {{
                    player.matches_played > 0
                      ? Math.round((player.wins / player.matches_played) * 100)
                      : 0
                  }}%
                </p>
              </div>
            </div>

            <!-- Score & CRUD Buttons -->
            <div class="flex items-center space-x-3 shrink-0">
              <div class="text-right">
                <span
                  class="inline-block px-2 py-1 rounded-lg bg-slate-950 font-mono text-xs font-black text-lime-400 border border-lime-500/20">
                  {{ player.current_score.toFixed(2) }}
                </span>
                <p class="text-[7px] text-slate-500 font-bold mt-0.5">Elo hiện tại</p>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-col space-y-1.5">
                <button @click="openEditModal(player)"
                  class="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-colors border border-slate-700/50"
                  title="Sửa thông tin">
                  <!-- Edit Icon -->
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.83 20.013a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button @click="handleDeletePlayer(player._id, player.name)"
                  class="p-1 rounded-md bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-colors border border-slate-700/50"
                  title="Xóa tuyển thủ">
                  <!-- Trash Icon -->
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
        class="absolute bottom-0 left-0 right-0 h-[64px] bg-slate-900 border-t border-slate-800/85 backdrop-blur-md flex justify-around items-center px-4 pb-2 z-30 shrink-0">
        <!-- Leaderboard Tab trigger -->
        <button @click="navigateToHome('leaderboard')"
          class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-slate-500 hover:text-slate-300">
          <!-- Trophy Icon -->
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 15v5m-3 0h6M21 8a3 3 0 00-3-3H6a3 3 0 00-3 3v2a3 3 0 003 3h12a3 3 0 003-3V8z" />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Hạng</span>
        </button>

        <!-- Plus Action Button (FAB) -> Opens Add Player Modal on this screen -->
        <button @click="showAddModal = true"
          class="w-11 h-11 rounded-full bg-gradient-to-tr from-lime-400 to-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-lime-500/20 -translate-y-4 hover:scale-110 active:scale-95 transition-all focus:outline-none cursor-pointer">
          <svg class="w-5 h-5 stroke-current" fill="none" stroke-width="3.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        <!-- Players Tab trigger (Active) -->
        <button class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-lime-400 scale-105">
          <!-- Users Icon -->
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A3.318 3.318 0 0112 22.5c-1.258 0-2.4-.698-3-1.847V19.13M8.25 12h7.5m-7.5 3H12" />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Tuyển thủ</span>
        </button>

        <!-- Matches Tab trigger -->
        <button @click="navigateToHome('matches')"
          class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-slate-500 hover:text-slate-300">
          <!-- Tennis ball Activity Feed Icon -->
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Trận đấu</span>
        </button>
      </nav>

      <!-- MODAL A: ADD PLAYER SHEET -->
      <transition enter-active-class="transition duration-300 ease-out" enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0" leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0" leave-to-class="transform translate-y-full">
        <div v-if="showAddModal"
          class="absolute inset-x-0 bottom-0 max-h-[85%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-6">
          <!-- Drag Handle -->
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>

          <!-- Sheet Header -->
          <div class="px-5 pb-3 flex justify-between items-center shrink-0">
            <h2 class="text-sm font-extrabold text-slate-100">Thêm tuyển thủ mới</h2>
            <button @click="showAddModal = false"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Add Form Content -->
          <div class="px-5 space-y-4">
            <!-- Validation error message -->
            <div v-if="formError"
              class="p-2.5 bg-red-950/80 border border-red-500/30 text-red-400 rounded-xl text-2xs font-semibold">
              {{ formError }}
            </div>

            <!-- Player Name -->
            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Họ và tên</label>
              <input v-model="addForm.name" type="text" placeholder="Ví dụ: Nguyễn Văn A"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 placeholder-slate-650 focus:outline-none focus:border-lime-500/50" />
            </div>

            <!-- Initial score / Elo -->
            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Điểm Elo ban đầu</label>
              <input v-model.number="addForm.initial_score" type="number" step="0.1" placeholder="6.0"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 placeholder-slate-650 focus:outline-none focus:border-lime-500/50" />
              <p class="text-[8px] text-slate-500">Mức điểm mặc định thường là 6.0 cho thành viên mới.</p>
            </div>

            <button @click="handleCreatePlayer"
              class="w-full py-3 bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 rounded-xl font-bold text-xs shadow-lg shadow-lime-500/10 active:scale-98 transition-all mt-4">
              Thêm tuyển thủ
            </button>
          </div>
        </div>
      </transition>

      <!-- MODAL B: EDIT PLAYER SHEET -->
      <transition enter-active-class="transition duration-300 ease-out" enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0" leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0" leave-to-class="transform translate-y-full">
        <div v-if="showEditModal"
          class="absolute inset-x-0 bottom-0 max-h-[85%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-6">
          <!-- Drag Handle -->
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>

          <!-- Sheet Header -->
          <div class="px-5 pb-3 flex justify-between items-center shrink-0">
            <h2 class="text-sm font-extrabold text-slate-100">Sửa thông tin tuyển thủ</h2>
            <button @click="showEditModal = false"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Edit Form Content -->
          <div class="px-5 space-y-4">
            <!-- Validation error message -->
            <div v-if="formError"
              class="p-2.5 bg-red-950/80 border border-red-500/30 text-red-400 rounded-xl text-2xs font-semibold">
              {{ formError }}
            </div>

            <!-- Player Name -->
            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Họ và tên</label>
              <input v-model="editForm.name" type="text"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 placeholder-slate-650 focus:outline-none focus:border-lime-500/50" />
            </div>

            <!-- Initial score / Elo -->
            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Điểm Elo ban đầu</label>
              <input v-model.number="editForm.initial_score" type="number" step="0.1"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
            </div>

            <!-- Current score / Elo -->
            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Điểm Elo hiện tại</label>
              <input v-model.number="editForm.current_score" type="number" step="0.01"
                class="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800/80 focus:outline-none focus:border-lime-500/50" />
              <p class="text-[8px] text-slate-500">Cân nhắc kỹ trước khi chỉnh sửa Elo hiện tại để tránh làm lệch kết
                quả tính toán Elo hệ thống.</p>
            </div>

            <button @click="handleUpdatePlayer"
              class="w-full py-3 bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 rounded-xl font-bold text-xs shadow-lg shadow-lime-500/10 active:scale-98 transition-all mt-4">
              Lưu thay đổi
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}
</style>
