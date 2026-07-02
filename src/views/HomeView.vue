<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// --- TS Interfaces ---
interface Player {
  _id: string
  name: string
  current_score: number
  initial_score: number
  created_at: string
  matches_played: number
  wins: number
  losses: number
  history: number[]
}

interface MatchRecord {
  id: string
  // Supports both singles (1 player) and doubles (2 players)
  winner_ids: string[]
  winner_names: string[]
  loser_ids: string[]
  loser_names: string[]
  score: string
  elo_change: number
  played_at: string
  // Legacy compat fields (single string)
  winner_id?: string
  winner_name?: string
  loser_id?: string
  loser_name?: string
}

// --- Constants ---
const LOCAL_STORAGE_PLAYERS_KEY = 'tennis_elo_players_v1'
const LOCAL_STORAGE_MATCHES_KEY = 'tennis_elo_matches_v1'
const LOCAL_STORAGE_SESSIONS_KEY = 'tennis_elo_sessions_v1'

const DEFAULT_PLAYERS: Player[] = [
  {
    _id: 'p01',
    name: 'Quang',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
  {
    _id: 'p02',
    name: 'Tuyển',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
  {
    _id: 'p03',
    name: 'Khánh',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
  {
    _id: 'p04',
    name: 'Hoàng',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
  {
    _id: 'p05',
    name: 'Hiếu',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
  {
    _id: 'p06',
    name: 'Giang',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
  {
    _id: 'p07',
    name: 'Tùng',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
  {
    _id: 'p08',
    name: 'Long',
    current_score: 6.0,
    initial_score: 6.0,
    created_at: '2026-07-01T00:00:00.000Z',
    matches_played: 0,
    wins: 0,
    losses: 0,
    history: [6.0],
  },
]

const DEFAULT_MATCHES: MatchRecord[] = []

// --- Reactive State ---
const players = ref<Player[]>([])
const matches = ref<MatchRecord[]>([])
const currentTab = ref<'leaderboard' | 'matches'>('leaderboard')

// Filters and Sorts
const searchQuery = ref('')
const filterGroup = ref<'all' | 'high' | 'mid' | 'low'>('all')
const sortBy = ref<'rank_desc' | 'rank_asc' | 'name' | 'improvement'>('rank_desc')

// Modals State
const showAddMatchModal = ref(false)
const showDetailModal = ref(false)
const showBatchModal = ref(false)
const activePlayer = ref<Player | null>(null)

// Batch Update State
const batchNote = ref('')
const batchDate = ref(new Date().toISOString().slice(0, 10))
const batchEntries = ref<BatchPlayerEntry[]>([])
const batchSuccessData = ref<BatchSession | null>(null)
const batchError = ref('')

// Add Match Form — supports singles & doubles
const winnerIds = ref<string[]>([])
const loserIds = ref<string[]>([])
const setScore = ref('6-4')
const formError = ref('')

// --- Batch Session Interfaces ---
interface BatchSessionChange {
  member_id: string
  name: string
  elo_gain: number
  elo_after: number
}

interface BatchSession {
  _id: string
  date: string
  quarter: string
  note: string
  changes: BatchSessionChange[]
}

interface BatchPlayerEntry {
  player_id: string
  wins: number   // 0–2 (total matches per session = 2, losses = 2 - wins)
  offline: boolean  // if true: flat -0.25, no match counted
}

interface PlayerEloChange {
  name: string
  oldElo: number
  newElo: number
}
const matchSuccessData = ref<{
  winners: PlayerEloChange[]
  losers: PlayerEloChange[]
  change: number
} | null>(null)

// Toggle a player in the winner/loser selection (max 2 per side)
const toggleWinner = (id: string) => {
  const idx = winnerIds.value.indexOf(id)
  if (idx === -1) {
    if (winnerIds.value.length < 2) winnerIds.value.push(id)
  } else {
    winnerIds.value.splice(idx, 1)
  }
}
const toggleLoser = (id: string) => {
  const idx = loserIds.value.indexOf(id)
  if (idx === -1) {
    if (loserIds.value.length < 2) loserIds.value.push(id)
  } else {
    loserIds.value.splice(idx, 1)
  }
}

// Hovered chart point in details modal
const hoveredChartPoint = ref<{ x: number; y: number; val: number; idx: number } | null>(null)

// --- Initialization ---
onMounted(() => {
  if (route.query.tab === 'matches') {
    currentTab.value = 'matches'
  } else if (route.query.tab === 'leaderboard') {
    currentTab.value = 'leaderboard'
  }

  const cachedPlayers = localStorage.getItem(LOCAL_STORAGE_PLAYERS_KEY)
  const cachedMatches = localStorage.getItem(LOCAL_STORAGE_MATCHES_KEY)

  if (cachedPlayers) {
    players.value = JSON.parse(cachedPlayers)
  } else {
    players.value = [...DEFAULT_PLAYERS]
    localStorage.setItem(LOCAL_STORAGE_PLAYERS_KEY, JSON.stringify(DEFAULT_PLAYERS))
  }

  if (cachedMatches) {
    matches.value = JSON.parse(cachedMatches)
  } else {
    matches.value = [...DEFAULT_MATCHES]
    localStorage.setItem(LOCAL_STORAGE_MATCHES_KEY, JSON.stringify(DEFAULT_MATCHES))
  }
})

// --- Actions & Methods ---
const saveToLocalStorage = () => {
  localStorage.setItem(LOCAL_STORAGE_PLAYERS_KEY, JSON.stringify(players.value))
  localStorage.setItem(LOCAL_STORAGE_MATCHES_KEY, JSON.stringify(matches.value))
}

const resetToDefault = () => {
  if (
    confirm(
      'Bạn có chắc muốn đặt lại dữ liệu mặc định ban đầu không? Toàn bộ lịch sử thêm mới sẽ bị xóa.',
    )
  ) {
    players.value = JSON.parse(JSON.stringify(DEFAULT_PLAYERS))
    matches.value = JSON.parse(JSON.stringify(DEFAULT_MATCHES))
    saveToLocalStorage()
    showDetailModal.value = false
    showAddMatchModal.value = false
  }
}

// Compute initials for avatar (e.g. Nguyễn Văn Hùng -> NVH, Lê Hoàng Nam -> LHN)
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return ''
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  const first = parts[0][0] || ''
  const middle = parts[parts.length - 2]?.[0] || ''
  const last = parts[parts.length - 1]?.[0] || ''
  return (first + middle + last).toUpperCase()
}

// Deterministic Avatar Gradient Class
const getAvatarGradient = (name: string) => {
  const colors = [
    'from-blue-600 to-indigo-750',
    'from-emerald-500 to-teal-600',
    'from-purple-600 to-pink-600',
    'from-amber-500 to-orange-605',
    'from-cyan-500 to-blue-600',
    'from-rose-500 to-pink-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % colors.length
  return colors[idx]
}

// Helper for formatted joined date
const formatDate = (isoString: string) => {
  const d = new Date(isoString)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Format relative date for recent matches (e.g. "2 giờ trước", "Hôm qua")
const formatRelativeDate = (isoString: string) => {
  const d = new Date(isoString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - d.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffTime / (1000 * 60))
      return diffMins <= 1 ? 'Vừa xong' : `${diffMins} phút trước`
    }
    return `${diffHours} giờ trước`
  }
  if (diffDays === 1) return 'Hôm qua'
  if (diffDays < 7) return `${diffDays} ngày trước`
  return formatDate(isoString)
}

// Elo formulas and Match registration (supports singles & doubles)
const submitMatch = () => {
  formError.value = ''

  if (winnerIds.value.length === 0 || loserIds.value.length === 0) {
    formError.value = 'Vui lòng chọn ít nhất 1 người thắng và 1 người thua.'
    return
  }

  // Check team sizes match (1v1 or 2v2 only)
  if (winnerIds.value.length !== loserIds.value.length) {
    formError.value = `Số người mỗi đội phải bằng nhau (hiện tại: ${winnerIds.value.length} thắng vs ${loserIds.value.length} thua).`
    return
  }

  // Check overlap between teams
  const overlap = winnerIds.value.some((id) => loserIds.value.includes(id))
  if (overlap) {
    formError.value = 'Cùng 1 người không thể vừa thắng vừa thua.'
    return
  }

  // Resolve player objects
  const winnerPlayers = winnerIds.value
    .map((id) => players.value.find((p) => p._id === id))
    .filter(Boolean) as Player[]
  const loserPlayers = loserIds.value
    .map((id) => players.value.find((p) => p._id === id))
    .filter(Boolean) as Player[]

  if (
    winnerPlayers.length !== winnerIds.value.length ||
    loserPlayers.length !== loserIds.value.length
  ) {
    formError.value = 'Không tìm thấy thông tin kỳ thủ.'
    return
  }

  // // --- Thuật toán Elo xác suất (tạm comment) ---
  // const avgWinnerElo = winnerPlayers.reduce((s, p) => s + p.current_score, 0) / winnerPlayers.length
  // const avgLoserElo = loserPlayers.reduce((s, p) => s + p.current_score, 0) / loserPlayers.length
  // const ratingDiff = avgLoserElo - avgWinnerElo
  // const expectedWinner = 1 / (1 + Math.pow(10, ratingDiff / 2.0))
  // const K = 0.2
  // const rawChange = K * (1 - expectedWinner)
  // const eloChange = Math.max(0.02, Math.round(rawChange * 100) / 100)

  // Thuật toán tạm: thắng +0.25, thua -0.25
  const eloChange = 0.25

  // Snapshot old Elos for success display
  const winnersBefore: PlayerEloChange[] = winnerPlayers.map((p) => ({
    name: p.name,
    oldElo: p.current_score,
    newElo: 0,
  }))
  const losersBefore: PlayerEloChange[] = loserPlayers.map((p) => ({
    name: p.name,
    oldElo: p.current_score,
    newElo: 0,
  }))

  // Apply Elo changes — each player gets full change (not split)
  winnerPlayers.forEach((p) => {
    p.current_score = Math.round((p.current_score + eloChange) * 100) / 100
    p.matches_played += 1
    p.wins += 1
    p.history.push(p.current_score)
  })
  loserPlayers.forEach((p) => {
    p.current_score = Math.round(Math.max(5.0, p.current_score - eloChange) * 100) / 100
    p.matches_played += 1
    p.losses += 1
    p.history.push(p.current_score)
  })

  // Fill newElo after update
  winnersBefore.forEach((w, i) => {
    w.newElo = winnerPlayers[i]!.current_score
  })
  losersBefore.forEach((l, i) => {
    l.newElo = loserPlayers[i]!.current_score
  })

  // Save new Match record
  const newMatch: MatchRecord = {
    id: 'm_' + Date.now(),
    winner_ids: winnerPlayers.map((p) => p._id),
    winner_names: winnerPlayers.map((p) => p.name),
    loser_ids: loserPlayers.map((p) => p._id),
    loser_names: loserPlayers.map((p) => p.name),
    score: setScore.value,
    elo_change: eloChange,
    played_at: new Date().toISOString(),
  }

  matches.value.unshift(newMatch)
  saveToLocalStorage()

  matchSuccessData.value = { winners: winnersBefore, losers: losersBefore, change: eloChange }

  // Reset selections
  winnerIds.value = []
  loserIds.value = []
}

const closeAddMatchModal = () => {
  showAddMatchModal.value = false
  matchSuccessData.value = null
  formError.value = ''
  winnerIds.value = []
  loserIds.value = []
}

// Player details modal actions
const openPlayerDetails = (player: Player) => {
  activePlayer.value = player
  hoveredChartPoint.value = null
  showDetailModal.value = true
}

// --- Batch Update Logic ---
const MATCHES_PER_SESSION = 2  // Tổng số trận mỗi buổi (cố định)
const OFFLINE_PENALTY = 0.25   // Phạt offline trực tiếp

const openBatchModal = () => {
  // Initialize entries for every player
  batchEntries.value = players.value.map((p) => ({
    player_id: p._id,
    wins: 0,
    offline: false,
  }))
  batchNote.value = ''
  batchDate.value = new Date().toISOString().slice(0, 10)
  batchError.value = ''
  batchSuccessData.value = null
  showBatchModal.value = true
}

const closeBatchModal = () => {
  showBatchModal.value = false
  batchSuccessData.value = null
  batchError.value = ''
}

const getQuarter = (dateStr: string): string => {
  const d = new Date(dateStr)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

// Helper: tính elo delta preview cho 1 entry
const getBatchEloPreview = (entry: BatchPlayerEntry): number => {
  if (entry.offline) return -OFFLINE_PENALTY
  const losses = MATCHES_PER_SESSION - entry.wins
  return Math.round((entry.wins * 0.25 - losses * 0.25) * 100) / 100
}

const submitBatchUpdate = () => {
  batchError.value = ''

  const hasAnyEntry = batchEntries.value.some((e) => e.offline || e.wins > 0)
  if (!hasAnyEntry) {
    batchError.value = 'Vui lòng nhập kết quả cho ít nhất 1 người (hoặc đánh dấu offline).'
    return
  }

  const eloPerMatch = 0.25
  const sessionDate = new Date(batchDate.value).toISOString()
  const quarter = getQuarter(batchDate.value)
  const sessionId = 'session_' + Date.now()

  const changes: BatchSessionChange[] = []

  batchEntries.value.forEach((entry) => {
    const player = players.value.find((p) => p._id === entry.player_id)
    if (!player) return

    let eloGain: number
    let newScore: number

    if (entry.offline) {
      // Offline: trừ thẳng 0.25, không tính trận
      eloGain = -OFFLINE_PENALTY
      newScore = Math.round(Math.max(5.0, player.current_score + eloGain) * 100) / 100
      player.current_score = newScore
      player.history.push(newScore)
    } else {
      // Chỉ xử lý nếu đã đánh (wins > 0 hoặc mặc định 0 thắng = 2 thua)
      // Bỏ qua nếu người này không tham gia (wins = 0 và không offline)
      // => Để tính: wins=0 nghĩa là thua cả 2 trận
      // Nhưng ta chỉ tính cho người nào được chủ động nhập (offline = false, wins có thể = 0)
      // Quyết định: chỉ tính những người KHÔNG offline và đang tham gia buổi
      // => Nếu wins = 0 và offline = false: người đó thua 2 trận
      const losses = MATCHES_PER_SESSION - entry.wins
      eloGain = Math.round((entry.wins * eloPerMatch - losses * eloPerMatch) * 100) / 100
      newScore = Math.round(Math.max(5.0, player.current_score + eloGain) * 100) / 100
      player.current_score = newScore
      player.matches_played += MATCHES_PER_SESSION
      player.wins += entry.wins
      player.losses += losses
      player.history.push(newScore)
    }

    changes.push({
      member_id: player._id,
      name: player.name,
      elo_gain: eloGain,
      elo_after: newScore,
    })
  })

  const newSession: BatchSession = {
    _id: sessionId,
    date: sessionDate,
    quarter,
    note: batchNote.value || `Buổi chơi ${new Date(batchDate.value).toLocaleDateString('vi-VN')}`,
    changes,
  }

  // Save session to localStorage
  const existingSessions: BatchSession[] = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY) || '[]',
  )
  existingSessions.unshift(newSession)
  localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(existingSessions))

  // Save updated players
  saveToLocalStorage()

  batchSuccessData.value = newSession
}

// --- Computed Values ---

// Overview statistics for top hero card
const statsHero = computed(() => {
  if (players.value.length === 0) return { total: 0, avgElo: '0.00', totalMatches: 0 }
  const total = players.value.length
  const sumElo = players.value.reduce((sum, p) => sum + p.current_score, 0)
  const avgElo = (sumElo / total).toFixed(2)
  const totalMatches = matches.value.length
  return { total, avgElo, totalMatches }
})

// Sorted and Filtered Players List
const filteredPlayers = computed(() => {
  let result = [...players.value]

  // Apply search
  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter((p) => p.name.toLowerCase().includes(q))
  }

  // Apply filter bracket
  if (filterGroup.value === 'high') {
    result = result.filter((p) => p.current_score >= 7.0)
  } else if (filterGroup.value === 'mid') {
    result = result.filter((p) => p.current_score >= 6.0 && p.current_score < 7.0)
  } else if (filterGroup.value === 'low') {
    result = result.filter((p) => p.current_score < 6.0)
  }

  // Sort
  if (sortBy.value === 'rank_desc') {
    // Highest Elo first (Default rank order)
    result.sort((a, b) => b.current_score - a.current_score)
  } else if (sortBy.value === 'rank_asc') {
    // Lowest Elo first
    result.sort((a, b) => a.current_score - b.current_score)
  } else if (sortBy.value === 'name') {
    // Alphabetical
    result.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  } else if (sortBy.value === 'improvement') {
    // Highest rating improvement first
    result.sort((a, b) => {
      const impA = a.current_score - a.initial_score
      const impB = b.current_score - b.initial_score
      return impB - impA
    })
  }

  return result
})

// Sorted Player List to calculate ranking indexes accurately
const rankedPlayersList = computed(() => {
  return [...players.value].sort((a, b) => b.current_score - a.current_score)
})

const getPlayerRank = (playerId: string) => {
  const index = rankedPlayersList.value.findIndex((p) => p._id === playerId)
  return index !== -1 ? index + 1 : 0
}

// Retrieve specific player match history (supports both legacy and new array format)
const playerMatchHistory = computed(() => {
  if (!activePlayer.value) return []
  const id = activePlayer.value._id
  return matches.value.filter((m) => {
    // New format
    if (m.winner_ids) return m.winner_ids.includes(id) || m.loser_ids.includes(id)
    // Legacy compat
    return m.winner_id === id || m.loser_id === id
  })
})

// Helper to get winner/loser names from a match (handles both formats)
const getMatchWinnerNames = (m: MatchRecord) => m.winner_names?.join(' & ') ?? m.winner_name ?? ''
const getMatchLoserNames = (m: MatchRecord) => m.loser_names?.join(' & ') ?? m.loser_name ?? ''
const isPlayerWinner = (m: MatchRecord, playerId: string) =>
  m.winner_ids ? m.winner_ids.includes(playerId) : m.winner_id === playerId

// SVG Chart Path Calculations
const chartPoints = computed(() => {
  if (!activePlayer.value || !activePlayer.value.history || activePlayer.value.history.length === 0)
    return []

  const history = activePlayer.value.history
  const N = history.length

  if (N === 1) {
    const val = history[0] ?? activePlayer.value.current_score
    return [{ x: 200, y: 75, val }]
  }

  const minVal = Math.min(...history) - 0.05
  const maxVal = Math.max(...history) + 0.05
  const range = maxVal - minVal || 1

  return history.map((val, idx) => {
    // Chart dimensions are width: 400, height: 150. Add horizontal padding of 20px
    const x = (idx / (N - 1)) * 360 + 20
    // vertical range is 120px, with padding-top 15px
    const y = 145 - ((val - minVal) / range) * 115 - 10
    return { x, y, val }
  })
})

const svgLinePath = computed(() => {
  const points = chartPoints.value
  if (points.length === 0) return ''
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M ${first.x - 10} ${first.y} L ${first.x + 10} ${first.y}`
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
})

const svgAreaPath = computed(() => {
  const points = chartPoints.value
  if (points.length <= 1) return ''
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return ''
  const linePart = svgLinePath.value
  // Close the shape by extending line path to bottom edges
  return `${linePart} L ${last.x} 145 L ${first.x} 145 Z`
})
</script>

<template>
  <!-- Responsive App Shell: Centered Phone Frame on Desktop, Full Bleed on Mobile -->
  <div
    class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-0 md:p-6 font-sans"
  >
    <!-- Phone Screen Container Mockup -->
    <div
      class="w-full md:max-w-md h-screen md:h-[880px] bg-slate-900 shadow-2xl md:rounded-[40px] md:ring-8 md:ring-slate-800 overflow-hidden relative flex flex-col"
    >
      <!-- Top Status Bar Mockup (Only visible on desktop/rounded container to look super native) -->
      <div
        class="hidden md:flex justify-between items-center px-8 pt-4 pb-2 bg-slate-900 text-[11px] font-medium text-slate-400 select-none z-10 shrink-0"
      >
        <span>9:41</span>
        <div class="flex items-center space-x-2">
          <!-- Signal Icon -->
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path
              d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c3.9 3.89 10.21 3.89 14.1 0l1.38-1.79C21.06 16.07 21.8 14.12 21.8 12c0-4.97-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6 0-1.42.49-2.72 1.32-3.75l8.43 10.95c-1.03.83-2.33 1.32-3.75 1.32zm5.1-2.55L8.67 4.5c1.03-.83 2.33-1.32 3.75-1.32 3.31 0 6 2.69 6 6 0 1.42-.49 2.72-1.32 3.75z"
            />
          </svg>
          <!-- Wifi Icon -->
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 21l-12-12c5-5 14-5 19 0l-7 12zm-3-3l3 3 3-3c-1.5-1.5-4.5-1.5-6 0z" />
          </svg>
          <!-- Battery Icon -->
          <div class="w-5 h-2.5 border border-slate-400 rounded-xs p-0.5 flex items-center">
            <div class="h-full w-3.5 bg-slate-400 rounded-3xs"></div>
          </div>
        </div>
      </div>

      <!-- App Header -->
      <header
        class="px-5 py-4 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 shrink-0 flex justify-between items-center z-10"
      >
        <div class="flex items-center space-x-2">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-tr from-lime-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-lime-500/20"
          >
            <!-- Tennis Ball SVG -->
            <svg class="w-5 h-5 text-slate-950 fill-current" viewBox="0 0 24 24">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H9v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 1.84-.62 3.53-1.65 4.93z"
              />
            </svg>
          </div>
          <div>
            <h1
              class="text-sm font-extrabold tracking-tight bg-gradient-to-r from-slate-50 to-slate-200 bg-clip-text text-transparent"
            >
              BangLang Tennis Club
            </h1>
            <p class="text-[9px] text-slate-400 font-bold tracking-wide">Since 2024</p>
          </div>
        </div>
        <!-- Header Action Buttons -->
        <div class="flex items-center space-x-2">
          <!-- Batch Update Button -->
          <button
            @click="openBatchModal"
            class="p-2 rounded-lg bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 hover:text-lime-300 transition-all border border-lime-500/20"
            title="Cập nhật Elo hàng loạt theo buổi"
          >
            <!-- Calendar/batch icon -->
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </button>

          <!-- Reset DB Action Button -->
          <button
            @click="resetToDefault"
            class="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-855 text-slate-400 hover:text-red-400 transition-all border border-slate-800/50"
            title="Đặt lại dữ liệu mặc định"
          >
            <!-- Refresh Icon -->
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"
              />
            </svg>
          </button>
        </div>
      </header>

      <!-- Main Scrollable Content Box -->
      <div class="flex-1 overflow-y-auto pb-24 bg-slate-900/20">
        <!-- Hero Stats Cards Slider -->
        <div class="px-5 pt-5 pb-2">
          <div
            class="bg-gradient-to-br from-slate-850 to-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-xl relative overflow-hidden"
          >
            <!-- Decorative Tennis Ball Graphic background -->
            <div
              class="absolute -right-8 -bottom-8 opacity-[0.03] text-lime-400 w-36 h-36 pointer-events-none"
            >
              <svg fill="currentColor" viewBox="0 0 24 24" class="w-full h-full">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"
                />
              </svg>
            </div>

            <div class="grid grid-cols-3 divide-x divide-slate-800 text-center relative z-10">
              <div>
                <span class="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider"
                  >Tay Vợt</span
                >
                <p class="text-lg font-black text-lime-400 mt-1">{{ statsHero.total }}</p>
              </div>
              <div>
                <span class="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider"
                  >Elo TB</span
                >
                <p class="text-lg font-black text-slate-50 mt-1">{{ statsHero.avgElo }}</p>
              </div>
              <div>
                <span class="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider"
                  >Tổng Trận</span
                >
                <p class="text-lg font-black text-slate-50 mt-1">{{ statsHero.totalMatches }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- View Controls: Tabs, Search Bar, Filters -->
        <div class="px-5 pt-3 sticky top-0 bg-slate-900/85 backdrop-blur-md z-20 py-2">
          <!-- Search & Filter Controls -->
          <div v-show="currentTab === 'leaderboard'" class="space-y-3">
            <!-- Search bar -->
            <div class="relative">
              <span
                class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500"
              >
                <svg
                  class="w-3.5 h-3.5 fill-none stroke-current"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Tìm kiếm tay vợt..."
                class="w-full bg-slate-950/90 text-xs text-slate-200 pl-9 pr-8 py-2.5 rounded-xl border border-slate-800/80 placeholder-slate-500 focus:outline-none focus:border-lime-500/50 transition-colors"
              />
              <button
                v-if="searchQuery"
                @click="searchQuery = ''"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
              >
                <!-- Close icon -->
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Sorting & Filters row -->
            <div class="flex items-center justify-between space-x-2">
              <!-- Filter Dropdown Group (Simple buttons for quick taps) -->
              <div class="flex space-x-1 overflow-x-auto no-scrollbar scroll-smooth py-1 w-[55%]">
                <button
                  v-for="grp in [
                    { id: 'all', label: 'Tất cả' },
                    { id: 'high', label: 'Top' },
                    { id: 'mid', label: 'Trung' },
                    { id: 'low', label: 'F0' },
                  ]"
                  :key="grp.id"
                  @click="filterGroup = grp.id as any"
                  :class="[
                    'text-[9px] font-bold px-2.5 py-1.5 rounded-lg border transition-all shrink-0',
                    filterGroup === grp.id
                      ? 'bg-lime-500 border-lime-500 text-slate-950 shadow-md shadow-lime-500/10'
                      : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:text-slate-200',
                  ]"
                >
                  {{ grp.label }}
                </button>
              </div>

              <!-- Sorting Select -->
              <div class="relative w-[43%]">
                <span
                  class="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400"
                >
                  <svg
                    class="w-3 h-3 fill-none stroke-current"
                    stroke-width="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                    />
                  </svg>
                </span>
                <select
                  v-model="sortBy"
                  class="w-full bg-slate-950 border border-slate-800 text-[9px] font-bold text-slate-350 pl-8 pr-2 py-1.5 rounded-lg appearance-none focus:outline-none focus:border-lime-500/50"
                >
                  <option value="rank_desc">Hạng cao nhất</option>
                  <option value="rank_asc">Hạng thấp nhất</option>
                  <option value="name">Tên (A-Z)</option>
                  <option value="improvement">Tiến bộ tốt nhất</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Leaderboard List Tab -->
        <div v-show="currentTab === 'leaderboard'" class="px-5 pt-2 pb-6 space-y-2.5">
          <div v-if="filteredPlayers.length === 0" class="text-center py-12 text-slate-500 text-xs">
            Không tìm thấy tay vợt phù hợp
          </div>

          <div
            v-for="player in filteredPlayers"
            :key="player._id"
            @click="openPlayerDetails(player)"
            class="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-slate-700/80 active:bg-slate-800/30 transition-all"
          >
            <!-- Rank & Avatar & Info -->
            <div class="flex items-center space-x-3 min-w-0">
              <!-- Rank badge/number -->
              <div class="w-6 text-center font-extrabold text-xs shrink-0">
                <span v-if="getPlayerRank(player._id) === 1" class="text-lg">🥇</span>
                <span v-else-if="getPlayerRank(player._id) === 2" class="text-lg">🥈</span>
                <span v-else-if="getPlayerRank(player._id) === 3" class="text-lg">🥉</span>
                <span v-else class="text-slate-500">#{{ getPlayerRank(player._id) }}</span>
              </div>

              <!-- Avatar with dynamic gradient -->
              <div
                :class="[
                  'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-black text-slate-100 shadow-md shrink-0 uppercase',
                  getAvatarGradient(player.name),
                ]"
              >
                {{ getInitials(player.name) }}
              </div>

              <!-- Name & Matches -->
              <div class="min-w-0">
                <h4 class="text-xs font-bold text-slate-200 truncate pr-1">{{ player.name }}</h4>
                <p class="text-[9px] text-slate-400 mt-0.5">
                  {{ player.matches_played }} trận • Tỷ lệ thắng:
                  {{
                    player.matches_played > 0
                      ? Math.round((player.wins / player.matches_played) * 100)
                      : 0
                  }}%
                </p>
              </div>
            </div>

            <!-- Elo Score and Trend -->
            <div class="text-right shrink-0">
              <span
                class="inline-block px-2 py-1 rounded-lg bg-slate-950 font-mono text-xs font-black text-lime-400 border border-lime-500/20"
              >
                {{ player.current_score.toFixed(2) }}
              </span>

              <div class="flex items-center justify-end text-[9px] mt-1 font-bold">
                <span
                  v-if="player.current_score > player.initial_score"
                  class="text-emerald-400 flex items-center"
                >
                  <svg class="w-2.5 h-2.5 mr-0.5 fill-current" viewBox="0 0 24 24">
                    <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
                  </svg>
                  +{{ (player.current_score - player.initial_score).toFixed(2) }}
                </span>
                <span
                  v-else-if="player.current_score < player.initial_score"
                  class="text-red-400 flex items-center"
                >
                  <svg class="w-2.5 h-2.5 mr-0.5 fill-current" viewBox="0 0 24 24">
                    <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
                  </svg>
                  {{ (player.current_score - player.initial_score).toFixed(2) }}
                </span>
                <span v-else class="text-slate-500">0.00</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Match History List Tab -->
        <div v-show="currentTab === 'matches'" class="px-5 pt-4 pb-6 space-y-3">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
              Lịch sử kết quả
            </h3>
            <span class="text-[9px] text-slate-500 font-bold">Mới nhất trước</span>
          </div>

          <div v-if="matches.length === 0" class="text-center py-12 text-slate-500 text-xs">
            Chưa có trận đấu nào được ghi nhận.
          </div>

          <div
            v-for="match in matches"
            :key="match.id"
            class="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 flex flex-col space-y-2 relative overflow-hidden"
          >
            <!-- Background indicator gradient -->
            <div class="absolute top-0 bottom-0 left-0 w-1 bg-lime-500"></div>

            <div class="flex justify-between items-start pl-1">
              <div class="space-y-1">
                <!-- Winner Line -->
                <div class="flex items-center space-x-2">
                  <span
                    class="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-black flex items-center justify-center shrink-0"
                    >W</span
                  >
                  <span class="text-xs font-bold text-slate-200">{{
                    getMatchWinnerNames(match)
                  }}</span>
                  <span class="text-[8px] font-mono text-emerald-400 font-bold">
                    (+{{ match.elo_change.toFixed(2) }})
                  </span>
                </div>
                <!-- Loser Line -->
                <div class="flex items-center space-x-2">
                  <span
                    class="w-3.5 h-3.5 rounded-full bg-red-500/20 text-red-400 text-[8px] font-black flex items-center justify-center shrink-0"
                    >L</span
                  >
                  <span class="text-xs font-semibold text-slate-450">{{
                    getMatchLoserNames(match)
                  }}</span>
                  <span class="text-[8px] font-mono text-red-400 font-bold">
                    (-{{ match.elo_change.toFixed(2) }})
                  </span>
                </div>
              </div>

              <!-- Score Indicator -->
              <div class="text-right flex flex-col justify-between h-full space-y-1">
                <span
                  class="inline-block px-2 py-0.5 rounded bg-slate-950 font-mono text-xs font-black text-lime-400 border border-lime-500/10"
                >
                  {{ match.score }}
                </span>
                <span class="text-[8px] text-slate-500 font-bold">{{
                  formatRelativeDate(match.played_at)
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- App Bottom Tab Bar & FAB -->
      <nav
        class="absolute bottom-0 left-0 right-0 h-[64px] bg-slate-900 border-t border-slate-800/85 backdrop-blur-md flex justify-around items-center px-4 pb-2 z-30 shrink-0"
      >
        <!-- Leaderboard Tab trigger -->
        <button
          @click="currentTab = 'leaderboard'"
          :class="[
            'flex flex-col items-center space-y-1 transition-all focus:outline-none',
            currentTab === 'leaderboard'
              ? 'text-lime-400 scale-105'
              : 'text-slate-500 hover:text-slate-300',
          ]"
        >
          <!-- Trophy Icon -->
          <svg
            class="w-4.5 h-4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 15v5m-3 0h6M21 8a3 3 0 00-3-3H6a3 3 0 00-3 3v2a3 3 0 003 3h12a3 3 0 003-3V8z"
            />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Hạng</span>
        </button>

        <!-- Dynamic Action Plus Button (FAB) -->
        <button
          @click="showAddMatchModal = true"
          class="w-11 h-11 rounded-full bg-gradient-to-tr from-lime-400 to-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-lime-500/20 -translate-y-4 hover:scale-110 active:scale-95 transition-all focus:outline-none cursor-pointer"
        >
          <!-- Plus Icon -->
          <svg class="w-5 h-5 stroke-current" fill="none" stroke-width="3.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        <!-- Tuyển thủ Tab trigger -->
        <button
          @click="router.push('/players')"
          class="flex flex-col items-center space-y-1 transition-all focus:outline-none text-slate-500 hover:text-slate-300"
        >
          <!-- Users Icon -->
          <svg
            class="w-4.5 h-4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A3.318 3.318 0 0112 22.5c-1.258 0-2.4-.698-3-1.847V19.13M8.25 12h7.5m-7.5 3H12"
            />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Tuyển thủ</span>
        </button>

        <!-- Match History Tab trigger -->
        <button
          @click="currentTab = 'matches'"
          :class="[
            'flex flex-col items-center space-y-1 transition-all focus:outline-none',
            currentTab === 'matches'
              ? 'text-lime-400 scale-105'
              : 'text-slate-500 hover:text-slate-300',
          ]"
        >
          <!-- Tennis ball Activity Feed Icon -->
          <svg
            class="w-4.5 h-4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wider">Trận đấu</span>
        </button>
      </nav>

      <!-- MODAL 1: ADD MATCH SHEET (Slide up bottom sheet panel) -->
      <transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0"
        leave-to-class="transform translate-y-full"
      >
        <div
          v-if="showAddMatchModal"
          class="absolute inset-x-0 bottom-0 max-h-[85%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-6"
        >
          <!-- Drag Handle -->
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>

          <!-- Sheet Header -->
          <div class="px-5 pb-3 flex justify-between items-center shrink-0">
            <h2 class="text-sm font-extrabold text-slate-100">Ghi nhận trận đấu</h2>
            <button
              @click="closeAddMatchModal"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <svg
                class="w-4.5 h-4.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Main simulator fields -->
          <div class="flex-1 px-5 space-y-4">
            <!-- Standard Mode vs Match simulator details -->
            <div v-if="!matchSuccessData" class="space-y-5">
              <!-- Match Type Indicator (auto-detected) -->
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider"
                  >Loại trận</span
                >
                <span
                  :class="[
                    'text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all',
                    winnerIds.length === 2 || loserIds.length === 2
                      ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                      : 'bg-lime-500/10 border-lime-500/20 text-lime-400',
                  ]"
                >
                  {{ winnerIds.length === 2 || loserIds.length === 2 ? 'Đánh đôi' : 'Đánh đơn' }}
                </span>
              </div>

              <!-- Select Winners -->
              <div>
                <label
                  class="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-2"
                >
                  Đội Thắng
                  <span class="ml-1 text-slate-600 normal-case font-semibold"
                    >(chọn 1–2 người)</span
                  >
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="p in players"
                    :key="p._id"
                    @click="toggleWinner(p._id)"
                    :disabled="loserIds.includes(p._id)"
                    :class="[
                      'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer',
                      winnerIds.includes(p._id)
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : loserIds.includes(p._id)
                          ? 'opacity-30 cursor-not-allowed bg-slate-950 border-slate-800/60 text-slate-500'
                          : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:border-slate-600',
                    ]"
                  >
                    <span
                      :class="[
                        'w-4 h-4 rounded-full bg-gradient-to-br shrink-0 flex items-center justify-center text-[7px] font-black text-white uppercase',
                        getAvatarGradient(p.name),
                      ]"
                      >{{ getInitials(p.name).slice(0, 1) }}</span
                    >
                    <span class="truncate max-w-[90px]">{{ p.name.split(' ').pop() }}</span>
                    <span class="font-mono text-[8px] text-slate-500 shrink-0">{{
                      p.current_score.toFixed(1)
                    }}</span>
                    <svg
                      v-if="winnerIds.includes(p._id)"
                      class="w-3 h-3 fill-current text-emerald-400 shrink-0"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </button>
                </div>
                <p
                  v-if="winnerIds.length > 0"
                  class="mt-1.5 text-[9px] text-emerald-400 font-semibold"
                >
                  ✓ Đã chọn:
                  {{
                    winnerIds
                      .map((id) =>
                        players
                          .find((p) => p._id === id)
                          ?.name.split(' ')
                          .pop(),
                      )
                      .join(' & ')
                  }}
                </p>
              </div>

              <!-- VS Divider -->
              <div class="flex items-center space-x-3">
                <div class="flex-1 h-px bg-slate-800"></div>
                <span class="text-[10px] font-extrabold text-slate-500 tracking-widest">VS</span>
                <div class="flex-1 h-px bg-slate-800"></div>
              </div>

              <!-- Select Losers -->
              <div>
                <label
                  class="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-2"
                >
                  Đội Thua
                  <span class="ml-1 text-slate-600 normal-case font-semibold"
                    >(chọn 1–2 người)</span
                  >
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="p in players"
                    :key="p._id"
                    @click="toggleLoser(p._id)"
                    :disabled="winnerIds.includes(p._id)"
                    :class="[
                      'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer',
                      loserIds.includes(p._id)
                        ? 'bg-red-500/15 border-red-500/40 text-red-300'
                        : winnerIds.includes(p._id)
                          ? 'opacity-30 cursor-not-allowed bg-slate-950 border-slate-800/60 text-slate-500'
                          : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:border-slate-600',
                    ]"
                  >
                    <span
                      :class="[
                        'w-4 h-4 rounded-full bg-gradient-to-br shrink-0 flex items-center justify-center text-[7px] font-black text-white uppercase',
                        getAvatarGradient(p.name),
                      ]"
                      >{{ getInitials(p.name).slice(0, 1) }}</span
                    >
                    <span class="truncate max-w-[90px]">{{ p.name.split(' ').pop() }}</span>
                    <span class="font-mono text-[8px] text-slate-500 shrink-0">{{
                      p.current_score.toFixed(1)
                    }}</span>
                    <svg
                      v-if="loserIds.includes(p._id)"
                      class="w-3 h-3 fill-current text-red-400 shrink-0"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </button>
                </div>
                <p v-if="loserIds.length > 0" class="mt-1.5 text-[9px] text-red-400 font-semibold">
                  ✓ Đã chọn:
                  {{
                    loserIds
                      .map((id) =>
                        players
                          .find((p) => p._id === id)
                          ?.name.split(' ')
                          .pop(),
                      )
                      .join(' & ')
                  }}
                </p>
              </div>

              <!-- Select score ratio -->
              <div>
                <label
                  class="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-2"
                  >Tỷ Số Trận Đấu</label
                >
                <div class="grid grid-cols-4 gap-2">
                  <button
                    v-for="sc in ['6-4', '6-3', '6-2', '6-1', '6-0', '7-5', '7-6']"
                    :key="sc"
                    @click="setScore = sc"
                    :class="[
                      'py-2.5 text-[10px] font-bold rounded-xl border transition-all text-center cursor-pointer',
                      setScore === sc
                        ? 'bg-lime-500 border-lime-500 text-slate-950'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200',
                    ]"
                  >
                    {{ sc }}
                  </button>
                </div>
              </div>

              <!-- Error Box -->
              <div
                v-if="formError"
                class="bg-red-950/40 border border-red-500/20 text-red-400 text-[10px] font-semibold px-4 py-3 rounded-xl flex items-center space-x-2"
              >
                <svg class="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                  />
                </svg>
                <span>{{ formError }}</span>
              </div>

              <!-- Submit button -->
              <button
                @click="submitMatch"
                class="w-full bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 font-extrabold text-xs py-3.5 rounded-xl hover:opacity-95 active:scale-[0.98] transition-all shadow-lg shadow-lime-500/10 focus:outline-none cursor-pointer"
              >
                Ghi Nhận & Tính Elo
              </button>
            </div>

            <!-- SUCCESS SIMULATION SUMMARY VIEW -->
            <div v-else class="space-y-6 py-4 text-center">
              <div
                class="w-14 h-14 bg-emerald-500/15 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400"
              >
                <svg
                  class="w-7 h-7 stroke-current"
                  fill="none"
                  stroke-width="3"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>

              <div>
                <h3 class="text-base font-black text-slate-100">Đã cập nhật điểm ELO!</h3>
                <p class="text-[10px] text-slate-400 mt-1">
                  Kết quả cuộc so tài (Tỷ số: {{ setScore }})
                </p>
              </div>

              <!-- Elo updates showcard -->
              <div class="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2">
                <!-- Winners -->
                <div
                  v-for="w in matchSuccessData.winners"
                  :key="w.name"
                  class="flex justify-between items-center py-2 border-b border-slate-900 last:border-0"
                >
                  <div class="flex items-center space-x-1.5">
                    <span
                      class="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-extrabold uppercase"
                      >W</span
                    >
                    <span class="text-xs font-bold text-slate-200">{{
                      w.name.split(' ').pop()
                    }}</span>
                  </div>
                  <div class="font-mono text-xs flex items-center space-x-1">
                    <span class="text-slate-500 text-[10px]">{{ w.oldElo.toFixed(2) }}</span>
                    <span class="text-slate-400">→</span>
                    <span class="text-lime-400 font-bold">{{ w.newElo.toFixed(2) }}</span>
                    <span class="text-emerald-400 text-[9px] font-bold"
                      >(+{{ matchSuccessData.change.toFixed(2) }})</span
                    >
                  </div>
                </div>

                <!-- Divider between teams -->
                <div class="flex items-center space-x-2 py-1">
                  <div class="flex-1 h-px bg-slate-800"></div>
                  <span class="text-[8px] text-slate-600 font-bold tracking-widest">VS</span>
                  <div class="flex-1 h-px bg-slate-800"></div>
                </div>

                <!-- Losers -->
                <div
                  v-for="l in matchSuccessData.losers"
                  :key="l.name"
                  class="flex justify-between items-center py-2 border-b border-slate-900 last:border-0"
                >
                  <div class="flex items-center space-x-1.5">
                    <span
                      class="inline-block px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[8px] font-extrabold uppercase"
                      >L</span
                    >
                    <span class="text-xs font-semibold text-slate-400">{{
                      l.name.split(' ').pop()
                    }}</span>
                  </div>
                  <div class="font-mono text-xs flex items-center space-x-1">
                    <span class="text-slate-500 text-[10px]">{{ l.oldElo.toFixed(2) }}</span>
                    <span class="text-slate-400">→</span>
                    <span class="text-red-400 font-bold">{{ l.newElo.toFixed(2) }}</span>
                    <span class="text-red-400 text-[9px] font-bold"
                      >(-{{ matchSuccessData.change.toFixed(2) }})</span
                    >
                  </div>
                </div>
              </div>

              <button
                @click="closeAddMatchModal"
                class="w-full bg-slate-800 text-slate-200 font-bold text-xs py-3.5 rounded-xl hover:bg-slate-700 transition-all border border-slate-700/50 cursor-pointer"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- Backdrop for Modal 1 (Simulate Match Sheet) -->
      <div
        v-if="showAddMatchModal"
        @click="closeAddMatchModal"
        class="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-35"
      ></div>

      <!-- MODAL 2: PLAYER PROFILE DETAILS (Full detail view & Elo graph) -->
      <transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0"
        leave-to-class="transform translate-y-full"
      >
        <div
          v-if="showDetailModal && activePlayer"
          class="absolute inset-x-0 bottom-0 h-[88%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-8"
        >
          <!-- Drag Handle -->
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>

          <!-- Header -->
          <div class="px-5 pb-2 flex justify-between items-center shrink-0">
            <h2 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Chi tiết Tay Vợt
            </h2>
            <button
              @click="showDetailModal = false"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <svg
                class="w-4.5 h-4.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body details -->
          <div class="flex-1 px-5 space-y-5 overflow-y-auto">
            <!-- Player Avatar Header -->
            <div class="flex items-center space-x-4">
              <div
                :class="[
                  'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-lg font-black text-slate-100 shadow-lg uppercase shrink-0',
                  getAvatarGradient(activePlayer.name),
                ]"
              >
                {{ getInitials(activePlayer.name) }}
              </div>
              <div>
                <h2 class="text-sm font-bold text-slate-100">{{ activePlayer.name }}</h2>
                <div class="flex items-center space-x-2 mt-1">
                  <span class="inline-block text-[9px] text-slate-400 font-bold"
                    >Hạng: #{{ getPlayerRank(activePlayer._id) }}</span
                  >
                  <span class="w-1 h-1 rounded-full bg-slate-700"></span>
                  <span class="inline-block text-[9px] text-slate-400 font-bold"
                    >Gia nhập: {{ formatDate(activePlayer.created_at) }}</span
                  >
                </div>
              </div>
            </div>

            <!-- Stats Panel Grid -->
            <div class="grid grid-cols-3 gap-2.5">
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span class="text-[8px] uppercase font-bold text-slate-400 tracking-wider"
                  >Elo Hiện Tại</span
                >
                <p class="text-sm font-extrabold text-lime-400 mt-0.5">
                  {{ activePlayer.current_score.toFixed(2) }}
                </p>
                <span class="text-[8px] text-slate-500"
                  >Mặc định: {{ activePlayer.initial_score.toFixed(2) }}</span
                >
              </div>
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span class="text-[8px] uppercase font-bold text-slate-400 tracking-wider"
                  >Thắng - Thua</span
                >
                <p class="text-sm font-extrabold text-slate-200 mt-0.5">
                  {{ activePlayer.wins }} - {{ activePlayer.losses }}
                </p>
                <span class="text-[8px] text-slate-500"
                  >Tổng: {{ activePlayer.matches_played }} trận</span
                >
              </div>
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span class="text-[8px] uppercase font-bold text-slate-400 tracking-wider"
                  >Tỷ Lệ Thắng</span
                >
                <p class="text-sm font-extrabold text-slate-200 mt-0.5">
                  {{
                    activePlayer.matches_played > 0
                      ? Math.round((activePlayer.wins / activePlayer.matches_played) * 100)
                      : 0
                  }}%
                </p>
                <span class="text-[8px] text-slate-500"
                  >Hiệu số: {{ activePlayer.wins - activePlayer.losses }}</span
                >
              </div>
            </div>

            <!-- SVG history Rating trend curve graph (Pure CSS custom graph) -->
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div class="flex justify-between items-center mb-3">
                <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider"
                  >Biểu đồ Elo</span
                >
                <!-- Hover status tooltip detail -->
                <span
                  v-if="hoveredChartPoint"
                  class="text-[9px] bg-lime-500/10 border border-lime-500/20 text-lime-400 font-semibold px-2 py-0.5 rounded-md"
                >
                  Trận {{ hoveredChartPoint.idx + 1 }}: {{ hoveredChartPoint.val.toFixed(2) }}
                </span>
                <span v-else class="text-[9px] text-slate-500 font-bold"
                  >Rê chuột vào điểm để xem</span
                >
              </div>

              <div v-if="activePlayer.history && activePlayer.history.length > 0" class="relative">
                <svg viewBox="0 0 400 150" class="w-full h-32 overflow-visible">
                  <!-- Gradients -->
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#a3e635" stop-opacity="0.25" />
                      <stop offset="100%" stop-color="#a3e635" stop-opacity="0" />
                    </linearGradient>
                  </defs>

                  <!-- Grid Dashed lines -->
                  <line x1="0" y1="20" x2="400" y2="20" stroke="#1e293b" stroke-dasharray="4 4" />
                  <line x1="0" y1="75" x2="400" y2="75" stroke="#1e293b" stroke-dasharray="4 4" />
                  <line x1="0" y1="130" x2="400" y2="130" stroke="#1e293b" stroke-dasharray="4 4" />

                  <!-- Gradient Area under curve -->
                  <path v-if="chartPoints.length > 1" :d="svgAreaPath" fill="url(#chartGrad)" />

                  <!-- Actual Line -->
                  <path
                    :d="svgLinePath"
                    fill="none"
                    stroke="#a3e635"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />

                  <!-- Circles on coordinates -->
                  <circle
                    v-for="(point, idx) in chartPoints"
                    :key="idx"
                    :cx="point.x"
                    :cy="point.y"
                    :r="hoveredChartPoint?.idx === idx ? 5.5 : 3"
                    :fill="hoveredChartPoint?.idx === idx ? '#a3e635' : '#090d16'"
                    stroke="#a3e635"
                    stroke-width="2"
                    class="transition-all duration-150 cursor-pointer"
                    @mouseover="hoveredChartPoint = { ...point, idx }"
                    @mouseleave="hoveredChartPoint = null"
                  />
                </svg>

                <div
                  class="flex justify-between mt-2.5 text-[8px] text-slate-500 font-bold uppercase tracking-wider"
                >
                  <span>Khởi đầu ({{ activePlayer.initial_score.toFixed(2) }})</span>
                  <span>{{ activePlayer.history.length }} mốc điểm</span>
                  <span>Hiện tại ({{ activePlayer.current_score.toFixed(2) }})</span>
                </div>
              </div>
              <div v-else class="text-center py-6 text-xs text-slate-500">
                Chưa có lịch sử điểm số.
              </div>
            </div>

            <!-- Player Match Records List (Last 5 matches) -->
            <div class="space-y-2">
              <h3 class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Lịch sử đấu
              </h3>

              <div
                v-if="playerMatchHistory.length === 0"
                class="text-center py-6 text-xs text-slate-500"
              >
                Chưa có dữ liệu trận đấu cho tay vợt này.
              </div>

              <div
                v-for="m in playerMatchHistory.slice(0, 5)"
                :key="m.id"
                class="bg-slate-950 rounded-xl p-2.5 border border-slate-900 flex justify-between items-center text-xs"
              >
                <!-- Match result details -->
                <div class="flex items-center space-x-2">
                  <span
                    :class="[
                      'w-10 text-center py-0.5 rounded text-[8px] font-extrabold uppercase',
                      isPlayerWinner(m, activePlayer._id)
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20',
                    ]"
                  >
                    {{ isPlayerWinner(m, activePlayer._id) ? 'Thắng' : 'Thua' }}
                  </span>

                  <span class="text-slate-400 font-medium text-[10px]">
                    {{
                      isPlayerWinner(m, activePlayer._id)
                        ? `vs ${getMatchLoserNames(m)}`
                        : `vs ${getMatchWinnerNames(m)}`
                    }}
                  </span>
                </div>

                <div class="flex items-center space-x-3">
                  <span
                    class="font-mono text-[10px] font-bold text-slate-350 bg-slate-900 px-2 py-0.5 rounded"
                  >
                    {{ m.score }}
                  </span>

                  <span
                    :class="[
                      'font-mono text-[10px] font-bold',
                      isPlayerWinner(m, activePlayer._id) ? 'text-emerald-400' : 'text-red-400',
                    ]"
                  >
                    {{
                      isPlayerWinner(m, activePlayer._id)
                        ? `+${m.elo_change.toFixed(2)}`
                        : `-${m.elo_change.toFixed(2)}`
                    }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- Backdrop for Modal 2 (Player Profile Details Sheet) -->
      <div
        v-if="showDetailModal"
        @click="showDetailModal = false"
        class="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-35"
      ></div>

      <!-- MODAL 3: BATCH UPDATE ELO SHEET -->
      <transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-y-full"
        enter-to-class="transform translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0"
        leave-to-class="transform translate-y-full"
      >
        <div
          v-if="showBatchModal"
          class="absolute inset-x-0 bottom-0 max-h-[90%] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 overflow-y-auto flex flex-col pb-6"
        >
          <!-- Drag Handle -->
          <div class="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0"></div>

          <!-- Sheet Header -->
          <div class="px-5 pb-3 flex justify-between items-center shrink-0">
            <div>
              <h2 class="text-sm font-extrabold text-slate-100">Cập nhật Elo theo Buổi</h2>
              <p class="text-[9px] text-slate-400 mt-0.5">Mỗi buổi 2 trận · Nhập số thắng · Thua = 2 − Thắng</p>
            </div>
            <button
              @click="closeBatchModal"
              class="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Form Content -->
          <div class="flex-1 px-5 space-y-4">

            <!-- SUCCESS VIEW -->
            <div v-if="batchSuccessData" class="space-y-5 py-2 text-center">
              <div class="w-14 h-14 bg-lime-500/15 border border-lime-500/20 rounded-full flex items-center justify-center mx-auto text-lime-400">
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
                <div
                  v-for="c in batchSuccessData.changes"
                  :key="c.member_id"
                  class="px-4 py-2.5 border-b border-slate-900/60 last:border-0 flex justify-between items-center"
                >
                  <div class="flex items-center space-x-2">
                    <div
                      :class="[
                        'w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[7px] font-black text-white uppercase shrink-0',
                        getAvatarGradient(c.name),
                      ]"
                    >{{ getInitials(c.name).slice(0, 1) }}</div>
                    <span class="text-xs font-bold text-slate-200">{{ c.name.split(' ').pop() }}</span>
                  </div>
                  <div class="font-mono text-xs flex items-center space-x-1.5">
                    <span class="text-slate-500 text-[10px]">→ {{ c.elo_after.toFixed(2) }}</span>
                    <span
                      :class="[
                        'text-[10px] font-bold px-1.5 py-0.5 rounded',
                        c.elo_gain > 0
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : c.elo_gain < 0
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-slate-800 text-slate-500',
                      ]"
                    >
                      {{ c.elo_gain > 0 ? '+' : '' }}{{ c.elo_gain.toFixed(2) }}
                    </span>
                  </div>
                </div>
              </div>

              <button
                @click="closeBatchModal"
                class="w-full bg-slate-800 text-slate-200 font-bold text-xs py-3.5 rounded-xl hover:bg-slate-700 transition-all border border-slate-700/50 cursor-pointer"
              >
                Hoàn Tất
              </button>
            </div>

            <!-- INPUT FORM VIEW -->
            <div v-else class="space-y-4">
              <!-- Date & Note fields -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Ngày diễn ra</label>
                  <input
                    v-model="batchDate"
                    type="date"
                    class="w-full bg-slate-950 text-[10px] text-slate-200 px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-lime-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Ghi chú buổi</label>
                  <input
                    v-model="batchNote"
                    type="text"
                    placeholder="VD: Buổi 1 - Khai mạc Q3"
                    class="w-full bg-slate-950 text-[10px] text-slate-200 px-3 py-2 rounded-xl border border-slate-800 placeholder-slate-600 focus:outline-none focus:border-lime-500/50 transition-colors"
                  />
                </div>
              </div>

              <!-- Quarter Preview -->
              <div class="flex items-center space-x-2 px-3 py-2 bg-lime-500/5 border border-lime-500/15 rounded-xl">
                <svg class="w-3 h-3 text-lime-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span class="text-[9px] text-lime-400 font-bold">Quý: {{ getQuarter(batchDate) }}</span>
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
                  <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>2 thắng = +0.50</span>
                </span>
                <span class="text-slate-700">·</span>
                <span class="flex items-center space-x-1">
                  <span class="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span>1 thắng = 0.00</span>
                </span>
                <span class="text-slate-700">·</span>
                <span class="flex items-center space-x-1">
                  <span class="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                  <span>0 thắng = −0.50</span>
                </span>
                <span class="text-slate-700">·</span>
                <span class="flex items-center space-x-1">
                  <span class="inline-block w-2 h-2 rounded-full bg-slate-600"></span>
                  <span>Offline = −0.25</span>
                </span>
              </div>

              <!-- Player Entries Grid -->
              <div class="space-y-2">
                <div
                  v-for="entry in batchEntries"
                  :key="entry.player_id"
                  :class="[
                    'border rounded-xl p-3 transition-all',
                    entry.offline
                      ? 'bg-slate-950/50 border-slate-700/30 opacity-60'
                      : 'bg-slate-950 border-slate-800/60',
                  ]"
                >
                  <div class="flex items-center justify-between">
                    <!-- Player info -->
                    <div class="flex items-center space-x-2 min-w-0">
                      <div
                        :class="[
                          'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[8px] font-black text-white uppercase shrink-0 transition-all',
                          getAvatarGradient(players.find(p => p._id === entry.player_id)?.name || ''),
                          entry.offline ? 'grayscale opacity-50' : '',
                        ]"
                      >
                        {{ getInitials(players.find(p => p._id === entry.player_id)?.name || '').slice(0,1) }}
                      </div>
                      <div class="min-w-0">
                        <p class="text-[10px] font-bold text-slate-200 truncate">
                          {{ players.find(p => p._id === entry.player_id)?.name.split(' ').pop() }}
                        </p>
                        <p class="text-[8px] font-mono">
                          <span class="text-slate-500">Elo: {{ players.find(p => p._id === entry.player_id)?.current_score.toFixed(2) }}</span>
                          <!-- Preview delta -->
                          <span
                            :class="[
                              'ml-1 font-bold transition-all',
                              getBatchEloPreview(entry) > 0 ? 'text-emerald-400' : getBatchEloPreview(entry) < 0 ? 'text-red-400' : 'text-slate-500'
                            ]"
                          >
                            {{ getBatchEloPreview(entry) >= 0 ? '+' : '' }}{{ getBatchEloPreview(entry).toFixed(2) }}
                            <span v-if="entry.offline" class="text-slate-500 ml-0.5">(offline)</span>
                          </span>
                        </p>
                      </div>
                    </div>

                    <!-- Controls: offline checkbox OR wins counter -->
                    <div class="flex items-center space-x-3 shrink-0">

                      <!-- Wins counter (only when online) -->
                      <div v-if="!entry.offline" class="flex items-center space-x-1.5">
                        <span class="text-[8px] font-bold text-slate-400 uppercase">Thắng</span>
                        <div class="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                          <button
                            @click="entry.wins = Math.max(0, entry.wins - 1)"
                            class="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all text-sm font-bold cursor-pointer"
                          >−</button>
                          <span
                            :class="[
                              'w-5 text-center text-[10px] font-black',
                              entry.wins === 2 ? 'text-emerald-400' : entry.wins === 1 ? 'text-yellow-400' : 'text-red-400'
                            ]"
                          >{{ entry.wins }}</span>
                          <button
                            @click="entry.wins = Math.min(2, entry.wins + 1)"
                            class="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all text-sm font-bold cursor-pointer"
                          >+</button>
                        </div>
                        <!-- Auto losses display -->
                        <span class="text-[8px] text-slate-600 font-mono">/ {{ 2 - entry.wins }}L</span>
                      </div>

                      <!-- Offline penalty label -->
                      <div v-else class="text-[9px] font-bold text-red-400/70 bg-red-500/5 border border-red-500/15 px-2 py-1 rounded-lg">
                        −0.25
                      </div>

                      <!-- Offline toggle checkbox -->
                      <label class="flex items-center space-x-1.5 cursor-pointer group">
                        <span class="text-[8px] text-slate-500 group-hover:text-slate-300 transition-colors font-bold uppercase">Off</span>
                        <div
                          @click="entry.offline = !entry.offline; if(entry.offline) entry.wins = 0"
                          :class="[
                            'w-8 h-4 rounded-full border transition-all cursor-pointer relative',
                            entry.offline
                              ? 'bg-red-500/20 border-red-500/40'
                              : 'bg-slate-800 border-slate-700'
                          ]"
                        >
                          <div
                            :class="[
                              'absolute top-0.5 w-3 h-3 rounded-full transition-all',
                              entry.offline
                                ? 'left-4 bg-red-400'
                                : 'left-0.5 bg-slate-500'
                            ]"
                          ></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Error Box -->
              <div
                v-if="batchError"
                class="bg-red-950/40 border border-red-500/20 text-red-400 text-[10px] font-semibold px-4 py-3 rounded-xl flex items-center space-x-2"
              >
                <svg class="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                <span>{{ batchError }}</span>
              </div>

              <!-- Submit Button -->
              <button
                @click="submitBatchUpdate"
                class="w-full bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 font-extrabold text-xs py-3.5 rounded-xl hover:opacity-95 active:scale-[0.98] transition-all shadow-lg shadow-lime-500/10 focus:outline-none cursor-pointer"
              >
                Xác Nhận &amp; Cập Nhật Elo
              </button>
            </div>

          </div>
        </div>
      </transition>

      <!-- Backdrop for Modal 3 (Batch Update) -->
      <div
        v-if="showBatchModal"
        @click="closeBatchModal"
        class="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-35"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* Styling utility for clean scrollbars */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
