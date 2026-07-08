import type { InjectionKey } from 'vue'
import type { BatchSession, MatchRecord, Player } from '@/domain/types'

/**
 * Persistence contract for players. Swap the implementation (Supabase, REST,
 * localStorage, ...) without touching views or business logic.
 */
export interface PlayerRepository {
  getAll(): Promise<Player[]>
  /** Persist Elo-related fields for every given player (bulk update). */
  saveAll(players: Player[]): Promise<void>
  create(player: Player): Promise<void>
  update(player: Player): Promise<void>
  remove(id: string): Promise<void>
}

export interface SessionRepository {
  getAll(): Promise<BatchSession[]>
  add(session: BatchSession): Promise<void>
}

export interface MatchRepository {
  getAll(): Promise<MatchRecord[]>
  add(match: MatchRecord): Promise<void>
}

/** Aggregate root injected into the app. */
export interface DataStore {
  players: PlayerRepository
  sessions: SessionRepository
  matches: MatchRepository
}

/** DI token used with Vue's provide/inject. */
export const DataStoreKey: InjectionKey<DataStore> = Symbol('DataStore')
