import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'
import vi from '@/i18n/locales/vi.json'
import { api } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { Home } from '..'

const originalAdapter = api.defaults.adapter
beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
  localStorage.clear()
  document.cookie = 'vite-ui-theme=; Max-Age=0; path=/'
  await i18next.changeLanguage('en')
  i18next.addResourceBundle('vi', 'translation', vi.translation)
  useSystemConfigStore.getState().setConfig({ systemName: '94API' })
  useSystemConfigStore.getState().setLoading(false)
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data:
        // eslint-disable-next-line no-nested-ternary -- API boundary fixture by endpoint.
        config.url === '/api/status'
          ? {
              system_name: '94API',
              announcements_enabled: true,
              announcements: [
                {
                  id: 'release',
                  content: 'Fixture platform release',
                  publishDate: '2026-09-13',
                },
              ],
            }
          : config.url === '/api/notice'
            ? 'Fixture maintenance notice'
            : '',
    },
  })
})
afterEach(() => {
  api.defaults.adapter = originalAdapter
})

async function renderHome() {
  const root = createRootRoute({ component: Home })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  )
  await screen.findByTitle('Home')
  return { user: userEvent.setup(), client }
}

describe('real homepage topbar', () => {
  it('shows the API empty states without an unread badge when there are no notices', async () => {
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        success: true,
        data:
          config.url === '/api/status'
            ? {
                system_name: '94API',
                announcements_enabled: true,
                announcements: [],
              }
            : '',
      },
    })
    const { user, client } = await renderHome()
    try {
      const bell = screen.getAllByRole('button', { name: 'Notifications' })[0]
      await user.click(bell)
      expect(
        await screen.findByText('No announcements at this time')
      ).toBeVisible()
      expect(bell).not.toHaveTextContent(/[0-9]/)
      await user.click(screen.getByRole('tab', { name: 'Timeline' }))
      expect(await screen.findByText('No system announcements')).toBeVisible()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    } finally {
      client.clear()
    }
  })

  it('opens seven language choices and updates the application language', async () => {
    const { user, client } = await renderHome()
    try {
      await user.click(
        screen.getAllByRole('button', { name: 'Change language' })[0]
      )
      const menu = screen.getByRole('menu')
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(7)
      await user.click(within(menu).getByText('Tiếng Việt'))
      await waitFor(() => expect(i18next.language).toBe('vi'))
      expect(await screen.findByTitle(vi.translation.Home)).toBeInTheDocument()
    } finally {
      client.clear()
    }
  })

  it('changes Light/Dark/System using the shared persisted preference', async () => {
    const { user, client } = await renderHome()
    try {
      for (const [label, value] of [
        ['Dark', 'dark'],
        ['Light', 'light'],
        ['System', 'system'],
      ]) {
        await user.click(
          screen.getAllByRole('button', { name: 'Toggle theme' })[0]
        )
        await user.click(screen.getByRole('menuitem', { name: label }))
        await waitFor(() =>
          expect(document.cookie).toContain(`vite-ui-theme=${value}`)
        )
        expect(document.documentElement).toHaveClass(
          value === 'system' ? 'light' : value
        )
      }
    } finally {
      client.clear()
    }
  })

  it('opens real server notice and timeline content from the bell', async () => {
    const { user, client } = await renderHome()
    try {
      await user.click(
        screen.getAllByRole('button', { name: /Notifications/ })[0]
      )
      expect(
        await screen.findByText('Fixture maintenance notice')
      ).toBeInTheDocument()
      await user.click(screen.getByRole('tab', { name: /Timeline/ }))
      expect(
        await screen.findByText('Fixture platform release')
      ).toBeInTheDocument()
    } finally {
      client.clear()
    }
  })
})
