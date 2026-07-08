import {
  ELO_PER_MATCH,
  MATCHES_PER_SESSION,
  MIN_SCORE,
  OFFLINE_PENALTY,
} from '@/domain/constants'
import type { BatchPlayerEntry, BatchSession, BatchSessionChange, Player } from '@/domain/types'
import { getQuarter } from './format'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Preview the Elo delta for a single batch entry (no side effects). */
export const previewBatchElo = (entry: BatchPlayerEntry): number => {
  if (entry.offline) return -OFFLINE_PENALTY
  const losses = MATCHES_PER_SESSION - entry.wins
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
  opts: { date: string; note?: string },
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
      const losses = MATCHES_PER_SESSION - entry.wins
      eloGain = round2(entry.wins * ELO_PER_MATCH - losses * ELO_PER_MATCH)
      newScore = round2(Math.max(MIN_SCORE, player.current_score + eloGain))
      player.current_score = newScore
      player.matches_played += MATCHES_PER_SESSION
      player.wins += entry.wins
      player.losses += losses
      player.history.push(newScore)
    }

    updatedPlayers.push(player)
    changes.push({
      member_id: player._id,
      name: player.name,
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
  }

  return { session, updatedPlayers }
}
