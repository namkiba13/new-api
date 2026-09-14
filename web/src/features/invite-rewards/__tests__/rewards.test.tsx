/* Copyright (C) 2023-2026 QuantumNous */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import i18n from '@/i18n/config'
import messages from '@/i18n/invite-messages.json'
import { toIntlLocale } from '@/i18n/languages'
import { api } from '@/lib/api'

import { InviteRewards } from '..'
import type { InviteSummary } from '../api'

let client: QueryClient
const summary: InviteSummary = {
  program: {
    enabled: true,
    mode: 'first',
    rate_bps: 0,
    hold_hours: 0,
    revision: 1,
  },
  code: 'test-referral',
  qualified: 0,
  pending: 0,
  pending_quota: 0,
  released: 0,
  reversed: 0,
  balance: 400000,
  lifetime: 400000,
  debt: 0,
  received: {
    pending: 0,
    pending_quota: 0,
    released: 0,
    released_quota: 0,
    reversed: 0,
    credited_quota: 0,
    offset_quota: 0,
  },
}
beforeEach(async () => {
  sessionStorage.clear()
  for (const [locale, copy] of Object.entries(messages)) {
    i18n.addResourceBundle(locale, 'translation', copy, true, true)
  }
  await i18n.changeLanguage('en')
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  for (const locale of Object.keys(messages)) {
    i18n.removeResourceBundle(locale, 'translation')
  }
})
async function show() {
  const root = createRootRoute({ component: InviteRewards })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
it('renders User reward summaries without detailed history or administrator controls', async () => {
  vi.spyOn(api, 'get').mockImplementation(
    async (url) =>
      ({
        data: {
          success: true,
          data: url.endsWith('/history') ? { items: [], total: 0 } : summary,
        },
      }) as Awaited<ReturnType<typeof api.get>>
  )
  await show()
  expect(
    await screen.findByRole('heading', {
      name: 'Invite friends. You both get 0% of the first eligible payment in Credits.',
    })
  ).toBeVisible()
  expect(screen.getAllByText('Available immediately')[0]).toBeVisible()
  expect(screen.queryByLabelText('Reward mode')).not.toBeInTheDocument()
  expect(screen.queryByText('Referral reward history')).not.toBeInTheDocument()
  expect(screen.getAllByText('Invite Rewards')).toHaveLength(1)
  expect(
    screen.queryByText('My reward for being invited')
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Details' })
  ).not.toBeInTheDocument()
})
it('shows a retry rather than a zero balance when the rewards API fails', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('unavailable'))
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  expect(screen.queryByText('Reward balance')).not.toBeInTheDocument()
})
it('keeps the transfer idempotency key after an ambiguous failure', async () => {
  vi.spyOn(api, 'get').mockImplementation(
    async (url) =>
      ({
        data: {
          success: true,
          data: url.endsWith('/history') ? { items: [], total: 0 } : summary,
        },
      }) as Awaited<ReturnType<typeof api.get>>
  )
  const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('timeout'))
  await show()
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Add rewards to credits' })
  )
  await screen.findByText('Failed to transfer rewards')
  await user.click(
    screen.getByRole('button', { name: 'Add rewards to credits' })
  )
  expect(post).toHaveBeenCalledTimes(2)
  expect(post.mock.calls[0][2]?.headers?.['Idempotency-Key']).toBe(
    post.mock.calls[1][2]?.headers?.['Idempotency-Key']
  )
  expect(post.mock.calls[0][1]).toEqual({})
})
it('translates every new message and preserves interpolation tokens in all seven languages', () => {
  const keys = Object.keys(messages.en).sort()
  expect(Object.keys(messages)).toHaveLength(7)
  for (const locale of Object.values(messages)) {
    expect(Object.keys(locale).sort()).toEqual(keys)
    for (const key of keys as (keyof typeof messages.en)[]) {
      expect(locale[key].trim()).not.toBe('')
      expect(locale[key].match(/\{\{[^}]+\}\}/g) ?? []).toEqual(
        messages.en[key].match(/\{\{[^}]+\}\}/g) ?? []
      )
    }
  }
})

it('shows an unknown historical lifetime as unavailable rather than zero', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { ...summary, lifetime: null } },
  })
  await show()
  const label = await screen.findByText('Lifetime rewards')
  expect(label.parentElement).toHaveTextContent('—')
})

it('uses the exact Vietnamese headline and first-payment rule approved by the owner', () => {
  expect(
    messages.vi[
      'Invite friends. You both get {{rate}} of the first eligible credit in Credits.'
    ]
  ).toBe(
    'Mời bạn bè. Cả hai nhận Credits bằng {{rate}} lần thanh toán đầu tiên đủ điều kiện.'
  )
  expect(
    messages.vi[
      'Only the first eligible credit across all three sources earns rewards.'
    ]
  ).toBe(
    'Chỉ lần thanh toán đầu tiên đủ điều kiện mới nhận được phần thưởng này.'
  )
})

it.each(
  (Object.keys(messages) as (keyof typeof messages)[]).flatMap((locale) =>
    [0, 1, 24].map((hours) => ({ locale, hours }))
  )
)(
  'renders $locale reference copy with a $hours-hour hold and dynamic rate',
  async ({ locale, hours }) => {
    await i18n.changeLanguage(locale)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          ...summary,
          program: { ...summary.program, rate_bps: 1000, hold_hours: hours },
        },
      },
    })
    await show()
    const copy = messages[locale]
    const rate = new Intl.NumberFormat(toIntlLocale(locale), {
      style: 'percent',
    }).format(0.1)
    expect(
      await screen.findByRole('heading', {
        name: copy[
          'Invite friends. You both get {{rate}} of the first eligible credit in Credits.'
        ].replace('{{rate}}', rate),
      })
    ).toBeVisible()
    expect(
      screen.getAllByText(
        copy[
          'Only the first eligible credit across all three sources earns rewards.'
        ]
      )
    ).toHaveLength(2)
    const timeKey =
      hours === 1
        ? 'Released after {{hours}} hours_one'
        : 'Released after {{hours}} hours'
    if (hours === 0) {
      expect(screen.getAllByText(copy['Available immediately'])).toHaveLength(3)
    } else {
      expect(
        screen.getByText(copy[timeKey].replace('{{hours}}', String(hours)))
      ).toBeVisible()
    }
    expect(document.body.textContent).not.toContain('{{')
  }
)
