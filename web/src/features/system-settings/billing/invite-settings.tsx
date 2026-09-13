/* Copyright (C) 2023-2026 QuantumNous */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getInviteSettings,
  type InviteProgram,
} from '@/features/invite-rewards/api'
import { InviteHistory } from '@/features/invite-rewards/history'
import { api } from '@/lib/api'
import {
  formatQuota,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'

type Funding = {
  source: string
  user_id: number
  quota: number
  refunded_quota: number
  reward_quota: number
  legacy: boolean
}

export function InviteSettings() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['invite-settings'],
    queryFn: getInviteSettings,
  })
  const [draft, setDraft] = useState<InviteProgram | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Funding | null>(null)
  const [refunded, setRefunded] = useState('')
  const funding = useQuery({
    queryKey: ['invite-funding', page],
    enabled: showRecovery,
    queryFn: async () => {
      const result = await api.get('/api/option/invite-rewards/funding', {
        params: { p: page, page_size: 20 },
        skipBusinessError: true,
        skipErrorHandler: true,
      })
      if (!result.data.success) throw new Error('Failed to load')
      return result.data.data as { items: Funding[]; total: number }
    },
  })
  const recover = async () => {
    if (!selected || busy) return
    const quota = parseQuotaFromDollars(Number(refunded))
    if (
      !Number.isFinite(quota) ||
      quota < selected.refunded_quota ||
      quota > selected.quota
    ) {
      return
    }
    setBusy(true)
    setNotice('')
    try {
      const result = await api.post(
        '/api/option/invite-rewards/reverse',
        { source: selected.source, refunded_quota: quota },
        { skipBusinessError: true, skipErrorHandler: true }
      )
      if (!result.data.success) throw new Error()
      setSelected(null)
      await funding.refetch()
      await client.invalidateQueries({ queryKey: ['invite-history'] })
      await client.invalidateQueries({ queryKey: ['invite-journal'] })
      setNotice('Settings saved successfully')
    } catch {
      setNotice('Could not save invite settings. Reload before retrying.')
    } finally {
      setBusy(false)
    }
  }
  const value = draft ?? query.data
  const save = async () => {
    if (!value || busy) return
    setBusy(true)
    setNotice('')
    try {
      const result = await api.put('/api/option/invite-rewards', value, {
        skipBusinessError: true,
        skipErrorHandler: true,
      })
      if (!result.data.success) throw new Error()
      setDraft(null)
      await query.refetch()
      setNotice('Settings saved successfully')
    } catch {
      setNotice('Could not save invite settings. Reload before retrying.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      className='space-y-5 rounded-lg border p-5'
      aria-label={t('Invite friends settings')}
    >
      <h3 className='text-lg font-semibold'>{t('Invite friends settings')}</h3>
      {query.isError && <p role='alert'>{t('Failed to load')}</p>}
      {!value && query.isPending && <p>{t('Loading')}</p>}
      <Button
        variant='outline'
        onClick={() => {
          setDraft(null)
          void query.refetch()
        }}
      >
        {t('Refresh')}
      </Button>
      {value && (
        <form
          className='max-w-3xl space-y-5'
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className='flex items-center gap-3'>
            <input
              type='checkbox'
              checked={value.enabled}
              onChange={(e) =>
                setDraft({ ...value, enabled: e.target.checked })
              }
              disabled={busy}
            />
            {t('Enable Invite friends')}
          </label>
          <div className='space-y-2'>
            <p className='font-medium'>{t('Reward mode')}</p>
            <p className='text-muted-foreground text-sm'>
              {t('First eligible credit only')}
            </p>
          </div>
          <div className='space-y-2'>
            <label htmlFor='invite-rate'>
              {t('Reward rate per person (%)')}
            </label>
            <Input
              id='invite-rate'
              type='number'
              min='0'
              max='100'
              step='0.01'
              required
              value={value.rate_bps / 100}
              disabled={busy}
              onChange={(e) =>
                setDraft({
                  ...value,
                  rate_bps: Math.round(Number(e.target.value) * 100),
                })
              }
            />
            <p className='text-muted-foreground text-sm'>
              {t(
                'Each person receives this percentage; the total bonus is twice this rate.'
              )}
            </p>
          </div>
          <div className='space-y-2'>
            <label htmlFor='invite-hold'>{t('Hold hours')}</label>
            <Input
              id='invite-hold'
              type='number'
              min='0'
              max='8760'
              step='1'
              required
              value={value.hold_hours}
              disabled={busy}
              onChange={(e) =>
                setDraft({ ...value, hold_hours: Number(e.target.value) })
              }
            />
            <p className='text-muted-foreground text-sm'>
              {t('0 hours makes rewards immediately available.')}
            </p>
          </div>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Changes apply to future credits only. Earlier transactions are not rewarded again.'
            )}
          </p>
          <Button type='submit' disabled={busy}>
            {t(busy ? 'Saving...' : 'Save Settings')}
          </Button>
        </form>
      )}
      <details
        open={showRecovery}
        onToggle={(event) => setShowRecovery(event.currentTarget.open)}
        className='border-t pt-4'
      >
        <summary className='cursor-pointer font-medium'>
          {t('Reward recovery')}
        </summary>
        <p className='text-muted-foreground my-3 text-sm'>
          {t(
            'Recover rewards after a confirmed refund. This does not refund the original payment.'
          )}
        </p>
        {funding.isError && <p role='alert'>{t('Failed to load')}</p>}
        <ul className='space-y-2'>
          {funding.data?.items.map((row) => (
            <li
              key={row.source}
              className='flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm'
            >
              <div className='min-w-0'>
                <span>
                  {t('User ID')} {row.user_id} · {formatQuota(row.quota)}
                </span>
                <p
                  className='max-w-96 truncate font-mono text-xs'
                  title={row.source}
                >
                  {row.source}
                </p>
              </div>
              <Button
                variant='outline'
                size='sm'
                disabled={
                  busy ||
                  row.legacy ||
                  row.reward_quota <= 0 ||
                  row.refunded_quota >= row.quota
                }
                onClick={() => {
                  setSelected(row)
                  setRefunded(String(quotaUnitsToDollars(row.quota)))
                }}
              >
                {t('Recover rewards')}
              </Button>
            </li>
          ))}
        </ul>
        <div className='mt-3 flex gap-2'>
          <Button
            variant='outline'
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t('Previous')}
          </Button>
          <Button
            variant='outline'
            disabled={!funding.data || page * 20 >= funding.data.total}
            onClick={() => setPage(page + 1)}
          >
            {t('Next')}
          </Button>
        </div>
        {selected && (
          <form
            className='mt-4 space-y-3 rounded border p-4'
            onSubmit={(event) => {
              event.preventDefault()
              void recover()
            }}
          >
            <label htmlFor='invite-refunded'>
              {t('Cumulative refunded Credits')}
            </label>
            <Input
              id='invite-refunded'
              type='number'
              min={quotaUnitsToDollars(selected.refunded_quota)}
              max={quotaUnitsToDollars(selected.quota)}
              step='any'
              required
              value={refunded}
              onChange={(event) => setRefunded(event.target.value)}
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Enter the total refunded amount, including earlier partial refunds.'
              )}
            </p>
            <div className='flex gap-2'>
              <Button type='submit' disabled={busy}>
                {t('Confirm')}
              </Button>
              <Button
                variant='outline'
                type='button'
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                {t('Cancel')}
              </Button>
            </div>
          </form>
        )}
      </details>
      {notice && <p role='status'>{t(notice)}</p>}
      <InviteHistory admin />
    </section>
  )
}
