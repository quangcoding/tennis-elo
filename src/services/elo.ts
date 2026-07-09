import { ELO_PER_MATCH, MIN_SCORE, OFFLINE_PENALTY } from '@/domain/constants'
import type {
  BatchPlayerEntry,
  BatchSession,
  BatchSessionChange,
  MatchRecord,
  Player,
  PlayerEloChange,
} from '@/domain/types'
import { getQuarter } from './format'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Preview the Elo delta for a single batch entry (no side effects). */
export const previewBatchElo = (entry: BatchPlayerEntry): number => {
  if (entry.offline) return -OFFLINE_PENALTY
  const losses = entry.games_played - entry.wins
  return round2(entry.wins * ELO_PER_MATCH - losses * ELO_PER_MATCH)
}

export interface BatchComputation {
  session: BatchSession
  /** New player snapshots (clones) with updated score/history/stats applied. */
  updatedPlayers: Player[]
}

/**
 * Pure batch-session calculation. Given current players and the form entries,
 * returns the resulting session record plus updated (cloned) player states.
 * Callers are responsible for committing these to reactive state / storage.
 */
export const computeBatchSession = (
  players: Player[],
  entries: BatchPlayerEntry[],
  opts: { date: string; note?: string; seasonId?: string | null },
): BatchComputation => {
  const sessionDate = new Date(opts.date).toISOString()
  const quarter = getQuarter(opts.date)
  const sessionId = 'session_' + Date.now()

  const changes: BatchSessionChange[] = []
  const updatedPlayers: Player[] = []

  entries.forEach((entry) => {
    const source = players.find((p) => p._id === entry.player_id)
    if (!source) return

    // Work on a clone so the input array stays untouched until committed.
    const player: Player = { ...source, history: [...source.history] }

    let eloGain: number
    let newScore: number

    if (entry.offline) {
      eloGain = -OFFLINE_PENALTY
      newScore = round2(Math.max(MIN_SCORE, player.current_score + eloGain))
      player.current_score = newScore
      player.history.push(newScore)
    } else {
      const losses = entry.games_played - entry.wins
      eloGain = round2(entry.wins * ELO_PER_MATCH - losses * ELO_PER_MATCH)
      newScore = round2(Math.max(MIN_SCORE, player.current_score + eloGain))
      player.current_score = newScore
      player.matches_played += entry.games_played
      player.wins += entry.wins
      player.losses += losses
      player.history.push(newScore)
    }

    updatedPlayers.push(player)
    changes.push({
      member_id: player._id,
      name: player.name,
      games_played: entry.games_played,
      wins: entry.wins,
      offline: entry.offline,
      elo_gain: eloGain,
      elo_after: newScore,
    })
  })

  const session: BatchSession = {
    _id: sessionId,
    date: sessionDate,
    quarter,
    note: opts.note || `Buổi chơi ${new Date(opts.date).toLocaleDateString('vi-VN')}`,
    changes,
    season_id: opts.seasonId ?? null,
  }

  return { session, updatedPlayers }
}

/**
 * Reverses a previously-committed batch session: undoes each player's Elo
 * gain/loss, match/win/loss counters, and the matching history snapshot.
 * Pure — callers commit the returned player snapshots via `players.saveAll`.
 */
export const reverseBatchSession = (players: Player[], session: BatchSession): Player[] => {
  const updatedPlayers: Player[] = []

  session.changes.forEach((change) => {
    const source = players.find((p) => p._id === change.member_id)
    if (!source) return

    const player: Player = { ...source, history: [...source.history] }

    player.current_score = round2(Math.max(MIN_SCORE, player.current_score - change.elo_gain))

    if (!change.offline) {
      const losses = change.games_played - change.wins
      player.matches_played -= change.games_played
      player.wins -= change.wins
      player.losses -= losses
    }

    const historyIdx = player.history.lastIndexOf(change.elo_after)
    if (historyIdx !== -1) player.history.splice(historyIdx, 1)

    updatedPlayers.push(player)
  })

  return updatedPlayers
}

export interface MatchComputation {
  match: MatchRecord
  /** New player snapshots (clones) with updated score/history/stats applied. */
  updatedPlayers: Player[]
  winners: PlayerEloChange[]
  losers: PlayerEloChange[]
  change: number
}

/**
 * Pure single-match calculation (singles or doubles). Winners gain
 * ELO_PER_MATCH, losers lose the same (floored at MIN_SCORE). Returns the
 * match record plus updated (cloned) player states; callers commit them.
 */
export const computeMatchResult = (
  players: Player[],
  winnerIds: string[],
  loserIds: string[],
  opts: { score: string; playedAt: string },
): MatchComputation => {
  const clone = (p: Player): Player => ({ ...p, history: [...p.history] })
  const winnerPlayers = winnerIds
    .map((id) => players.find((p) => p._id === id))
    .filter((p): p is Player => Boolean(p))
    .map(clone)
  const loserPlayers = loserIds
    .map((id) => players.find((p) => p._id === id))
    .filter((p): p is Player => Boolean(p))
    .map(clone)

  const eloChange = ELO_PER_MATCH

  const winners: PlayerEloChange[] = []
  const losers: PlayerEloChange[] = []

  // Apply Elo changes — each player gets the full change (not split)
  winnerPlayers.forEach((p) => {
    const oldElo = p.current_score
    p.current_score = round2(p.current_score + eloChange)
    p.matches_played += 1
    p.wins += 1
    p.history.push(p.current_score)
    winners.push({ name: p.name, oldElo, newElo: p.current_score })
  })
  loserPlayers.forEach((p) => {
    const oldElo = p.current_score
    p.current_score = round2(Math.max(MIN_SCORE, p.current_score - eloChange))
    p.matches_played += 1
    p.losses += 1
    p.history.push(p.current_score)
    losers.push({ name: p.name, oldElo, newElo: p.current_score })
  })

  const match: MatchRecord = {
    id: 'm_' + Date.now(),
    winner_ids: winnerPlayers.map((p) => p._id),
    winner_names: winnerPlayers.map((p) => p.name),
    loser_ids: loserPlayers.map((p) => p._id),
    loser_names: loserPlayers.map((p) => p.name),
    score: opts.score,
    elo_change: eloChange,
    played_at: opts.playedAt,
  }

  return {
    match,
    updatedPlayers: [...winnerPlayers, ...loserPlayers],
    winners,
    losers,
    change: eloChange,
  }
}
