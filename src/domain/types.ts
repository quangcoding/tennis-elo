// --- Domain models shared across views ---

export interface Player {
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

export interface MatchRecord {
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

export interface BatchSessionChange {
  member_id: string
  name: string
  elo_gain: number
  elo_after: number
}

export interface BatchSession {
  _id: string
  date: string
  quarter: string
  note: string
  changes: BatchSessionChange[]
}

/** One player's result within a batch session input form. */
export interface BatchPlayerEntry {
  player_id: string
  wins: number // 0–2 (total matches per session = 2, losses = 2 - wins)
  offline: boolean // if true: flat penalty, no match counted
}

export interface PlayerEloChange {
  name: string
  oldElo: number
  newElo: number
}
