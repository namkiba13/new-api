/* Copyright (C) 2023-2026 QuantumNous */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { UserOverviewDashboard } from '../user-overview-dashboard'

const clients: QueryClient[] = []

async function renderOverview() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  client.setQueryData(['status'], { api_info: [], announcements: [] })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'demo',
    role: 1,
    quota: 0,
    used_quota: 0,
    request_count: 42,
  })
  const root = createRootRoute({ component: UserOverviewDashboard })
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
  await screen.findByText('Credits and usage')
}

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
})

describe('User overview metrics', () => {
  it('labels the lifetime request count as total requests, not the last 24 hours', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: [] },
    })
    await renderOverview()
    const count = screen.getByText('Request Count').closest('dl')
    if (!count) throw new Error('Request metric must have a definition list')
    expect(within(count).getByText('42')).toBeVisible()
    expect(within(count).getByText('Total requests made')).toBeVisible()
    expect(screen.queryByText('Requests (24h)')).not.toBeInTheDocument()
  })

  it('keeps unavailable usage distinct from a successful zero-usage result', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('Unavailable'))
    await renderOverview()
    expect(await screen.findByText('Failed to load')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Create API Key' })
    ).toHaveAttribute('href', '/keys')
    expect(screen.getByRole('button', { name: 'Add credits' })).toHaveAttribute(
      'href',
      '/wallet'
    )
  })

  it('shows a loading state while the usage request is pending', async () => {
    vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
    await renderOverview()
    const metric = screen.getByText('Last 24h usage').closest('dl')
    if (!metric) throw new Error('Usage metric must have a definition list')
    expect(within(metric).getByText('Loading')).toBeVisible()
  })

  it('queries a trailing 24-hour window ending now and displays empty panels honestly', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: [] } })
    const before = Math.floor(Date.now() / 1000)
    await renderOverview()
    const call = get.mock.calls.find(([url]) => url === '/api/data/self')
    if (!call) throw new Error('Expected the user usage request')
    const params = call[1]?.params
    expect(params.end_timestamp - params.start_timestamp).toBe(86400)
    expect(params.end_timestamp).toBeGreaterThanOrEqual(before)
    expect(params.end_timestamp).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000)
    )
    expect(await screen.findByText('No API routes configured')).toBeVisible()
    expect(screen.getByText('No announcements at this time')).toBeVisible()
  })
})
