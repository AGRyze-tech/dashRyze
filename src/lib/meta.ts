import { MetaCampaign } from '@/types'
import { createClient } from '@/lib/supabase'

export async function loadMetaCampaigns(): Promise<MetaCampaign[]> {
  const supabase = createClient()
  const { data } = await supabase.from('meta_campaigns').select('*').order('created_at')
  return (data ?? []) as MetaCampaign[]
}

export async function saveMetaCampaign(campaign: MetaCampaign): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('meta_campaigns')
    .upsert({ ...campaign, updated_at: new Date().toISOString() })
}

export async function deleteMetaCampaign(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('meta_campaigns').delete().eq('id', id)
}
