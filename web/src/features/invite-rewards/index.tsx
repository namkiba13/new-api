import {
  WalletCardsIcon,
  FileClockIcon,
  GiftIcon,
  Link01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  UserGroupIcon,
  Coins01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
/* Copyright (C) 2023-2026 QuantumNous */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { SectionPageLayout } from '@/components/layout/components/section-page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
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
      'Invite friends. You both get {{rate}} of the first eligible credit in Credits.'
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
      await client.invalidateQueries({ queryKey: ['invite-history'] })
      await client.invalidateQueries({ queryKey: ['invite-transfers'] })
      await client.invalidateQueries({ queryKey: ['invite-journal'] })
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
        <div className='invite-rewards-page @container/invite flex min-w-0 flex-col gap-6'>
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
                <div
                  data-slot='invite-hero'
                  className='grid min-w-0 @5xl/invite:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]'
                >
                  <div className='flex min-w-0 flex-col gap-6 p-5 sm:p-8'>
                    <span className='bg-muted/40 flex w-fit items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium'>
                      <HugeiconsIcon
                        icon={GiftIcon}
                        className='size-4'
                        strokeWidth={1.5}
                        aria-hidden='true'
                      />
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
                        <div className='relative min-w-0 flex-1'>
                          <HugeiconsIcon
                            icon={Link01Icon}
                            className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2'
                            strokeWidth={1.5}
                            aria-hidden='true'
                          />
                          <Input
                            id='invite-link'
                            readOnly
                            value={link}
                            className='min-w-0 ps-9 font-mono text-xs'
                          />
                        </div>
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
                  <div className='bg-muted/40 flex min-w-0 flex-col justify-center gap-6 border-t p-5 sm:p-8 @5xl/invite:border-t-0 @5xl/invite:border-l'>
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
                        <HugeiconsIcon
                          icon={FileClockIcon}
                          strokeWidth={1.5}
                          className='size-4 shrink-0'
                          aria-hidden='true'
                        />
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
                    <CardTitle>{t('Rewards from my referrals')}</CardTitle>
                    <p className='text-muted-foreground text-sm'>
                      {t(
                        'Pending rewards become transferable after the safety period.'
                      )}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    className='w-full sm:w-auto'
                    disabled={busy || data.balance <= 0 || data.debt > 0}
                    onClick={() => void transfer()}
                  >
                    <HugeiconsIcon
                      icon={WalletCardsIcon}
                      className='size-4'
                      strokeWidth={1.5}
                      aria-hidden='true'
                    />
                    {t(
                      data.balance > 0
                        ? 'Transfer all rewards'
                        : 'No reward balance yet'
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <dl
                    data-slot='invite-stats'
                    className='grid gap-3 sm:grid-cols-2 @5xl/invite:grid-cols-4'
                  >
                    {[
                      {
                        label: 'Qualified credits',
                        value: number.format(data.qualified),
                        icon: UserGroupIcon,
                      },
                      {
                        label: 'Rewards in safety period',
                        value: number.format(data.pending),
                        icon: FileClockIcon,
                        detail: t('{{amount}} pending Credits', {
                          amount: formatQuota(data.pending_quota),
                        }),
                      },
                      {
                        label: 'Rewards released',
                        value: number.format(data.released),
                        icon: GiftIcon,
                      },
                      {
                        label: 'Rewards reversed',
                        value: number.format(data.reversed),
                        icon: CancelCircleIcon,
                      },
                      {
                        label: 'Reward balance',
                        value: formatQuota(data.balance),
                        icon: Coins01Icon,
                      },
                      {
                        label: 'Lifetime rewards',
                        value: formatQuota(data.lifetime),
                        icon: GiftIcon,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className='bg-muted/30 flex min-w-0 items-start gap-3 rounded-md border p-4'
                      >
                        <IconBadge
                          size='lg'
                          className='bg-background text-foreground size-9 rounded-md [&>svg]:size-4'
                        >
                          <HugeiconsIcon icon={item.icon} strokeWidth={1.5} />
                        </IconBadge>
                        <div className='min-w-0'>
                          <dt className='text-muted-foreground text-sm'>
                            {t(item.label)}
                          </dt>
                          <dd className='mt-1 font-mono text-lg font-semibold break-words'>
                            {item.value}
                          </dd>
                          {item.detail && (
                            <dd className='text-muted-foreground mt-1 text-xs'>
                              {item.detail}
                            </dd>
                          )}
                        </div>
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
              {data.received && (
                <Card data-slot='invite-received'>
                  <CardHeader>
                    <CardTitle>{t('My reward for being invited')}</CardTitle>
                    <p className='text-muted-foreground text-sm'>
                      {t(
                        'Your welcome reward is added directly to usable Credits after the hold.'
                      )}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <dl className='grid gap-3 sm:grid-cols-3'>
                      <div
                        className='bg-muted/30 rounded-md border p-4'
                        data-slot='invite-received-pending'
                      >
                        <dt className='text-muted-foreground text-sm'>
                          {t('Rewards in safety period')}
                        </dt>
                        <dd className='mt-2 font-mono text-lg font-semibold'>
                          {number.format(data.received.pending)}
                        </dd>
                        <dd className='text-sm'>
                          {t('{{amount}} pending Credits', {
                            amount: formatQuota(data.received.pending_quota),
                          })}
                        </dd>
                      </div>
                      <div
                        className='bg-muted/30 rounded-md border p-4'
                        data-slot='invite-received-credit'
                      >
                        <dt className='text-muted-foreground text-sm'>
                          {t('Credits added to your wallet')}
                        </dt>
                        <dd className='mt-2 font-mono text-lg font-semibold'>
                          {data.received.credited_quota === null
                            ? '—'
                            : formatQuota(data.received.credited_quota)}
                        </dd>
                        <dd className='text-sm'>
                          {t('Rewards released')}:{' '}
                          {number.format(data.received.released)}
                        </dd>
                      </div>
                      <div className='bg-muted/30 rounded-md border p-4'>
                        <dt className='text-muted-foreground text-sm'>
                          {t('Rewards reversed')}
                        </dt>
                        <dd className='mt-2 font-mono text-lg font-semibold'>
                          {number.format(data.received.reversed)}
                        </dd>
                      </div>
                    </dl>
                    {data.received.credited_quota === null && (
                      <p className='text-muted-foreground mt-3 text-xs'>
                        {t(
                          'Older balance snapshots are unavailable. No historical amounts have been invented.'
                        )}
                      </p>
                    )}
                    {Boolean(data.received.offset_quota) && (
                      <p className='mt-3 text-sm'>
                        {t('Applied to reward debt')}:{' '}
                        {formatQuota(data.received.offset_quota ?? 0)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
              <div className='grid gap-6 @5xl/invite:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('How It Works')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol
                      data-slot='invite-steps'
                      className='grid gap-6 @3xl/invite:grid-cols-3'
                    >
                      {[
                        {
                          icon: Link01Icon,
                          text: 'Get and share your personal invitation link',
                          description:
                            'Your link records who invited your friend when they register.',
                        },
                        {
                          icon: UserGroupIcon,
                          text: 'Your friend registers and receives an eligible credit',
                          description:
                            'Only their first eligible credit earns rewards for both of you.',
                        },
                        {
                          icon: FileClockIcon,
                          text: 'After the waiting period, both of you receive rewards',
                          description:
                            'Your reward becomes transferable; your friend receives usable Credits.',
                        },
                      ].map((step, index) => (
                        <li key={step.text} className='flex items-start gap-3'>
                          <IconBadge
                            size='lg'
                            className='text-foreground rounded-full [&>svg]:size-4'
                          >
                            <HugeiconsIcon icon={step.icon} strokeWidth={1.5} />
                          </IconBadge>
                          <div className='min-w-0 space-y-1.5'>
                            <span className='text-muted-foreground block text-xs'>
                              {number.format(index + 1).padStart(2, '0')}
                            </span>
                            <p className='text-sm leading-relaxed'>
                              {t(step.text)}
                            </p>
                            <p className='text-muted-foreground text-xs leading-5'>
                              {t(step.description)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <span className='mb-2 inline-flex w-fit items-center gap-2 rounded-md border px-2 py-1 text-xs'>
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        className='size-3.5'
                        strokeWidth={1.5}
                        aria-hidden='true'
                      />
                      {t('Program rules')}
                    </span>
                    <CardTitle>{t('Clear and fair rewards')}</CardTitle>
                    <p className='text-muted-foreground text-sm'>
                      {t('Credits, not cash')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className='space-y-4'>
                      {[
                        'Only the first eligible credit across all three sources earns rewards.',
                        'Refunded credits cause the related rewards to be recovered.',
                        'Rewards, transfers, API refunds, signup gifts and check-ins do not earn referral rewards.',
                        'Only the direct inviter and the referred friend receive rewards.',
                      ].map((rule) => (
                        <li
                          key={rule}
                          className='flex gap-3 text-sm leading-relaxed'
                        >
                          <IconBadge className='text-foreground rounded-full'>
                            <HugeiconsIcon
                              icon={CheckmarkCircle02Icon}
                              strokeWidth={1.5}
                            />
                          </IconBadge>
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
