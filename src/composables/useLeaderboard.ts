import { computed, ref, watch } from 'vue'
import { DEFAULT_PLAYERS, LOCAL_STORAGE_DRAFT_KEY, isGuestId } from '@/domain/constants'
import type {
  BatchPlayerEntry,
  BatchSession,
  BatchSessionChange,
  MatchRecord,
  Player,
  PlayerEloChange,
  Season,
} from '@/domain/types'
import {
  computeBatchSession,
  computeMatchResult,
  previewBatchElo,
  reverseMatchResult,
} from '@/services/elo'
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
  const sessions = ref<BatchSession[]>([])
  const currentTab = ref<LeaderboardTab>('leaderboard')

  // Filters & sorting
  const searchQuery = ref('')
  const filterGroup = ref<FilterGroup>('all')
  const sortBy = ref<SortBy>('rank_desc')

  // Single match recording state — ngày của buổi mà trận thuộc về
  const matchDate = ref(new Date().toISOString().slice(0, 10))
  const matchSeasonId = ref<string | null>(null)
  const matchUpdateLoading = ref(false)
  const matchUpdateError = ref('')

  // Batch update state
  const batchNote = ref('')
  const batchDate = ref(new Date().toISOString().slice(0, 10))
  const batchOfflineIds = ref<Set<string>>(new Set())
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

  const loadSessions = async () => {
    try {
      sessions.value = await store.sessions.getAll()
    } catch (err) {
      console.error('Không tải được danh sách buổi chơi.', err)
      sessions.value = []
    }
  }

  const init = async () => {
    await Promise.all([loadPlayers(), loadMatches(), loadSeasons(), loadSessions()])
  }

  const findActiveSeason = (date: string) =>
    seasons.value.find((s) => s.start_date <= date && date <= s.end_date) ?? null

  /**
   * Builds/updates the official session record for a day from a full set of
   * per-player entries, upserting whichever session already exists for that
   * date (e.g. auto-created while recording individual matches) instead of
   * creating a duplicate. Persists both the session and any player changes
   * (only offline entries actually change a player — see `computeBatchSession`).
   */
  const commitDaySession = async (
    date: string,
    note: string | undefined,
    seasonId: string | null,
    entries: BatchPlayerEntry[],
  ): Promise<{ session?: BatchSession; error?: string }> => {
    const existing = sessions.value.find((s) => s.date.slice(0, 10) === date)

    const { session: computedSession, updatedPlayers } = computeBatchSession(players.value, entries, {
      date,
      note: note ?? existing?.note,
      seasonId,
    })
    const session: BatchSession = existing ? { ...computedSession, _id: existing._id } : computedSession

    updatedPlayers.forEach((updated) => {
      const idx = players.value.findIndex((p) => p._id === updated._id)
      if (idx !== -1) players.value[idx] = updated
    })

    try {
      if (existing) await store.sessions.update(session)
      else await store.sessions.add(session)
      await store.players.saveAll(players.value)
    } catch (err) {
      console.error('Lưu buổi chơi thất bại.', err)
      return { error: 'Lưu dữ liệu thất bại, vui lòng thử lại.' }
    }

    const idx = sessions.value.findIndex((s) => s._id === session._id)
    if (idx !== -1) sessions.value[idx] = session
    else sessions.value.push(session)

    return { session }
  }

  // --- Single match recording ---
  const openAddMatch = () => {
    matchDate.value = new Date().toISOString().slice(0, 10)
    matchSeasonId.value = findActiveSeason(matchDate.value)?._id ?? null
    matchUpdateError.value = ''
  }

  watch(matchDate, (date) => {
    matchSeasonId.value = findActiveSeason(date)?._id ?? null
  })

  // Per-player tallies + full match list for the currently-selected day (quick-add popover).
  const matchDayEntries = computed(() =>
    players.value.map((p) => {
      const { gamesPlayed, wins } = computeDayStats(p._id, matchDate.value)
      return { player_id: p._id, name: p.name, games_played: gamesPlayed, wins, losses: gamesPlayed - wins }
    }),
  )

  const matchDayHistory = computed(() =>
    matches.value.filter((m) => m.played_at.slice(0, 10) === matchDate.value),
  )

  /** "Xác nhận cập nhật Elo" on the quick-add sheet: commits the day's session. */
  const submitMatchDayUpdate = async (): Promise<{ success?: boolean; error?: string }> => {
    matchUpdateError.value = ''

    const entries: BatchPlayerEntry[] = matchDayEntries.value.map((e) => ({
      player_id: e.player_id,
      games_played: e.games_played,
      wins: e.wins,
      offline: false,
    }))

    if (!entries.some((e) => e.games_played > 0)) {
      matchUpdateError.value = 'Chưa có trận nào được ghi nhận trong ngày này.'
      return { error: matchUpdateError.value }
    }

    if (!confirm(`Bạn có chắc muốn cập nhật Elo cho ngày ${matchDate.value} không?`)) {
      return {}
    }

    matchUpdateLoading.value = true
    try {
      const { error } = await commitDaySession(matchDate.value, undefined, matchSeasonId.value, entries)
      if (error) {
        matchUpdateError.value = error
        return { error }
      }
      return { success: true }
    } finally {
      matchUpdateLoading.value = false
    }
  }

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
    const allFound = [...winnerIds, ...loserIds].every(
      (id) => isGuestId(id) || players.value.some((p) => p._id === id),
    )
    if (!allFound) {
      return { error: 'Không tìm thấy thông tin tay vợt.' }
    }

    // Nếu chọn ngày hôm nay: giữ giờ thực; ngày khác: dùng đầu ngày đó
    const date = matchDate.value
    const today = new Date().toISOString().slice(0, 10)
    const playedAt = date === today ? new Date().toISOString() : new Date(date).toISOString()

    // Find (or start) that day's session so the match can link to it.
    const existingSession = sessions.value.find((s) => s.date.slice(0, 10) === date)
    const isNewSession = !existingSession
    const session: BatchSession = existingSession ?? {
      _id: 'session_' + Date.now(),
      date: new Date(date).toISOString(),
      quarter: getQuarter(date),
      note: `Buổi chơi ${new Date(date).toLocaleDateString('vi-VN')}`,
      changes: [],
      season_id: matchSeasonId.value,
    }

    const { match, updatedPlayers, winners, losers, change } = computeMatchResult(
      players.value,
      winnerIds,
      loserIds,
      { score: setScore, playedAt, sessionId: session._id },
    )

    // Commit updated snapshots into reactive state.
    updatedPlayers.forEach((updated) => {
      const idx = players.value.findIndex((p) => p._id === updated._id)
      if (idx !== -1) players.value[idx] = updated
    })
    matches.value.unshift(match)

    // Keep the session's changes summary in sync for the players just involved.
    ;[...winnerIds, ...loserIds].forEach((playerId) => {
      const player = players.value.find((p) => p._id === playerId)
      if (!player) return
      const { gamesPlayed, wins } = computeDayStats(playerId, date)
      const entry: BatchPlayerEntry = { player_id: playerId, games_played: gamesPlayed, wins, offline: false }
      const sessionChange: BatchSessionChange = {
        member_id: playerId,
        name: player.name,
        games_played: gamesPlayed,
        wins,
        offline: false,
        elo_gain: previewBatchElo(entry),
        elo_after: player.current_score,
      }
      const idx = session.changes.findIndex((c) => c.member_id === playerId)
      if (idx !== -1) session.changes[idx] = sessionChange
      else session.changes.push(sessionChange)
    })

    if (isNewSession) sessions.value.push(session)
    else {
      const idx = sessions.value.findIndex((s) => s._id === session._id)
      if (idx !== -1) sessions.value[idx] = session
    }

    try {
      await store.matches.add(match)
      await store.players.saveAll(players.value)
      if (isNewSession) await store.sessions.add(session)
      else await store.sessions.update(session)
    } catch (err) {
      console.error('Lưu trận đấu thất bại.', err)
      return { error: 'Lưu dữ liệu thất bại, vui lòng thử lại.' }
    }

    return { success: { winners, losers, change } }
  }

  /**
   * Cancels a previously-recorded match: reverses its Elo/stat effect on the
   * real players involved, removes the match, and keeps its linked session's
   * `changes` in sync (removing the session entirely if it's now empty).
   */
  const cancelMatch = async (matchId: string): Promise<{ success?: boolean; error?: string }> => {
    const match = matches.value.find((m) => m.id === matchId)
    if (!match) return { error: 'Không tìm thấy trận đấu.' }

    if (!confirm('Bạn có chắc muốn hủy bỏ trận đấu này? Điểm Elo đã cộng/trừ sẽ được hoàn tác.')) {
      return {}
    }

    const reversedPlayers = reverseMatchResult(players.value, match)
    reversedPlayers.forEach((updated) => {
      const idx = players.value.findIndex((p) => p._id === updated._id)
      if (idx !== -1) players.value[idx] = updated
    })

    matches.value = matches.value.filter((m) => m.id !== matchId)

    const date = match.played_at.slice(0, 10)
    const session = match.session_id ? sessions.value.find((s) => s._id === match.session_id) : undefined

    if (session) {
      ;[...match.winner_ids, ...match.loser_ids].forEach((playerId) => {
        if (isGuestId(playerId)) return
        const player = players.value.find((p) => p._id === playerId)
        if (!player) return
        const { gamesPlayed, wins } = computeDayStats(playerId, date)
        const idx = session.changes.findIndex((c) => c.member_id === playerId)
        if (gamesPlayed === 0) {
          if (idx !== -1) session.changes.splice(idx, 1)
        } else {
          const entry: BatchPlayerEntry = { player_id: playerId, games_played: gamesPlayed, wins, offline: false }
          const sessionChange: BatchSessionChange = {
            member_id: playerId,
            name: player.name,
            games_played: gamesPlayed,
            wins,
            offline: false,
            elo_gain: previewBatchElo(entry),
            elo_after: player.current_score,
          }
          if (idx !== -1) session.changes[idx] = sessionChange
          else session.changes.push(sessionChange)
        }
      })
    }

    const sessionNowEmpty = session ? session.changes.length === 0 : false

    try {
      await store.matches.remove(matchId)
      await store.players.saveAll(players.value)
      if (session) {
        if (sessionNowEmpty) await store.sessions.remove(session._id)
        else await store.sessions.update(session)
      }
    } catch (err) {
      console.error('Hủy trận đấu thất bại.', err)
      return { error: 'Hủy trận đấu thất bại, vui lòng thử lại.' }
    }

    if (session) {
      if (sessionNowEmpty) sessions.value = sessions.value.filter((s) => s._id !== session._id)
      else {
        const idx = sessions.value.findIndex((s) => s._id === session._id)
        if (idx !== -1) sessions.value[idx] = session
      }
    }

    return { success: true }
  }

  // --- Batch update ---
  /** Tallies a player's actual matches for a given day from recorded MatchRecords. */
  const computeDayStats = (playerId: string, date: string) => {
    let gamesPlayed = 0
    let wins = 0
    matches.value.forEach((m) => {
      if (m.played_at.slice(0, 10) !== date) return
      if (m.winner_ids.includes(playerId)) {
        gamesPlayed++
        wins++
      } else if (m.loser_ids.includes(playerId)) {
        gamesPlayed++
      }
    })
    return { gamesPlayed, wins }
  }

  // Derived from real matches for the day, plus the manually-toggled offline set.
  const batchEntries = computed<BatchPlayerEntry[]>(() =>
    players.value.map((p) => {
      if (batchOfflineIds.value.has(p._id)) {
        return { player_id: p._id, games_played: 0, wins: 0, offline: true }
      }
      const { gamesPlayed, wins } = computeDayStats(p._id, batchDate.value)
      return { player_id: p._id, games_played: gamesPlayed, wins, offline: false }
    }),
  )

  const getDraftKeyForDate = (date: string) => `${LOCAL_STORAGE_DRAFT_KEY}_${date}`
  const getDraftKey = () => getDraftKeyForDate(batchDate.value)

  const persistDraft = () => {
    localStorage.setItem(
      getDraftKey(),
      JSON.stringify({
        date: batchDate.value,
        note: batchNote.value,
        offlineIds: [...batchOfflineIds.value],
        savedAt: Date.now(),
      }),
    )
  }

  const loadDraft = () => {
    batchNote.value = ''
    batchOfflineIds.value = new Set()

    const saved = localStorage.getItem(getDraftKey())
    if (!saved) return
    try {
      const draft = JSON.parse(saved)
      const oneDayMs = 24 * 60 * 60 * 1000
      if (Date.now() - draft.savedAt < oneDayMs) {
        batchNote.value = draft.note || ''
        batchOfflineIds.value = new Set(draft.offlineIds || [])
      } else {
        localStorage.removeItem(getDraftKey())
      }
    } catch {
      localStorage.removeItem(getDraftKey())
    }
  }

  const openBatch = () => {
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

  watch(batchDate, (date) => {
    batchSeasonId.value = findActiveSeason(date)?._id ?? null
    loadDraft()
  })

  watch(batchNote, persistDraft)

  const toggleBatchOffline = (playerId: string) => {
    if (batchOfflineIds.value.has(playerId)) batchOfflineIds.value.delete(playerId)
    else batchOfflineIds.value.add(playerId)
    // Force reactivity on the Set mutation and persist.
    batchOfflineIds.value = new Set(batchOfflineIds.value)
    persistDraft()
  }

  const submitBatchUpdate = async () => {
    if (!confirm('Bạn có chắc muốn lưu cho ngày ' + batchDate.value + ' không?')) return
    batchError.value = ''

    const hasAnyEntry = batchEntries.value.some((e) => e.offline || e.games_played > 0)
    if (!hasAnyEntry) {
      batchError.value = 'Vui lòng có ít nhất 1 người chơi (hoặc đánh dấu offline).'
      return
    }

    const { session, error } = await commitDaySession(
      batchDate.value,
      batchNote.value,
      batchSeasonId.value,
      batchEntries.value,
    )
    if (error) {
      batchError.value = error
      return
    }

    batchSuccessData.value = session!
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
    sessions,
    currentTab,
    searchQuery,
    filterGroup,
    sortBy,
    matchDate,
    matchSeasonId,
    matchUpdateLoading,
    matchUpdateError,
    batchNote,
    batchDate,
    batchEntries,
    batchSeasonId,
    batchSuccessData,
    batchError,
    // lifecycle / actions
    init,
    openAddMatch,
    openBatch,
    resetBatchResult,
    resetToDefault,
    toggleBatchOffline,
    submitBatchUpdate,
    submitMatch,
    cancelMatch,
    submitMatchDayUpdate,
    // helpers
    getBatchEloPreview,
    getQuarter,
    // computed
    statsHero,
    filteredPlayers,
    matchesByDay,
    matchDayEntries,
    matchDayHistory,
    getPlayerRank,
  }
}

/** Local UI-only match-simulation state, kept out of the composable core. */
export type MatchSuccess = {
  winners: PlayerEloChange[]
  losers: PlayerEloChange[]
  change: number
} | null
