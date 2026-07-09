import { computed, ref, watch } from 'vue'
import { DEFAULT_PLAYERS, LOCAL_STORAGE_DRAFT_KEY, MATCHES_PER_SESSION } from '@/domain/constants'
import type {
  BatchPlayerEntry,
  BatchSession,
  MatchRecord,
  Player,
  PlayerEloChange,
  Season,
} from '@/domain/types'
import { computeBatchSession, computeMatchResult, previewBatchElo } from '@/services/elo'
import { formatDate, getQuarter } from '@/services/format'
import { useDataStore } from '@/data/provider'

export type LeaderboardTab = 'leaderboard' | 'matches'
export type FilterGroup = 'all' | 'high' | 'mid' | 'low'
export type SortBy = 'rank_desc' | 'rank_asc' | 'name' | 'improvement'

/**
 * All leaderboard state + actions for HomeView. Persistence is delegated to the
 * injected DataStore, so the view (and this composable) stay storage-agnostic.
 */
export function useLeaderboard() {
  const store = useDataStore()

  // --- State ---
  const players = ref<Player[]>([])
  const matches = ref<MatchRecord[]>([])
  const seasons = ref<Season[]>([])
  const currentTab = ref<LeaderboardTab>('leaderboard')

  // Filters & sorting
  const searchQuery = ref('')
  const filterGroup = ref<FilterGroup>('all')
  const sortBy = ref<SortBy>('rank_desc')

  // Single match recording state — ngày của buổi mà trận thuộc về
  const matchDate = ref(new Date().toISOString().slice(0, 10))

  // Batch update state
  const batchNote = ref('')
  const batchDate = ref(new Date().toISOString().slice(0, 10))
  const batchEntries = ref<BatchPlayerEntry[]>([])
  const batchSeasonId = ref<string | null>(null)
  const batchSuccessData = ref<BatchSession | null>(null)
  const batchError = ref('')

  // --- Data loading ---
  const loadPlayers = async () => {
    try {
      const data = await store.players.getAll()
      players.value = data.length > 0 ? data : structuredClone(DEFAULT_PLAYERS)
    } catch (err) {
      console.error('Không tải được người chơi, dùng dữ liệu mặc định.', err)
      players.value = structuredClone(DEFAULT_PLAYERS)
    }
  }

  const loadMatches = async () => {
    try {
      matches.value = await store.matches.getAll()
    } catch (err) {
      console.error('Không tải được lịch sử trận đấu.', err)
      matches.value = []
    }
  }

  const loadSeasons = async () => {
    try {
      seasons.value = await store.seasons.getAll()
    } catch (err) {
      console.error('Không tải được danh sách mùa giải.', err)
      seasons.value = []
    }
  }

  const init = async () => {
    await Promise.all([loadPlayers(), loadMatches(), loadSeasons()])
  }

  // --- Single match recording ---
  const submitMatch = async (
    winnerIds: string[],
    loserIds: string[],
    setScore: string,
  ): Promise<{ success?: MatchSuccess; error?: string }> => {
    if (winnerIds.length === 0 || loserIds.length === 0) {
      return { error: 'Vui lòng chọn ít nhất 1 người thắng và 1 người thua.' }
    }
    if (winnerIds.length !== loserIds.length) {
      return {
        error: `Số người mỗi đội phải bằng nhau (hiện tại: ${winnerIds.length} thắng vs ${loserIds.length} thua).`,
      }
    }
    if (winnerIds.some((id) => loserIds.includes(id))) {
      return { error: 'Cùng 1 người không thể vừa thắng vừa thua.' }
    }
    const allFound = [...winnerIds, ...loserIds].every((id) =>
      players.value.some((p) => p._id === id),
    )
    if (!allFound) {
      return { error: 'Không tìm thấy thông tin tay vợt.' }
    }

    // Nếu chọn ngày hôm nay: giữ giờ thực; ngày khác: dùng đầu ngày đó
    const today = new Date().toISOString().slice(0, 10)
    const playedAt =
      matchDate.value === today ? new Date().toISOString() : new Date(matchDate.value).toISOString()

    const { match, updatedPlayers, winners, losers, change } = computeMatchResult(
      players.value,
      winnerIds,
      loserIds,
      { score: setScore, playedAt },
    )

    // Commit updated snapshots into reactive state.
    updatedPlayers.forEach((updated) => {
      const idx = players.value.findIndex((p) => p._id === updated._id)
      if (idx !== -1) players.value[idx] = updated
    })
    matches.value.unshift(match)

    try {
      await store.matches.add(match)
      await store.players.saveAll(players.value)
    } catch (err) {
      console.error('Lưu trận đấu thất bại.', err)
      return { error: 'Lưu dữ liệu thất bại, vui lòng thử lại.' }
    }

    return { success: { winners, losers, change } }
  }

  // --- Batch update ---
  const findActiveSeason = (date: string) =>
    seasons.value.find((s) => s.start_date <= date && date <= s.end_date) ?? null

  const openBatch = () => {
    batchEntries.value = players.value.map((p) => ({
      player_id: p._id,
      wins: 0,
      offline: false,
    }))
    batchNote.value = ''
    batchDate.value = new Date().toISOString().slice(0, 10)
    batchSeasonId.value = findActiveSeason(batchDate.value)?._id ?? null
    batchError.value = ''
    batchSuccessData.value = null
    loadDraft()
  }

  const resetBatchResult = () => {
    batchSuccessData.value = null
    batchError.value = ''
  }

  const getDraftKey = () => `${LOCAL_STORAGE_DRAFT_KEY}_${batchDate.value}`

  const saveDraft = () => {
    if (
      !confirm(
        'Bạn có chắc muốn lưu draft cho ngày ' +
          batchDate.value +
          ' không? Dữ liệu sẽ được lưu trong 1 ngày.',
      )
    )
      return
    localStorage.setItem(
      getDraftKey(),
      JSON.stringify({
        date: batchDate.value,
        note: batchNote.value,
        entries: batchEntries.value,
        savedAt: Date.now(),
      }),
    )
  }

  const loadDraft = () => {
    const saved = localStorage.getItem(getDraftKey())
    if (!saved) return
    const draft = JSON.parse(saved)
    const oneDayMs = 24 * 60 * 60 * 1000
    if (Date.now() - draft.savedAt < oneDayMs) {
      batchNote.value = draft.note || ''
      batchEntries.value = draft.entries || []
    } else {
      localStorage.removeItem(getDraftKey())
    }
  }

  watch(batchDate, loadDraft)

  const submitBatchUpdate = async () => {
    if (!confirm('Bạn có chắc muốn lưu cho ngày ' + batchDate.value + ' không?')) return
    batchError.value = ''

    const hasAnyEntry = batchEntries.value.some((e) => e.offline || e.wins > 0)
    if (!hasAnyEntry) {
      batchError.value = 'Vui lòng nhập kết quả cho ít nhất 1 người (hoặc đánh dấu offline).'
      return
    }

    const { session, updatedPlayers } = computeBatchSession(players.value, batchEntries.value, {
      date: batchDate.value,
      note: batchNote.value,
      seasonId: batchSeasonId.value,
    })

    // Commit updated snapshots into reactive state.
    updatedPlayers.forEach((updated) => {
      const idx = players.value.findIndex((p) => p._id === updated._id)
      if (idx !== -1) players.value[idx] = updated
    })

    try {
      await store.sessions.add(session)
      await store.players.saveAll(players.value)
    } catch (err) {
      console.error('Lưu buổi chơi thất bại.', err)
      batchError.value = 'Lưu dữ liệu thất bại, vui lòng thử lại.'
      return
    }

    batchSuccessData.value = session
  }

  const getBatchEloPreview = previewBatchElo

  /** Reset players & matches back to the seed data and persist. */
  const resetToDefault = async () => {
    players.value = structuredClone(DEFAULT_PLAYERS)
    matches.value = []
    try {
      await store.players.saveAll(players.value)
    } catch (err) {
      console.error('Không thể lưu dữ liệu mặc định.', err)
    }
  }

  // --- Computed views ---
  const statsHero = computed(() => {
    if (players.value.length === 0) return { total: 0, avgElo: '0.00', totalMatches: 0 }
    const total = players.value.length
    const sumElo = players.value.reduce((sum, p) => sum + p.current_score, 0)
    return { total, avgElo: (sumElo / total).toFixed(2), totalMatches: matches.value.length }
  })

  const filteredPlayers = computed(() => {
    let result = [...players.value]

    if (searchQuery.value.trim() !== '') {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter((p) => p.name.toLowerCase().includes(q))
    }

    if (filterGroup.value === 'high') result = result.filter((p) => p.current_score >= 7.0)
    else if (filterGroup.value === 'mid')
      result = result.filter((p) => p.current_score >= 6.0 && p.current_score < 7.0)
    else if (filterGroup.value === 'low') result = result.filter((p) => p.current_score < 6.0)

    if (sortBy.value === 'rank_desc') result.sort((a, b) => b.current_score - a.current_score)
    else if (sortBy.value === 'rank_asc') result.sort((a, b) => a.current_score - b.current_score)
    else if (sortBy.value === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    else if (sortBy.value === 'improvement')
      result.sort((a, b) => b.current_score - b.initial_score - (a.current_score - a.initial_score))

    return result
  })

  // Matches grouped by play day (mỗi ngày = 1 buổi), newest day first
  const matchesByDay = computed(() => {
    const groups = new Map<string, MatchRecord[]>()
    matches.value.forEach((m) => {
      const day = m.played_at.slice(0, 10)
      const list = groups.get(day)
      if (list) list.push(m)
      else groups.set(day, [m])
    })
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dayMatches]) => ({
        date,
        label: formatDate(date),
        matches: dayMatches,
      }))
  })

  const rankedPlayersList = computed(() =>
    [...players.value].sort((a, b) => b.current_score - a.current_score),
  )

  const getPlayerRank = (playerId: string) => {
    const index = rankedPlayersList.value.findIndex((p) => p._id === playerId)
    return index !== -1 ? index + 1 : 0
  }

  return {
    // state
    players,
    matches,
    seasons,
    currentTab,
    searchQuery,
    filterGroup,
    sortBy,
    matchDate,
    batchNote,
    batchDate,
    batchEntries,
    batchSeasonId,
    batchSuccessData,
    batchError,
    // lifecycle / actions
    init,
    openBatch,
    resetBatchResult,
    resetToDefault,
    saveDraft,
    submitBatchUpdate,
    submitMatch,
    // helpers
    getBatchEloPreview,
    getQuarter,
    // computed
    statsHero,
    filteredPlayers,
    matchesByDay,
    getPlayerRank,
    // constants for template
    MATCHES_PER_SESSION,
  }
}

/** Local UI-only match-simulation state, kept out of the composable core. */
export type MatchSuccess = {
  winners: PlayerEloChange[]
  losers: PlayerEloChange[]
  change: number
} | null
