/* Copyright (C) 2023-2026 QuantumNous */
import { api } from '@/lib/api'

export type InviteProgram = {
  enabled: boolean
  mode: 'first' | 'all'
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
