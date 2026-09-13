/* Copyright (C) 2023-2026 QuantumNous */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  Gift,
  Link as LinkIcon,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { SectionPageLayout } from '@/components/layout/components/section-page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { api, getSelf } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { getInviteRewards } from './api'

export function InviteRewards() {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['invite-rewards'],
    queryFn: getInviteRewards,
    refetchInterval: 30000,
  })
  const unit = useSystemConfigStore((s) => s.config.currency.quotaPerUnit)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const data = query.data
  const number = new Intl.NumberFormat(toIntlLocale(i18n.language))
  const rate = new Intl.NumberFormat(toIntlLocale(i18n.language), {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format((data?.program.rate_bps ?? 0) / 10000)
  let headline = 'Invite friends'
  if (data?.program.enabled) {
    headline =
      data.program.mode === 'first'
        ? 'Invite friends. You both get {{rate}} of the first eligible credit in Credits.'
        : 'Invite friends. You both get {{rate}} of every eligible credit in Credits.'
  }
  const link = data?.code
    ? new URL(
        `/sign-up?aff=${encodeURIComponent(data.code)}`,
        window.location.origin
      ).href
    : ''

  const generate = async () => {
    setBusy(true)
    setNotice('')
    try {
      const response = await api.get('/api/user/aff')
      if (!response.data.success) throw new Error()
      await query.refetch()
    } catch {
      setNotice('Failed to load')
    } finally {
      setBusy(false)
    }
  }
  const transfer = async () => {
    if (busy || !data || data.balance <= 0 || data.debt > 0) return
    setBusy(true)
    setNotice('')
    try {
      // Keep the key after ambiguous failures and across reloads. A retry must
      // return the original result rather than transferring new rewards again.
      const storageKey = `invite-transfer:${data.code}`
      const key = sessionStorage.getItem(storageKey) || crypto.randomUUID()
      sessionStorage.setItem(storageKey, key)
      const result = await api.post(
        '/api/user/invite-rewards/transfer',
        {},
        {
          headers: { 'Idempotency-Key': key },
          skipBusinessError: true,
          skipErrorHandler: true,
        }
      )
      if (!result.data.success) throw new Error()
      sessionStorage.removeItem(storageKey)
      setNotice('Rewards added to credits')
      const self = await getSelf().catch(() => null)
      if (self?.success) useAuthStore.getState().auth.setUser(self.data)
      await client.invalidateQueries({ queryKey: ['invite-rewards'] })
      await client.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      setNotice('Reward transfer failed. Retry safely.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invite friends')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='invite-rewards-page flex min-w-0 flex-col gap-6'>
          {query.isPending && <Skeleton className='h-72 w-full' />}
          {query.isError && (
            <div role='alert' className='space-y-3 rounded-lg border p-6'>
              <p>{t('Failed to load')}</p>
              <Button onClick={() => void query.refetch()}>{t('Retry')}</Button>
            </div>
          )}
          {data && (
            <>
              {!data.program.enabled && (
                <div role='status' className='bg-muted rounded-lg border p-4'>
                  {t('Invite programme paused')}
                </div>
              )}
              <Card className='gap-0 overflow-hidden py-0'>
                <div className='grid min-w-0 xl:grid-cols-[1.35fr_1fr]'>
                  <div className='flex min-w-0 flex-col gap-6 p-5 sm:p-8'>
                    <span className='flex items-center gap-2 text-sm'>
                      <Gift className='size-4' aria-hidden='true' />
                      {t('Friend invitation campaign')}
                    </span>
                    <h2 className='max-w-2xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl'>
                      {t(headline, { rate })}
                    </h2>
                    <p className='text-muted-foreground leading-relaxed'>
                      {t(
                        'Share your link. Your friend registers through it, then tops up, redeems a code, or receives an admin credit.'
                      )}
                    </p>
                    <div className='space-y-2'>
                      <label
                        htmlFor='invite-link'
                        className='text-sm font-medium'
                      >
                        {t('Invite link')}
                      </label>
                      <div className='flex min-w-0 flex-wrap gap-2'>
                        <Input
                          id='invite-link'
                          readOnly
                          value={link}
                          className='min-w-0 flex-1 font-mono text-xs'
                        />
                        {link ? (
                          <CopyButton
                            value={link}
                            variant='outline'
                            size='default'
                            className='h-9 shrink-0 px-3'
                            iconClassName='mr-2 size-4'
                            aria-label={t('Copy link')}
                          >
                            {t('Copy link')}
                          </CopyButton>
                        ) : (
                          <Button
                            disabled={busy}
                            onClick={() => void generate()}
                          >
                            {t('Generate link')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='bg-muted/40 flex min-w-0 flex-col justify-center gap-6 border-t p-5 sm:p-8 xl:border-t-0 xl:border-l'>
                    <div>
                      <p className='text-muted-foreground text-sm'>
                        {t('Each of you receives')}
                      </p>
                      <p className='mt-2 font-mono text-6xl font-semibold'>
                        {rate}
                      </p>
                      <span className='text-sm'>{t('Credits, not cash')}</span>
                    </div>
                    <div className='space-y-4 border-t pt-5'>
                      <p>
                        {t('Example: {{amount}} is credited to your friend', {
                          amount: formatQuota(unit * 100),
                        })}
                      </p>
                      <dl className='grid grid-cols-2 gap-4'>
                        {['Your friend gets', 'You get'].map((label) => (
                          <div key={label}>
                            <dt className='text-muted-foreground text-xs'>
                              {t(label)}
                            </dt>
                            <dd className='mt-2 font-mono text-2xl font-semibold'>
                              {formatQuota(
                                Math.floor((unit * data.program.rate_bps) / 100)
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className='flex items-center gap-2 text-sm'>
                        <Clock className='size-4 shrink-0' aria-hidden='true' />
                        {data.program.hold_hours === 0
                          ? t('Available immediately')
                          : t('Released after {{hours}} hours', {
                              hours: number.format(data.program.hold_hours),
                            })}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='space-y-2'>
                    <CardTitle>{t('Invite Rewards')}</CardTitle>
                    <p className='text-muted-foreground text-sm'>
                      {t(
                        'Pending rewards become transferable after the safety period.'
                      )}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    disabled={busy || data.balance <= 0 || data.debt > 0}
                    onClick={() => void transfer()}
                  >
                    {t(
                      data.balance > 0
                        ? 'Transfer all rewards'
                        : 'No reward balance yet'
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <dl className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                    {[
                      ['Qualified credits', number.format(data.qualified)],
                      [
                        'Rewards in safety period',
                        `${number.format(data.pending)} · ${formatQuota(data.pending_quota)}`,
                      ],
                      ['Rewards released', number.format(data.released)],
                      ['Rewards reversed', number.format(data.reversed)],
                      ['Reward balance', formatQuota(data.balance)],
                      ['Lifetime rewards', formatQuota(data.lifetime)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className='bg-muted/30 min-w-0 rounded-md border p-4'
                      >
                        <dt className='text-muted-foreground text-sm'>
                          {t(label)}
                        </dt>
                        <dd className='mt-2 font-mono text-xl font-semibold break-words'>
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {data.debt > 0 && (
                    <p role='status' className='mt-4 text-sm'>
                      {t(
                        'Outstanding reward recovery: {{amount}}. Future rewards repay it before transfers resume.',
                        { amount: formatQuota(data.debt) }
                      )}
                    </p>
                  )}
                  {notice && (
                    <p role='status' className='mt-4 text-sm'>
                      {t(notice)}
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className='grid gap-6 xl:grid-cols-[1.35fr_1fr]'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('How It Works')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className='grid gap-6 md:grid-cols-3'>
                      {[
                        {
                          icon: LinkIcon,
                          text: 'Get and share your personal invitation link',
                        },
                        {
                          icon: Wallet,
                          text: 'Your friend registers and receives an eligible credit',
                        },
                        {
                          icon: Clock,
                          text: 'After the waiting period, both of you receive rewards',
                        },
                      ].map((step, index) => (
                        <li key={step.text} className='space-y-3'>
                          <step.icon
                            className='bg-muted size-8 rounded-full p-1.5'
                            aria-hidden='true'
                          />
                          <span className='text-muted-foreground block text-xs'>
                            {number.format(index + 1).padStart(2, '0')}
                          </span>
                          <p className='text-sm leading-relaxed'>
                            {t(step.text)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Program rules')}</CardTitle>
                    <p className='text-muted-foreground text-sm'>
                      {t('Credits, not cash')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className='space-y-4'>
                      {[
                        data.program.mode === 'first'
                          ? 'Only the first eligible credit across all three sources earns rewards.'
                          : 'Every eligible credit across all three sources earns rewards.',
                        'Refunded credits cause the related rewards to be recovered.',
                        'Rewards, transfers, API refunds, signup gifts and check-ins do not earn referral rewards.',
                        'Only the direct inviter and the referred friend receive rewards.',
                      ].map((rule) => (
                        <li
                          key={rule}
                          className='flex gap-3 text-sm leading-relaxed'
                        >
                          <ShieldCheck
                            className='text-muted-foreground mt-0.5 size-4 shrink-0'
                            aria-hidden='true'
                          />
                          <span>{t(rule)}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
