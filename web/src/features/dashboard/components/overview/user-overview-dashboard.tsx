/* Copyright (C) 2023-2026 QuantumNous */
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CreditCard, KeyRound } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

import { AnnouncementsPanel } from './announcements-panel'
import { ApiInfoPanel } from './api-info-panel'

export function UserOverviewDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const timeRange = useMemo(() => computeTimeRange(1), [])
  const usageQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'modelflare-usage', timeRange.start_timestamp, timeRange.end_timestamp],
    queryFn: () => getUserQuotaDates({ start_timestamp: timeRange.start_timestamp, end_timestamp: timeRange.end_timestamp, default_time: 'hour' }),
    staleTime: 60 * 1000,
  })

  const recentUsage = (usageQuery.data?.data ?? []).reduce((total, item) => total + (Number(item.quota) || 0), 0)
  const accountStanding =
    !user?.group || user.group === 'default' ? t('Basic') : user.group
  return (
    <div className='apimore-user-overview flex flex-col gap-4 sm:gap-5'>
      <div className='flex items-center justify-end gap-2 text-xs'>
        <span className='text-muted-foreground'>{t('Account standing')}</span>
        <span className='size-1.5 rounded-full bg-foreground/70' />
        <span className='font-medium'>{accountStanding}</span>
      </div>

      <section className='bg-card relative overflow-hidden border shadow-xs'>
        <span className='absolute inset-y-0 left-0 w-0.5 bg-lime-300' />
        <div className='flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
          <div className='flex min-w-0 items-center gap-3'>
            <span className='flex size-10 shrink-0 items-center justify-center bg-lime-300 text-black'><KeyRound className='size-5' /></span>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold'>{t('Create your API key')}</h3>
              <p className='text-muted-foreground mt-1 text-xs sm:text-sm'>{t('Create an API key, set the base URL, and send your first request.')}</p>
            </div>
          </div>
          <Link
            to='/keys'
            className='overview-create-key group inline-flex h-10 w-full shrink-0 items-center justify-between gap-3 rounded-[2px] border border-foreground bg-foreground px-4 text-sm font-semibold text-background outline-none transition-[background-color,color,border-color,transform] hover:border-lime-300 hover:bg-lime-300 hover:text-black focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:translate-y-px sm:w-auto sm:min-w-48'
          >
            <span className='flex items-center gap-2'>
              <KeyRound className='size-4' aria-hidden='true' />
              <span>{t('Create API Key')}</span>
            </span>
            <ArrowRight
              className='size-4 transition-transform group-hover:translate-x-0.5'
              aria-hidden='true'
            />
          </Link>
        </div>
      </section>

      <section className='bg-card overflow-hidden border shadow-xs'>
        <header className='flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5'>
          <div><h3 className='text-sm font-semibold'>{t('Credits and usage')}</h3><p className='text-muted-foreground mt-1 text-xs sm:text-sm'>{t('Monitor credits, usage, and request volume')}</p></div>
          <Button className='overview-secondary !rounded-[3px]' size='sm' render={<Link to='/wallet' />}><CreditCard data-icon='inline-start' />{t('Add credits')}</Button>
        </header>
        <div className='px-4 py-6 sm:px-6'>
          <p className='text-muted-foreground text-xs'>{t('Remaining credits')}</p>
          <p className='mt-1 font-mono text-3xl font-semibold tracking-tight sm:text-4xl'>{formatQuota(Number(user?.quota ?? 0))}</p>
        </div>
        <div className='flex flex-wrap items-center justify-between gap-2 border-y px-4 py-3 text-xs sm:px-5'>
          <span className='font-medium'>{t('Subscription plans')}</span>
          <Button className='overview-link !rounded-[3px]' variant='ghost' size='sm' render={<Link to='/wallet' />}>{t('View subscription plans')}<ArrowRight data-icon='inline-end' /></Button>
        </div>
        <div className='grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
          <UsageCell label={t('Last 24h usage')} value={formatQuota(recentUsage)} description={t('Consumed in the last 24 hours (USD)')} />
          <UsageCell label={t('Historical Usage')} value={formatQuota(Number(user?.used_quota ?? 0))} description={t('Total consumed (USD)')} />
          <UsageCell label={t('Request Count')} value={formatNumber(Number(user?.request_count ?? 0))} description={t('Requests (24h)')} />
        </div>
      </section>

      <div className='grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2'>
        <ApiInfoPanel />
        <AnnouncementsPanel />
      </div>

    </div>
  )
}

function UsageCell(props: { label: string; value: string; description: string }) {
  return <div className='px-4 py-4 sm:px-5 sm:py-5'><p className='text-muted-foreground text-xs'>{props.label}</p><p className='mt-2 font-mono text-xl font-semibold'>{props.value}</p><p className='text-muted-foreground mt-1 text-xs'>{props.description}</p></div>
}
