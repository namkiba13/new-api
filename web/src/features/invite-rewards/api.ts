/* Copyright (C) 2023-2026 QuantumNous */
import { api } from '@/lib/api'

export type InviteProgram = {
  enabled: boolean
  mode: 'first'
  rate_bps: number
  hold_hours: number
  revision: number
}
export type InviteSummary = {
  program: InviteProgram
  code: string
  qualified: number
  pending: number
  pending_quota: number
  released: number
  reversed: number
  balance: number
  lifetime: number
  debt: number
  received?: {
    pending: number
    pending_quota: number
    released: number
    released_quota: number
    reversed: number
    credited_quota: number | null
    offset_quota: number | null
  }
}

export type InviteHistoryRow = {
  source: string
  user_id: number
  inviter_id: number
  invitee_name: string
  inviter_name: string
  quota: number
  rate_bps: number
  reward_quota: number
  reversed_quota: number
  created_at: number
  available_at: number
  released_at: number
  status: 'pending' | 'released' | 'reversed'
  role: 'inviter' | 'invitee' | ''
  net_credit: number | null
  offset: number | null
  journal_complete: boolean
  recipients?: {
    user_id: number
    username: string
    role: string
    net_credit: number | null
    offset: number | null
  }[]
}
export type InviteJournalEntry = {
  id: number
  source: string
  user_id: number
  username: string
  role: string
  action: 'earned' | 'released' | 'transferred' | 'reversed'
  principal: number
  rate_bps: number
  gross: number
  offset: number
  wallet_delta: number
  reward_delta: number
  debt_delta: number
  before: { wallet: number; rewards: number; debt: number } | null
  after: { wallet: number; rewards: number; debt: number } | null
  legacy: boolean
  created_at: number
}
export async function getInviteHistory(
  admin: boolean,
  params: Record<string, string | number>
): Promise<{ items: InviteHistoryRow[]; total: number }> {
  const { data } = await api.get(
    admin
      ? '/api/option/invite-rewards/history'
      : '/api/user/invite-rewards/history',
    { params, skipErrorHandler: true, skipBusinessError: true }
  )
  if (!data.success) throw new Error('Failed to load')
  return data.data
}
export async function getInviteJournal(
  admin: boolean,
  params: Record<string, string | number>
): Promise<{ items: InviteJournalEntry[]; total: number }> {
  const { data } = await api.get(
    admin
      ? '/api/option/invite-rewards/journal'
      : '/api/user/invite-rewards/journal',
    { params, skipErrorHandler: true, skipBusinessError: true }
  )
  if (!data.success) throw new Error('Failed to load')
  return data.data
}
export async function getInviteRewards(): Promise<InviteSummary> {
  const { data } = await api.get('/api/user/invite-rewards', {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  if (!data.success) throw new Error('Failed to load')
  return data.data
}
export async function getInviteSettings(): Promise<InviteProgram> {
  const { data } = await api.get('/api/option/invite-rewards', {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  if (!data.success) throw new Error('Failed to load')
  return data.data
}
