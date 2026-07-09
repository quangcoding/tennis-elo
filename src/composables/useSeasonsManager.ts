import { ref } from 'vue'
import type { BatchSession, Player, Season } from '@/domain/types'
import { reverseBatchSession } from '@/services/elo'
import { useDataStore } from '@/data/provider'

/** Season CRUD + season-scoped session CRUD, backed by the injected DataStore. */
export function useSeasonsManager() {
  const store = useDataStore()

  const seasons = ref<Season[]>([])
  const sessions = ref<BatchSession[]>([])
  const players = ref<Player[]>([])

  const load = async () => {
    try {
      const [seasonList, sessionList, playerList] = await Promise.all([
        store.seasons.getAll(),
        store.sessions.getAll(),
        store.players.getAll(),
      ])
      seasons.value = seasonList
      sessions.value = sessionList
      players.value = playerList
    } catch (err) {
      console.error('Không tải được dữ liệu mùa giải.', err)
    }
  }

  const sessionsForSeason = (seasonId: string) =>
    sessions.value
      .filter((s) => s.season_id === seasonId)
      .sort((a, b) => b.date.localeCompare(a.date))

  /** Create a season; returns the created season or an error message. */
  const createSeason = async (input: {
    name: string
    start_date: string
    end_date: string
    description: string
  }): Promise<{ season?: Season; error?: string }> => {
    const name = input.name.trim()
    if (!name) return { error: 'Vui lòng nhập tên mùa giải.' }
    if (!input.start_date || !input.end_date)
      return { error: 'Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc.' }
    if (input.end_date < input.start_date)
      return { error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' }

    const season: Season = {
      _id: 'season_' + Date.now(),
      name,
      start_date: input.start_date,
      end_date: input.end_date,
      description: input.description.trim(),
      created_at: new Date().toISOString(),
    }

    seasons.value.push(season)
    try {
      await store.seasons.create(season)
    } catch (err) {
      console.error('Lưu mùa giải mới thất bại.', err)
    }
    return { season }
  }

  /** Update a season; returns an error message on validation failure. */
  const updateSeason = async (input: {
    _id: string
    name: string
    start_date: string
    end_date: string
    description: string
  }): Promise<{ season?: Season; error?: string }> => {
    const name = input.name.trim()
    if (!name) return { error: 'Vui lòng nhập tên mùa giải.' }
    if (!input.start_date || !input.end_date)
      return { error: 'Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc.' }
    if (input.end_date < input.start_date)
      return { error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' }

    const season = seasons.value.find((s) => s._id === input._id)
    if (!season) return { error: 'Không tìm thấy mùa giải cần sửa.' }

    season.name = name
    season.start_date = input.start_date
    season.end_date = input.end_date
    season.description = input.description.trim()

    try {
      await store.seasons.update(season)
    } catch (err) {
      console.error('Cập nhật mùa giải thất bại.', err)
    }
    return { season }
  }

  const deleteSeason = async (id: string): Promise<{ error?: string }> => {
    const count = sessionsForSeason(id).length
    if (count > 0) {
      return {
        error: `Mùa giải này còn ${count} buổi chơi, vui lòng chuyển hoặc xóa các buổi chơi trước.`,
      }
    }
    seasons.value = seasons.value.filter((s) => s._id !== id)
    try {
      await store.seasons.remove(id)
    } catch (err) {
      console.error('Xóa mùa giải thất bại.', err)
    }
    return {}
  }

  /** Metadata-only session edit: date, note, season assignment. */
  const updateSessionMeta = async (input: {
    _id: string
    date: string
    note: string
    season_id: string | null
  }): Promise<{ session?: BatchSession; error?: string }> => {
    const session = sessions.value.find((s) => s._id === input._id)
    if (!session) return { error: 'Không tìm thấy buổi chơi cần sửa.' }

    session.date = new Date(input.date).toISOString()
    session.note = input.note.trim()
    session.season_id = input.season_id

    try {
      await store.sessions.update(session)
    } catch (err) {
      console.error('Cập nhật buổi chơi thất bại.', err)
    }
    return { session }
  }

  /** Delete a session and roll back its Elo effect on the involved players. */
  const deleteSession = async (id: string) => {
    const session = sessions.value.find((s) => s._id === id)
    if (!session) return

    const updatedPlayers = reverseBatchSession(players.value, session)
    updatedPlayers.forEach((updated) => {
      const idx = players.value.findIndex((p) => p._id === updated._id)
      if (idx !== -1) players.value[idx] = updated
    })

    sessions.value = sessions.value.filter((s) => s._id !== id)

    try {
      await store.players.saveAll(players.value)
      await store.sessions.remove(id)
    } catch (err) {
      console.error('Xóa buổi chơi thất bại.', err)
    }
  }

  return {
    seasons,
    sessions,
    players,
    load,
    sessionsForSeason,
    createSeason,
    updateSeason,
    deleteSeason,
    updateSessionMeta,
    deleteSession,
  }
}
