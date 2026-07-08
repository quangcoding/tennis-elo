import { computed, ref } from 'vue'
import { DEFAULT_PLAYERS } from '@/domain/constants'
import type { Player } from '@/domain/types'
import { useDataStore } from '@/data/provider'

export type PlayersSortBy = 'name' | 'elo_desc' | 'elo_asc' | 'matches_desc'

/** Player CRUD state + actions for PlayersView, backed by the injected DataStore. */
export function usePlayersManager() {
  const store = useDataStore()

  const players = ref<Player[]>([])
  const searchQuery = ref('')
  const sortBy = ref<PlayersSortBy>('name')

  const load = async () => {
    try {
      const data = await store.players.getAll()
      players.value = data.length > 0 ? data : structuredClone(DEFAULT_PLAYERS)
    } catch (err) {
      console.error('Không tải được danh sách tuyển thủ.', err)
      players.value = structuredClone(DEFAULT_PLAYERS)
    }
  }

  const filteredPlayers = computed(() => {
    let result = [...players.value]

    if (searchQuery.value.trim() !== '') {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter((p) => p.name.toLowerCase().includes(q))
    }

    if (sortBy.value === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    else if (sortBy.value === 'elo_desc') result.sort((a, b) => b.current_score - a.current_score)
    else if (sortBy.value === 'elo_asc') result.sort((a, b) => a.current_score - b.current_score)
    else if (sortBy.value === 'matches_desc')
      result.sort((a, b) => b.matches_played - a.matches_played)

    return result
  })

  const nameExists = (name: string, exceptId?: string) =>
    players.value.some(
      (p) => p._id !== exceptId && p.name.toLowerCase() === name.toLowerCase(),
    )

  /** Create a player; returns the created player or an error message. */
  const createPlayer = async (input: {
    name: string
    initial_score: number
  }): Promise<{ player?: Player; error?: string }> => {
    const name = input.name.trim()
    const initialScore = Number(input.initial_score)

    if (!name) return { error: 'Vui lòng nhập tên tuyển thủ.' }
    if (nameExists(name)) return { error: 'Tên tuyển thủ đã tồn tại trong danh sách.' }
    if (isNaN(initialScore) || initialScore < 0)
      return { error: 'Điểm Elo ban đầu phải là một số lớn hơn hoặc bằng 0.' }

    const player: Player = {
      _id: 'p_' + Date.now(),
      name,
      initial_score: initialScore,
      current_score: initialScore,
      created_at: new Date().toISOString(),
      matches_played: 0,
      wins: 0,
      losses: 0,
      history: [initialScore],
    }

    players.value.push(player)
    try {
      await store.players.create(player)
    } catch (err) {
      console.error('Lưu tuyển thủ mới thất bại.', err)
    }
    return { player }
  }

  /** Update a player; returns an error message on validation failure. */
  const updatePlayer = async (input: {
    _id: string
    name: string
    initial_score: number
    current_score: number
  }): Promise<{ player?: Player; error?: string }> => {
    const name = input.name.trim()
    const initialScore = Number(input.initial_score)
    const currentScore = Number(input.current_score)

    if (!name) return { error: 'Vui lòng nhập tên tuyển thủ.' }
    if (nameExists(name, input._id))
      return { error: 'Tên tuyển thủ đã tồn tại trong danh sách.' }
    if (isNaN(initialScore) || initialScore < 0 || isNaN(currentScore) || currentScore < 0)
      return { error: 'Điểm Elo phải là số lớn hơn hoặc bằng 0.' }

    const player = players.value.find((p) => p._id === input._id)
    if (!player) return { error: 'Không tìm thấy tuyển thủ cần sửa.' }

    if (player.initial_score !== initialScore && player.history.length > 0) {
      player.history[0] = initialScore
    }
    player.name = name
    player.initial_score = initialScore
    player.current_score = currentScore

    try {
      await store.players.update(player)
    } catch (err) {
      console.error('Cập nhật tuyển thủ thất bại.', err)
    }
    return { player }
  }

  const deletePlayer = async (id: string) => {
    players.value = players.value.filter((p) => p._id !== id)
    try {
      await store.players.remove(id)
    } catch (err) {
      console.error('Xóa tuyển thủ thất bại.', err)
    }
  }

  return {
    players,
    searchQuery,
    sortBy,
    filteredPlayers,
    load,
    createPlayer,
    updatePlayer,
    deletePlayer,
  }
}
