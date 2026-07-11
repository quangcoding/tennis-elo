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
  // Many matches belong to one BatchSession (the day's session), if any.
  session_id: string | null
  // Legacy compat fields (single string)
  winner_id?: string
  winner_name?: string
  loser_id?: string
  loser_name?: string
}

export interface BatchSessionChange {
  member_id: string
  name: string
  games_played: number
  wins: number
  offline: boolean
  elo_gain: number
  elo_after: number
}

export interface BatchSession {
  _id: string
  date: string
  quarter: string
  note: string
  changes: BatchSessionChange[]
  season_id: string | null
}

export interface Season {
  _id: string
  name: string
  start_date: string
  end_date: string
  description: string
  created_at: string
}

/** One player's result within a batch session, derived from that day's recorded matches. */
export interface BatchPlayerEntry {
  player_id: string
  games_played: number // actual matches played that day (0 if offline)
  wins: number // actual wins that day; losses = games_played - wins
  offline: boolean // if true: flat penalty, no matches counted
}

export interface PlayerEloChange {
  name: string
  oldElo: number
  newElo: number
}
