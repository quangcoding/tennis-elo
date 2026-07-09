import {
  DEFAULT_PLAYERS,
  LOCAL_STORAGE_MATCHES_KEY,
  LOCAL_STORAGE_PLAYERS_KEY,
  LOCAL_STORAGE_SEASONS_KEY,
  LOCAL_STORAGE_SESSIONS_KEY,
} from '@/domain/constants'
import type { BatchSession, MatchRecord, Player, Season } from '@/domain/types'
import type {
  DataStore,
  MatchRepository,
  PlayerRepository,
  SeasonRepository,
  SessionRepository,
} from '../types'

// A localStorage-backed DataStore. Kept as a drop-in alternative to the
// Supabase implementation to demonstrate that storage is swappable via DI.

const read = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
}

const players: PlayerRepository = {
  async getAll() {
    const cached = localStorage.getItem(LOCAL_STORAGE_PLAYERS_KEY)
    if (cached) return JSON.parse(cached) as Player[]
    const seeded = structuredClone(DEFAULT_PLAYERS)
    write(LOCAL_STORAGE_PLAYERS_KEY, seeded)
    return seeded
  },

  async saveAll(list) {
    write(LOCAL_STORAGE_PLAYERS_KEY, list)
  },

  async create(player) {
    const list = read<Player[]>(LOCAL_STORAGE_PLAYERS_KEY, [])
    list.push(player)
    write(LOCAL_STORAGE_PLAYERS_KEY, list)
  },

  async update(player) {
    const list = read<Player[]>(LOCAL_STORAGE_PLAYERS_KEY, [])
    const idx = list.findIndex((p) => p._id === player._id)
    if (idx !== -1) list[idx] = player
    write(LOCAL_STORAGE_PLAYERS_KEY, list)
  },

  async remove(id) {
    const list = read<Player[]>(LOCAL_STORAGE_PLAYERS_KEY, [])
    write(
      LOCAL_STORAGE_PLAYERS_KEY,
      list.filter((p) => p._id !== id),
    )
  },
}

const sessions: SessionRepository = {
  async getAll() {
    return read<BatchSession[]>(LOCAL_STORAGE_SESSIONS_KEY, [])
  },

  async add(session) {
    const list = read<BatchSession[]>(LOCAL_STORAGE_SESSIONS_KEY, [])
    list.unshift(session)
    write(LOCAL_STORAGE_SESSIONS_KEY, list)
  },

  async update(session) {
    const list = read<BatchSession[]>(LOCAL_STORAGE_SESSIONS_KEY, [])
    const idx = list.findIndex((s) => s._id === session._id)
    if (idx !== -1) list[idx] = session
    write(LOCAL_STORAGE_SESSIONS_KEY, list)
  },

  async remove(id) {
    const list = read<BatchSession[]>(LOCAL_STORAGE_SESSIONS_KEY, [])
    write(
      LOCAL_STORAGE_SESSIONS_KEY,
      list.filter((s) => s._id !== id),
    )
  },
}

const seasons: SeasonRepository = {
  async getAll() {
    return read<Season[]>(LOCAL_STORAGE_SEASONS_KEY, [])
  },

  async create(season) {
    const list = read<Season[]>(LOCAL_STORAGE_SEASONS_KEY, [])
    list.push(season)
    write(LOCAL_STORAGE_SEASONS_KEY, list)
  },

  async update(season) {
    const list = read<Season[]>(LOCAL_STORAGE_SEASONS_KEY, [])
    const idx = list.findIndex((s) => s._id === season._id)
    if (idx !== -1) list[idx] = season
    write(LOCAL_STORAGE_SEASONS_KEY, list)
  },

  async remove(id) {
    const list = read<Season[]>(LOCAL_STORAGE_SEASONS_KEY, [])
    write(
      LOCAL_STORAGE_SEASONS_KEY,
      list.filter((s) => s._id !== id),
    )
  },
}

const matches: MatchRepository = {
  async getAll() {
    return read<MatchRecord[]>(LOCAL_STORAGE_MATCHES_KEY, [])
  },

  async add(match) {
    const list = read<MatchRecord[]>(LOCAL_STORAGE_MATCHES_KEY, [])
    list.unshift(match)
    write(LOCAL_STORAGE_MATCHES_KEY, list)
  },
}

export const createLocalDataStore = (): DataStore => ({ players, sessions, matches, seasons })
