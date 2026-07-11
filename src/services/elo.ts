import { ELO_PER_MATCH, GUEST_NAME, MIN_SCORE, OFFLINE_PENALTY, isGuestId } from '@/domain/constants'
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
 *
 * Non-offline entries are a *snapshot only* — their Elo/stats were already
 * applied individually when each match was recorded (see `computeMatchResult`),
 * so this must not re-apply them here (that would double-count). Only the
 * `offline` flat penalty is actually applied by this function, since offline
 * players have no match records of their own.
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

    if (entry.offline) {
      eloGain = -OFFLINE_PENALTY
      const newScore = round2(Math.max(MIN_SCORE, player.current_score + eloGain))
      player.current_score = newScore
      player.history.push(newScore)
    } else {
      // Already applied per-match; just snapshot the resulting figures.
      const losses = entry.games_played - entry.wins
      eloGain = round2(entry.wins * ELO_PER_MATCH - losses * ELO_PER_MATCH)
    }

    updatedPlayers.push(player)
    changes.push({
      member_id: player._id,
      name: player.name,
      games_played: entry.games_played,
      wins: entry.wins,
      offline: entry.offline,
      elo_gain: eloGain,
      elo_after: player.current_score,
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
 * Reverses a previously-committed batch session. Only `offline` changes
 * actually mutated a player (a flat penalty with no match record behind it) —
 * non-offline changes are snapshots of matches that apply/reverse themselves
 * independently, so they're left untouched here.
 * Pure — callers commit the returned player snapshots via `players.saveAll`.
 */
export const reverseBatchSession = (players: Player[], session: BatchSession): Player[] => {
  const updatedPlayers: Player[] = []

  session.changes.forEach((change) => {
    if (!change.offline) return

    const source = players.find((p) => p._id === change.member_id)
    if (!source) return

    const player: Player = { ...source, history: [...source.history] }
    player.current_score = round2(Math.max(MIN_SCORE, player.current_score - change.elo_gain))

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
 *
 * `winnerIds`/`loserIds` may include guest ("vãng lai") ids — walk-in players
 * who aren't tracked members. Guests are kept in the match record (by name)
 * for display, but never resolve to a `Player`, so they get no Elo/stat change.
 */
export const computeMatchResult = (
  players: Player[],
  winnerIds: string[],
  loserIds: string[],
  opts: { score: string; playedAt: string; sessionId: string | null },
): MatchComputation => {
  const clone = (p: Player): Player => ({ ...p, history: [...p.history] })
  const resolveName = (id: string) => (isGuestId(id) ? GUEST_NAME : (players.find((p) => p._id === id)?.name ?? ''))
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
    winner_ids: winnerIds,
    winner_names: winnerIds.map(resolveName),
    loser_ids: loserIds,
    loser_names: loserIds.map(resolveName),
    score: opts.score,
    elo_change: eloChange,
    played_at: opts.playedAt,
    session_id: opts.sessionId,
  }

  return {
    match,
    updatedPlayers: [...winnerPlayers, ...loserPlayers],
    winners,
    losers,
    change: eloChange,
  }
}

/**
 * Reverses a previously-recorded single match: undoes the Elo/stat change for
 * each real player involved (guests never had one to begin with) and removes
 * the matching history snapshot. Pure — callers commit the returned player
 * snapshots via `players.saveAll` and remove the match record themselves.
 */
export const reverseMatchResult = (players: Player[], match: MatchRecord): Player[] => {
  const clone = (p: Player): Player => ({ ...p, history: [...p.history] })
  const updatedPlayers: Player[] = []

  match.winner_ids.forEach((id) => {
    const source = players.find((p) => p._id === id)
    if (!source) return
    const player = clone(source)
    const eloAfter = player.current_score
    player.current_score = round2(player.current_score - match.elo_change)
    player.matches_played -= 1
    player.wins -= 1
    const historyIdx = player.history.lastIndexOf(eloAfter)
    if (historyIdx !== -1) player.history.splice(historyIdx, 1)
    updatedPlayers.push(player)
  })

  match.loser_ids.forEach((id) => {
    const source = players.find((p) => p._id === id)
    if (!source) return
    const player = clone(source)
    const eloAfter = player.current_score
    player.current_score = round2(player.current_score + match.elo_change)
    player.matches_played -= 1
    player.losses -= 1
    const historyIdx = player.history.lastIndexOf(eloAfter)
    if (historyIdx !== -1) player.history.splice(historyIdx, 1)
    updatedPlayers.push(player)
  })

  return updatedPlayers
}
