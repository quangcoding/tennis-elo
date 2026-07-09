import { supabase } from '@/utils/supabase'
import type { BatchSession, MatchRecord, Player, Season } from '@/domain/types'
import type {
  DataStore,
  MatchRepository,
  PlayerRepository,
  SeasonRepository,
  SessionRepository,
} from '../types'

const players: PlayerRepository = {
  async getAll() {
    const { data, error } = await supabase.from('players').select('*')
    if (error) throw error
    return (data ?? []) as Player[]
  },

  async saveAll(list) {
    const updates = list.map((player) =>
      supabase
        .from('players')
        .update({
          current_score: player.current_score,
          history: player.history,
          losses: player.losses,
          wins: player.wins,
          matches_played: player.matches_played,
        })
        .eq('_id', player._id),
    )
    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  },

  async create(player) {
    const { error } = await supabase.from('players').insert([player])
    if (error) throw error
  },

  async update(player) {
    const { error } = await supabase
      .from('players')
      .update({
        name: player.name,
        initial_score: player.initial_score,
        current_score: player.current_score,
        history: player.history,
      })
      .eq('_id', player._id)
    if (error) throw error
  },

  async remove(id) {
    const { error } = await supabase.from('players').delete().eq('_id', id)
    if (error) throw error
  },
}

const sessions: SessionRepository = {
  async getAll() {
    const { data, error } = await supabase.from('sessions').select('*')
    if (error) throw error
    return (data ?? []) as BatchSession[]
  },

  async add(session) {
    const { error } = await supabase.from('sessions').insert([session])
    if (error) throw error
  },

  async update(session) {
    const { error } = await supabase
      .from('sessions')
      .update({
        date: session.date,
        quarter: session.quarter,
        note: session.note,
        season_id: session.season_id,
      })
      .eq('_id', session._id)
    if (error) throw error
  },

  async remove(id) {
    const { error } = await supabase.from('sessions').delete().eq('_id', id)
    if (error) throw error
  },
}

const seasons: SeasonRepository = {
  async getAll() {
    const { data, error } = await supabase.from('seasons').select('*')
    if (error) throw error
    return (data ?? []) as Season[]
  },

  async create(season) {
    const { error } = await supabase.from('seasons').insert([season])
    if (error) throw error
  },

  async update(season) {
    const { error } = await supabase
      .from('seasons')
      .update({
        name: season.name,
        start_date: season.start_date,
        end_date: season.end_date,
        description: season.description,
      })
      .eq('_id', season._id)
    if (error) throw error
  },

  async remove(id) {
    const { error } = await supabase.from('seasons').delete().eq('_id', id)
    if (error) throw error
  },
}

const matches: MatchRepository = {
  async getAll() {
    const { data, error } = await supabase.from('matches').select('*')
    if (error) throw error
    return (data ?? []) as MatchRecord[]
  },

  async add(match) {
    const { error } = await supabase.from('matches').insert([match])
    if (error) throw error
  },
}

export const createSupabaseDataStore = (): DataStore => ({ players, sessions, matches, seasons })
