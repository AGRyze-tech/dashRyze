import { createClient } from '@/lib/supabase'
import type { Habit, HabitLog, HabitType } from '@/types'

type Db = ReturnType<typeof createClient>

export type HabitInput = {
  name: string
  category?: string | null
  type: HabitType
  target?: number | null
  unit?: string | null
  color: string
  icon?: string | null
  sort_order?: number
}

export function habitRepository(db: Db) {
  return {
    // A leitura de hábitos é liberada entre a equipe, então filtramos pelo
    // usuário cuja rotina está sendo vista (o próprio ou um colega).
    async findAll(userId: string): Promise<Habit[]> {
      const { data, error } = await db
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as Habit[]
    },

    async logsInRange(userId: string, from: string, to: string): Promise<HabitLog[]> {
      const { data, error } = await db
        .from('habit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
      if (error) throw error
      return (data ?? []) as HabitLog[]
    },

    // Leituras de equipe (todos os membros) para o comparativo.
    async teamHabits(): Promise<Pick<Habit, 'id' | 'user_id' | 'type' | 'target'>[]> {
      const { data, error } = await db
        .from('habits')
        .select('id, user_id, type, target')
        .eq('active', true)
      if (error) throw error
      return (data ?? []) as Pick<Habit, 'id' | 'user_id' | 'type' | 'target'>[]
    },

    async teamLogsInRange(from: string, to: string): Promise<Pick<HabitLog, 'habit_id' | 'user_id' | 'date' | 'value'>[]> {
      const { data, error } = await db
        .from('habit_logs')
        .select('habit_id, user_id, date, value')
        .gte('date', from)
        .lte('date', to)
      if (error) throw error
      return (data ?? []) as Pick<HabitLog, 'habit_id' | 'user_id' | 'date' | 'value'>[]
    },

    async create(userId: string, input: HabitInput): Promise<Habit> {
      const { data, error } = await db
        .from('habits')
        .insert([{ ...input, user_id: userId }])
        .select()
        .single()
      if (error) throw error
      return data as Habit
    },

    async update(id: string, input: Partial<HabitInput>): Promise<Habit> {
      const { data, error } = await db
        .from('habits')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Habit
    },

    // Soft delete: mantém o histórico de logs, só some da lista.
    async remove(id: string): Promise<void> {
      const { error } = await db.from('habits').update({ active: false }).eq('id', id)
      if (error) throw error
    },

    // Grava o valor do dia para um hábito (upsert pela unique habit_id+date).
    // value = 1 marca um hábito booleano como feito; 0 desmarca. Para hábito
    // numérico, value é a quantidade acumulada no dia.
    async setLog(userId: string, habitId: string, date: string, value: number): Promise<HabitLog> {
      const { data, error } = await db
        .from('habit_logs')
        .upsert({ habit_id: habitId, user_id: userId, date, value }, { onConflict: 'habit_id,date' })
        .select()
        .single()
      if (error) throw error
      return data as HabitLog
    },
  }
}
