<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAvatarGradient, getInitials } from '@/services/format'
import { useLeaderboard } from '@/composables/useLeaderboard'

const route = useRoute()
const router = useRouter()

const {
  players,
  seasons,
  batchNote,
  batchDate,
  batchEntries,
  batchSeasonId,
  batchSuccessData,
  batchError,
  init,
  openBatch,
  toggleBatchOffline,
  submitBatchUpdate,
  getBatchEloPreview,
  getQuarter,
} = useLeaderboard()

onMounted(async () => {
  await init()
  openBatch()

  const seasonParam = route.query.season
  if (typeof seasonParam === 'string') {
    batchSeasonId.value = seasonParam
  }
})

const goHome = () => {
  router.push('/')
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
          <button @click="goHome" class="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="min-w-0">
            <h1 class="text-sm font-extrabold text-slate-100 truncate">Cập nhật Elo theo Buổi</h1>
            <p class="text-[9px] text-slate-400 mt-0.5 truncate">
              Tính theo số trận đã ghi nhận trong ngày
            </p>
          </div>
        </div>
      </header>

      <!-- Main Scrollable Content -->
      <div class="flex-1 overflow-y-auto pb-6 bg-slate-900/20 px-5 pt-4 space-y-4">
        <!-- SUCCESS VIEW -->
        <div v-if="batchSuccessData" class="space-y-5 py-2 text-center">
          <div
            class="w-14 h-14 bg-lime-500/15 border border-lime-500/20 rounded-full flex items-center justify-center mx-auto text-lime-400">
            <svg class="w-7 h-7 stroke-current" fill="none" stroke-width="3" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <div>
            <h3 class="text-base font-black text-slate-100">Đã cập nhật buổi chơi!</h3>
            <p class="text-[10px] text-slate-400 mt-1">{{ batchSuccessData.note }}</p>
            <p class="text-[9px] text-slate-500 mt-0.5">{{ batchSuccessData.quarter }}</p>
          </div>

          <!-- Changes Summary -->
          <div class="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden text-left">
            <div class="px-4 py-2 border-b border-slate-800 flex justify-between">
              <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Người chơi</span>
              <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Biến động Elo</span>
            </div>
            <div v-for="c in batchSuccessData.changes" :key="c.member_id"
              class="px-4 py-2.5 border-b border-slate-900/60 last:border-0 flex justify-between items-center">
              <div class="flex items-center space-x-2">
                <div :class="[
                  'w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[7px] font-black text-white uppercase shrink-0',
                  getAvatarGradient(c.name),
                ]">
                  {{ getInitials(c.name).slice(0, 1) }}
                </div>
                <span class="text-xs font-bold text-slate-200">{{ c.name.split(' ').pop() }}</span>
              </div>
              <div class="font-mono text-xs flex items-center space-x-1.5">
                <span class="text-slate-500 text-[10px]">→ {{ c.elo_after.toFixed(2) }}</span>
                <span :class="[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded',
                  c.elo_gain > 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : c.elo_gain < 0
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-slate-800 text-slate-500',
                ]">
                  {{ c.elo_gain > 0 ? '+' : '' }}{{ c.elo_gain.toFixed(2) }}
                </span>
              </div>
            </div>
          </div>

          <button @click="goHome"
            class="w-full bg-slate-800 text-slate-200 font-bold text-xs py-3.5 rounded-xl hover:bg-slate-700 transition-all border border-slate-700/50 cursor-pointer">
            Hoàn Tất
          </button>
        </div>

        <!-- INPUT FORM VIEW -->
        <div v-else class="space-y-4">
          <!-- Date & Note fields -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Ngày diễn
                ra</label>
              <input v-model="batchDate" type="date"
                class="w-full bg-slate-950 text-[10px] text-slate-200 px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-lime-500/50 transition-colors" />
            </div>
            <div>
              <label class="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Ghi chú
                buổi</label>
              <input v-model="batchNote" type="text" placeholder="VD: Buổi 1 - Khai mạc Q3"
                class="w-full bg-slate-950 text-[10px] text-slate-200 px-3 py-2 rounded-xl border border-slate-800 placeholder-slate-600 focus:outline-none focus:border-lime-500/50 transition-colors" />
            </div>
          </div>

          <!-- Quarter Preview -->
          <div class="flex items-center space-x-2 px-3 py-2 bg-lime-500/5 border border-lime-500/15 rounded-xl">
            <svg class="w-3 h-3 text-lime-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <span class="text-[9px] text-lime-400 font-bold">Quý: {{ getQuarter(batchDate) }}</span>
          </div>

          <!-- Season selector -->
          <div>
            <label class="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Mùa
              giải</label>
            <select v-model="batchSeasonId"
              class="w-full bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-200 px-3 py-2 rounded-xl appearance-none focus:outline-none focus:border-lime-500/50">
              <option :value="null">Không thuộc mùa giải nào</option>
              <option v-for="season in seasons" :key="season._id" :value="season._id">
                {{ season.name }}
              </option>
            </select>
          </div>

          <!-- Divider -->
          <div class="flex items-center space-x-3">
            <div class="flex-1 h-px bg-slate-800"></div>
            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Kết quả từng người</span>
            <div class="flex-1 h-px bg-slate-800"></div>
          </div>

          <!-- ELO Info badge -->
          <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] text-slate-500 font-semibold">
            <span class="flex items-center space-x-1">
              <span class="inline-block w-2 h-2 rounded-full bg-lime-500"></span>
              <span>Mỗi trận thắng/thua = ±0.25 Elo</span>
            </span>
            <span class="text-slate-700">·</span>
            <span class="flex items-center space-x-1">
              <span class="inline-block w-2 h-2 rounded-full bg-slate-600"></span>
              <span>Offline = −0.25</span>
            </span>
          </div>

          <!-- Player Entries Grid -->
          <div class="space-y-2">
            <div v-for="entry in batchEntries" :key="entry.player_id" :class="[
              'border rounded-xl p-3 transition-all',
              entry.offline
                ? 'bg-slate-950/50 border-slate-700/30 opacity-60'
                : 'bg-slate-950 border-slate-800/60',
            ]">
              <div class="flex items-center justify-between">
                <!-- Player info -->
                <div class="flex items-center space-x-2 min-w-0">
                  <div :class="[
                    'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[8px] font-black text-white uppercase shrink-0 transition-all',
                    getAvatarGradient(players.find((p) => p._id === entry.player_id)?.name || ''),
                    entry.offline ? 'grayscale opacity-50' : '',
                  ]">
                    {{ getInitials(players.find((p) => p._id === entry.player_id)?.name || '').slice(0, 1) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-[10px] font-bold text-slate-200 truncate">
                      {{ players.find((p) => p._id === entry.player_id)?.name.split(' ').pop() }}
                    </p>
                    <p class="text-[8px] font-mono">
                      <span class="text-slate-500">Elo:
                        {{ players.find((p) => p._id === entry.player_id)?.current_score.toFixed(2) }}</span>
                      <span :class="[
                        'ml-1 font-bold transition-all',
                        getBatchEloPreview(entry) > 0
                          ? 'text-emerald-400'
                          : getBatchEloPreview(entry) < 0
                            ? 'text-red-400'
                            : 'text-slate-500',
                      ]">
                        {{ getBatchEloPreview(entry) >= 0 ? '+' : '' }}{{ getBatchEloPreview(entry).toFixed(2) }}
                        <span v-if="entry.offline" class="text-slate-500 ml-0.5">(offline)</span>
                      </span>
                    </p>
                  </div>
                </div>

                <!-- Read-only stats + offline toggle -->
                <div class="flex items-center space-x-3 shrink-0">
                  <!-- Trận / Thắng / Thua (read-only, derived from recorded matches) -->
                  <div v-if="!entry.offline" class="flex items-center space-x-2.5">
                    <div class="flex flex-col items-center space-y-0.5">
                      <span class="text-[7px] font-bold text-slate-500 uppercase tracking-wide">Trận</span>
                      <span class="text-[11px] font-black text-slate-300 w-5 text-center">{{ entry.games_played }}</span>
                    </div>
                    <div class="flex flex-col items-center space-y-0.5">
                      <span class="text-[7px] font-bold text-slate-500 uppercase tracking-wide">Thắng</span>
                      <span class="text-[11px] font-black text-emerald-400 w-5 text-center">{{ entry.wins }}</span>
                    </div>
                    <div class="flex flex-col items-center space-y-0.5">
                      <span class="text-[7px] font-bold text-slate-500 uppercase tracking-wide">Thua</span>
                      <span class="text-[11px] font-black text-red-400 w-5 text-center">{{
                        entry.games_played - entry.wins }}</span>
                    </div>
                  </div>

                  <!-- Offline penalty label -->
                  <div v-else
                    class="text-[9px] font-bold text-red-400/70 bg-red-500/5 border border-red-500/15 px-2 py-1 rounded-lg">
                    −0.25
                  </div>

                  <!-- Offline toggle checkbox -->
                  <label class="flex items-center space-x-1.5 cursor-pointer group">
                    <span
                      class="text-[8px] text-slate-500 group-hover:text-slate-300 transition-colors font-bold uppercase">Off</span>
                    <div @click="toggleBatchOffline(entry.player_id)" :class="[
                      'w-8 h-4 rounded-full border transition-all cursor-pointer relative',
                      entry.offline ? 'bg-red-500/20 border-red-500/40' : 'bg-slate-800 border-slate-700',
                    ]">
                      <div :class="[
                        'absolute top-0.5 w-3 h-3 rounded-full transition-all',
                        entry.offline ? 'left-4 bg-red-400' : 'left-0.5 bg-slate-500',
                      ]"></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Box -->
          <div v-if="batchError"
            class="bg-red-950/40 border border-red-500/20 text-red-400 text-[10px] font-semibold px-4 py-3 rounded-xl flex items-center space-x-2">
            <svg class="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <span>{{ batchError }}</span>
          </div>

          <!-- Submit Button -->
          <button @click="submitBatchUpdate"
            class="w-full bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 font-extrabold text-xs py-3.5 rounded-xl hover:opacity-95 active:scale-[0.98] transition-all shadow-lg shadow-lime-500/10 focus:outline-none cursor-pointer">
            Xác Nhận &amp; Cập Nhật Elo
          </button>
        </div>
      </div>

      <!-- App Bottom Tab Bar -->
      <nav
        class="h-[64px] bg-slate-900 border-t border-slate-800/85 backdrop-blur-md flex justify-around items-center px-4 pb-2 z-30 shrink-0">
        <button @click="router.push({ path: '/', query: { tab: 'leaderboard' } })"
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

        <button @click="router.push('/seasons')"
          class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-slate-500 hover:text-slate-300">
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Mùa giải</span>
        </button>
      </nav>
    </div>
  </div>
</template>
