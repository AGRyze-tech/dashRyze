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
    // RLS já restringe ao usuário logado; não precisa filtrar por user_id aqui.
    async findAll(): Promise<Habit[]> {
      const { data, error } = await db
        .from('habits')
        .select('*')
        .eq('active', true)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as Habit[]
    },

    async logsInRange(from: string, to: string): Promise<HabitLog[]> {
      const { data, error } = await db
        .from('habit_logs')
        .select('*')
        .gte('date', from)
        .lte('date', to)
      if (error) throw error
      return (data ?? []) as HabitLog[]
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
