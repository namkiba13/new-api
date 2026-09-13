/* Copyright (C) 2023-2026 QuantumNous */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import {
  getInviteHistory,
  getInviteJournal,
  type InviteHistoryRow,
  type InviteJournalEntry,
} from './api'

const actionLabels = {
  earned: 'Reward recorded',
  released: 'Reward released',
  transferred: 'Reward transferred',
  reversed: 'Reward recovered',
} as const
const statusLabels = {
  pending: 'Pending',
  released: 'Released',
  reversed: 'Reversed',
} as const
const sourceLabels: Record<string, string> = {
  topup: 'Online payment',
  redeem: 'Redeem code',
  admin: 'Admin credit',
  transfer: 'Reward transfer',
}

function JournalEntries(props: { items: InviteJournalEntry[] }) {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(toIntlLocale(i18n.language), {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return (
    <ol className='space-y-3'>
      {props.items.map((entry) => (
        <li
          key={entry.id}
          className='rounded-lg border p-4'
          data-slot='invite-journal-entry'
        >
          <div className='flex flex-wrap justify-between gap-2'>
            <strong>{t(actionLabels[entry.action])}</strong>
            <time
              dateTime={new Date(entry.created_at * 1000).toISOString()}
              className='text-muted-foreground text-xs'
            >
              {date.format(entry.created_at * 1000)}
            </time>
          </div>
          <p className='mt-1 text-sm'>
            {entry.username || `#${entry.user_id}`} ·{' '}
            {t(entry.role === 'invitee' ? 'Invited friend' : 'Inviter')}
          </p>
          <dl className='mt-3 grid gap-3 text-sm sm:grid-cols-2'>
            <div>
              <dt className='text-muted-foreground'>
                {t(
                  entry.action === 'transferred'
                    ? 'Transfer Amount'
                    : 'Gross reward'
                )}
              </dt>
              <dd>{formatQuota(entry.gross)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>
                {t('Applied to reward debt')}
              </dt>
              <dd>{formatQuota(entry.offset)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>
                {t('Usable Credits change')}
              </dt>
              <dd>{formatQuota(entry.wallet_delta)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>
                {t('Reward balance change')}
              </dt>
              <dd>{formatQuota(entry.reward_delta)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>
                {t('Reward debt change')}
              </dt>
              <dd>{formatQuota(entry.debt_delta)}</dd>
            </div>
          </dl>
          {entry.before && entry.after ? (
            <div className='mt-3 space-y-1 border-t pt-3 text-xs'>
              <p className='font-medium'>{t('Balances before → after')}</p>
              <p>
                {t('Usable Credits')}: {formatQuota(entry.before.wallet)} →{' '}
                {formatQuota(entry.after.wallet)}
              </p>
              <p>
                {t('Reward balance')}: {formatQuota(entry.before.rewards)} →{' '}
                {formatQuota(entry.after.rewards)}
              </p>
              <p>
                {t('Reward debt')}: {formatQuota(entry.before.debt)} →{' '}
                {formatQuota(entry.after.debt)}
              </p>
            </div>
          ) : (
            <p className='text-muted-foreground mt-3 text-xs'>
              {t(
                'Older balance snapshots are unavailable. No historical amounts have been invented.'
              )}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

export function InviteHistory(props: { admin?: boolean }) {
  const { t, i18n } = useTranslation()
  const userID = useAuthStore((s) => s.auth.user?.id)
  const [view, setView] = useState(props.admin ? 'all' : 'inviter')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    q: '',
    source_kind: '',
    status: '',
    from: '',
    to: '',
  })
  const [selected, setSelected] = useState<InviteHistoryRow | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const transfers = view === 'transfers'
  const params = {
    ...filters,
    page,
    page_size: 10,
    role: props.admin || transfers ? '' : view,
    from: filters.from
      ? Math.floor(new Date(`${filters.from}T00:00:00`).getTime() / 1000)
      : 0,
    to: filters.to
      ? Math.floor(new Date(`${filters.to}T23:59:59`).getTime() / 1000)
      : 0,
  }
  const history = useQuery({
    queryKey: ['invite-history', props.admin, userID, view, params],
    queryFn: () => getInviteHistory(Boolean(props.admin), params),
    enabled: !transfers,
    refetchInterval: 30000,
  })
  const moves = useQuery({
    queryKey: ['invite-transfers', props.admin, userID, params],
    queryFn: () =>
      getInviteJournal(Boolean(props.admin), { ...params, transfers: 'true' }),
    enabled: transfers,
    refetchInterval: 30000,
  })
  const journal = useQuery({
    queryKey: [
      'invite-journal',
      props.admin,
      userID,
      selected?.source,
      detailPage,
    ],
    queryFn: () =>
      getInviteJournal(Boolean(props.admin), {
        source: selected?.source ?? '',
        page: detailPage,
        page_size: 20,
      }),
    enabled: Boolean(selected),
    refetchInterval: 30000,
  })
  const active = transfers ? moves : history
  const date = new Intl.DateTimeFormat(toIntlLocale(i18n.language), {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const percent = new Intl.NumberFormat(toIntlLocale(i18n.language), {
    style: 'percent',
    maximumFractionDigits: 2,
  })
  const stamp = (time: number) => (time > 0 ? date.format(time * 1000) : '—')
  const currentRow =
    history.data?.items.find((row) => row.source === selected?.source) ??
    selected

  return (
    <Card
      data-slot={props.admin ? 'invite-admin-history' : 'invite-user-history'}
    >
      <CardHeader>
        <CardTitle>{t('Referral reward history')}</CardTitle>
        <p className='text-muted-foreground text-sm'>
          {t('Track each reward, release, transfer and recovery.')}
        </p>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div
          className='flex flex-wrap gap-2'
          role='group'
          aria-label={t('Reward history view')}
        >
          {(props.admin
            ? [
                ['all', 'All rewards'],
                ['transfers', 'Reward transfers'],
              ]
            : [
                ['inviter', 'Rewards from my referrals'],
                ['invitee', 'My reward for being invited'],
                ['transfers', 'Reward transfers'],
              ]
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={view === key ? 'default' : 'outline'}
              size='sm'
              aria-pressed={view === key}
              onClick={() => {
                setView(key)
                setPage(1)
              }}
            >
              {t(label)}
            </Button>
          ))}
        </div>
        <form
          className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            setFilters({
              q: String(data.get('q') ?? ''),
              source_kind: String(data.get('source_kind') ?? ''),
              status: String(data.get('status') ?? ''),
              from: String(data.get('from') ?? ''),
              to: String(data.get('to') ?? ''),
            })
            setPage(1)
          }}
        >
          <label className='space-y-1 text-xs'>
            {t('Account or transaction')}
            <Input name='q' maxLength={128} defaultValue={filters.q} />
          </label>
          {!transfers && (
            <label className='space-y-1 text-xs'>
              {t('Credit source')}
              <select
                name='source_kind'
                className='bg-background h-9 w-full rounded-md border px-2'
                defaultValue={filters.source_kind}
              >
                <option value=''>{t('All')}</option>
                {['topup', 'redeem', 'admin'].map((key) => (
                  <option key={key} value={key}>
                    {t(sourceLabels[key])}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!transfers && (
            <label className='space-y-1 text-xs'>
              {t('Status')}
              <select
                name='status'
                className='bg-background h-9 w-full rounded-md border px-2'
                defaultValue={filters.status}
              >
                <option value=''>{t('All')}</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className='space-y-1 text-xs'>
            {t('From date')}
            <Input type='date' name='from' defaultValue={filters.from} />
          </label>
          <label className='space-y-1 text-xs'>
            {t('To date')}
            <Input type='date' name='to' defaultValue={filters.to} />
          </label>
          <div className='flex gap-2'>
            <Button type='submit' size='sm'>
              {t('Filter')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => void active.refetch()}
            >
              {t('Refresh')}
            </Button>
          </div>
        </form>
        {active.isPending && <p role='status'>{t('Loading')}</p>}
        {active.isError && <p role='alert'>{t('Failed to load')}</p>}
        {active.data?.items.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            {t('No reward history yet')}
          </p>
        )}
        {transfers && moves.data && <JournalEntries items={moves.data.items} />}
        {!transfers && history.data && history.data.items.length > 0 && (
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full min-w-[880px] text-left text-sm'>
              <thead className='bg-muted/40'>
                <tr>
                  {[
                    'Participants',
                    'Credit source',
                    'Original credit',
                    'Applied rate',
                    'Gross reward',
                    'Actual credit at release',
                    'Status',
                    'Details',
                  ].map((label) => (
                    <th key={label} className='p-3 font-medium'>
                      {t(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.data.items.map((row) => (
                  <tr
                    key={row.source}
                    className='border-t'
                    data-slot='invite-history-row'
                  >
                    <td className='p-3'>
                      <p>
                        {t('Inviter')}:{' '}
                        {row.inviter_name || `#${row.inviter_id}`}{' '}
                        <span className='text-muted-foreground'>
                          #{row.inviter_id}
                        </span>
                      </p>
                      <p>
                        {t('Invited friend')}:{' '}
                        {row.invitee_name || `#${row.user_id}`}{' '}
                        <span className='text-muted-foreground'>
                          #{row.user_id}
                        </span>
                      </p>
                    </td>
                    <td className='p-3'>
                      <p>
                        {t(
                          sourceLabels[row.source.split(':')[0]] ??
                            'Credit source'
                        )}
                      </p>
                      <p
                        title={row.source}
                        className='text-muted-foreground max-w-36 truncate font-mono text-xs'
                      >
                        {row.source}
                      </p>
                      <time className='text-xs'>{stamp(row.created_at)}</time>
                    </td>
                    <td className='p-3 font-mono'>{formatQuota(row.quota)}</td>
                    <td className='p-3'>
                      {percent.format(row.rate_bps / 10000)}
                    </td>
                    <td className='p-3 font-mono'>
                      {formatQuota(row.reward_quota)}
                      <span className='text-muted-foreground block font-sans text-xs'>
                        {t(props.admin ? 'Per participant' : 'Your reward')}
                      </span>
                    </td>
                    <td className='p-3'>
                      {props.admin ? (
                        row.recipients?.map((person) => (
                          <p key={person.user_id}>
                            {person.username || `#${person.user_id}`}:{' '}
                            {person.net_credit === null
                              ? '—'
                              : formatQuota(person.net_credit)}
                            {Boolean(person.offset) && (
                              <span className='text-muted-foreground block text-xs'>
                                {t('Applied to reward debt')}:{' '}
                                {formatQuota(person.offset ?? 0)}
                              </span>
                            )}
                          </p>
                        ))
                      ) : (
                        <>
                          <p>
                            {row.net_credit === null
                              ? '—'
                              : formatQuota(row.net_credit)}
                          </p>
                          {Boolean(row.offset) && (
                            <p className='text-xs'>
                              {t('Applied to reward debt')}:{' '}
                              {formatQuota(row.offset ?? 0)}
                            </p>
                          )}
                        </>
                      )}
                    </td>
                    <td className='p-3'>
                      <p>{t(statusLabels[row.status])}</p>
                      {row.status === 'pending' && (
                        <p className='text-muted-foreground text-xs'>
                          {t('Available at')}: {stamp(row.available_at)}
                        </p>
                      )}
                      {row.reversed_quota > 0 && (
                        <p className='text-xs'>
                          {t('Reward recovered')}:{' '}
                          {formatQuota(row.reversed_quota)}
                        </p>
                      )}
                      {!row.journal_complete && (
                        <p className='text-muted-foreground text-xs'>
                          {t('Historical record')}
                        </p>
                      )}
                    </td>
                    <td className='p-3'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setSelected(row)
                          setDetailPage(1)
                        }}
                      >
                        {t('Details')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className='flex items-center justify-between gap-3'>
          <span className='text-muted-foreground text-xs'>
            {t('Total:')} {active.data?.total ?? '—'}
          </span>
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('Previous')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={!active.data || page * 10 >= active.data.total}
              onClick={() => setPage(page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={t('Reward transaction details')}
        contentClassName='sm:max-w-3xl'
        bodyClassName='space-y-4'
        contentHeight='min(75vh, 800px)'
      >
        {currentRow && (
          <>
            <p className='font-mono text-xs break-all'>{currentRow.source}</p>
            <p className='text-sm'>
              {t('Original credit')}: {formatQuota(currentRow.quota)} ·{' '}
              {t('Applied rate')}: {percent.format(currentRow.rate_bps / 10000)}
            </p>
            {!currentRow.journal_complete && (
              <p
                role='status'
                className='bg-muted/40 rounded border p-3 text-sm'
              >
                {t(
                  'Older balance snapshots are unavailable. No historical amounts have been invented.'
                )}
              </p>
            )}
          </>
        )}
        {journal.isPending && <p>{t('Loading')}</p>}
        {journal.isError && <p role='alert'>{t('Failed to load')}</p>}
        {journal.data && <JournalEntries items={journal.data.items} />}
        {journal.data?.items.length === 0 && (
          <p>
            {t('No detailed entries are available for this historical record.')}
          </p>
        )}
        <div className='flex gap-2'>
          <Button
            variant='outline'
            disabled={detailPage <= 1}
            onClick={() => setDetailPage(detailPage - 1)}
          >
            {t('Previous')}
          </Button>
          <Button
            variant='outline'
            disabled={!journal.data || detailPage * 20 >= journal.data.total}
            onClick={() => setDetailPage(detailPage + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      </Dialog>
    </Card>
  )
}
