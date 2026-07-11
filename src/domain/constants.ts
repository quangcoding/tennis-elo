import type { Player } from './types'

// --- LocalStorage keys ---
export const LOCAL_STORAGE_PLAYERS_KEY = 'tennis_elo_players_v1'
export const LOCAL_STORAGE_MATCHES_KEY = 'tennis_elo_matches_v1'
export const LOCAL_STORAGE_SESSIONS_KEY = 'tennis_elo_sessions_v1'
export const LOCAL_STORAGE_SEASONS_KEY = 'tennis_elo_seasons_v1'
export const LOCAL_STORAGE_DRAFT_KEY = 'tennis_elo_batch_draft_v1'

// --- Elo rules ---
export const OFFLINE_PENALTY = 0.25 // Phạt offline trực tiếp
export const ELO_PER_MATCH = 0.25 // Điểm cộng/trừ mỗi trận
export const MIN_SCORE = 5.0 // Sàn điểm Elo

// --- Guest ("vãng lai") participants: not tracked players, no Elo/stat effect ---
export const GUEST_ID_PREFIX = 'guest_'
export const GUEST_NAME = 'Vãng lai'
export const isGuestId = (id: string): boolean => id.startsWith(GUEST_ID_PREFIX)
export const makeGuestId = (): string =>
  `${GUEST_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const makeDefaultPlayer = (id: string, name: string): Player => ({
  _id: id,
  name,
  current_score: 6.0,
  initial_score: 6.0,
  created_at: '2026-07-01T00:00:00.000Z',
  matches_played: 0,
  wins: 0,
  losses: 0,
  history: [6.0],
})

export const DEFAULT_PLAYERS: Player[] = [
  makeDefaultPlayer('p01', 'Quang'),
  makeDefaultPlayer('p02', 'Tuyển'),
  makeDefaultPlayer('p03', 'Khánh'),
  makeDefaultPlayer('p04', 'Hoàng'),
  makeDefaultPlayer('p05', 'Hiếu'),
  makeDefaultPlayer('p06', 'Giang'),
  makeDefaultPlayer('p07', 'Tùng'),
  makeDefaultPlayer('p08', 'Long'),
]
