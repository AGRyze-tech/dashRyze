import { MetaCampaign } from '@/types'

export const META_STORAGE_KEY = 'ryze_meta_campaigns'

export function loadMetaCampaigns(): MetaCampaign[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(META_STORAGE_KEY) ?? '[]') } catch { return [] }
}

export function saveMetaCampaigns(campaigns: MetaCampaign[]): void {
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(campaigns))
}
