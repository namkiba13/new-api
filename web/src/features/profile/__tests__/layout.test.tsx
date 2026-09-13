import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { convertDetectedLanguage } from '@/i18n/languages'
import viLocale from '@/i18n/locales/vi.json'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { Profile } from '..'
import type { UserProfile } from '../types'

const originalAdapter = api.defaults.adapter
it('keeps every saved interface language, including Traditional Chinese, when detecting language on reload', () => {
  for (const language of ['en', 'vi', 'fr', 'ru', 'ja', 'zhCN', 'zhTW']) {
    expect(convertDetectedLanguage(language)).toBe(language)
  }
  expect(convertDetectedLanguage('zh-TW')).toBe('zhTW')
  expect(convertDetectedLanguage('zh-Hant')).toBe('zhTW')
})
let client: QueryClient
let profile: UserProfile
let failProfile: boolean
let writes: { url?: string; data: Record<string, unknown> }[]

beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }))
  localStorage.clear()
  await i18next.changeLanguage('en')
  i18next.addResourceBundle('vi', 'translation', viLocale.translation)
  profile = {
    id: 2,
    username: 'profile-test',
    display_name: 'Profile Test',
    email: 'profile@example.invalid',
    role: 1,
    status: 1,
    group: 'default',
    quota: 5000000,
    used_quota: 1000000,
    request_count: 42,
    aff_count: 0,
    aff_quota: 0,
    aff_history_quota: 0,
    created_time: 0,
    setting: JSON.stringify({
      language: 'en',
      notify_type: 'email',
      quota_warning_threshold: 10,
    }),
  }
  useAuthStore
    .getState()
    .auth.setUser({ ...profile, permissions: { sidebar_settings: false } })
  failProfile = false
  writes = []
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(['status'], {
    checkin_enabled: false,
    passkey_login: false,
    custom_oauth_providers: [],
  })
  api.defaults.adapter = async (config) => {
    if (config.method === 'put') {
      const data = JSON.parse(config.data as string) as Record<string, unknown>
      writes.push({ url: config.url, data })
      profile.setting = JSON.stringify({
        ...JSON.parse(profile.setting || '{}'),
        ...data,
      })
    }
    let data: unknown = {
      enabled: false,
      locked: false,
      backup_codes_remaining: 0,
    }
    if (config.url === '/api/user/self') data = profile
    if (
      config.url === '/api/user/sessions' ||
      config.url === '/api/user/oauth/bindings'
    ) {
      data = []
    }
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        success: !(failProfile && config.url === '/api/user/self'),
        data,
      },
    }
  }
})

afterEach(async () => {
  cleanup()
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  await i18next.changeLanguage('en')
  vi.restoreAllMocks()
})

function renderProfile() {
  const route = createRootRoute({ component: Profile })
  const router = createRouter({
    routeTree: route,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

it('exposes bindings, language, notifications and security in document order without hidden settings tabs', async () => {
  renderProfile()
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Profile Test' })).toBeVisible()
  )
  expect(
    screen.getByRole('heading', { level: 1, name: 'Profile' })
  ).toBeVisible()
  const sections = [
    'Account Bindings',
    'Language Preferences',
    'Notifications',
    'Security',
    'Login sessions',
  ]
  const nodes = []
  for (const title of sections) {
    nodes.push(await screen.findByText(title, { exact: true }))
  }
  for (let i = 1; i < nodes.length; i++) {
    expect(
      nodes[i - 1].compareDocumentPosition(nodes[i]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  }
  expect(
    screen.queryByRole('tab', { name: /Settings/ })
  ).not.toBeInTheDocument()
  expect(screen.getByLabelText('Quota Warning Threshold')).toBeVisible()
  expect(screen.getByText('42', { exact: true })).toBeVisible()
  expect(screen.getByRole('button', { name: /Change Password/ })).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /Delete Account/ })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText('Sidebar Personal Settings', { exact: true })
  ).not.toBeInTheDocument()
})

it('keeps sidebar configuration available when the server grants that permission', async () => {
  profile.role = 10
  useAuthStore
    .getState()
    .auth.setUser({ ...profile, permissions: { sidebar_settings: true } })
  renderProfile()
  await waitFor(() =>
    expect(
      screen.getByText('Sidebar Personal Settings', { exact: true })
    ).toBeVisible()
  )
})

it('saves the visible notification controls through the existing settings API', async () => {
  const user = renderProfile()
  const threshold = await screen.findByLabelText('Quota Warning Threshold')
  await user.clear(threshold)
  await user.type(threshold, '20')
  await user.click(screen.getByRole('button', { name: /Save/ }))
  await waitFor(() =>
    expect(writes).toEqual([
      expect.objectContaining({
        url: '/api/user/setting',
        data: expect.objectContaining({ quota_warning_threshold: 20 }),
      }),
    ])
  )
})

it('offers seven languages and persists the selected language through the existing profile API', async () => {
  const user = renderProfile()
  await screen.findByRole('heading', { name: 'Profile Test' })
  await user.click(screen.getByRole('combobox'))
  const list = screen.getByRole('listbox')
  expect(within(list).getAllByRole('option')).toHaveLength(7)
  await user.click(within(list).getByRole('option', { name: 'Tiếng Việt' }))
  await waitFor(() =>
    expect(writes).toContainEqual({
      url: '/api/user/self',
      data: { language: 'vi' },
    })
  )
  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: viLocale.translation.Profile,
    })
  ).toBeVisible()
})

it('shows a retry action when profile loading fails and recovers on retry', async () => {
  failProfile = true
  const user = renderProfile()
  expect(
    await screen.findByText('Failed to load profile', { exact: true })
  ).toBeVisible()
  expect(
    screen.queryByLabelText('Quota Warning Threshold')
  ).not.toBeInTheDocument()
  failProfile = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(
    await screen.findByRole('heading', { name: 'Profile Test' })
  ).toBeVisible()
})

it('hides sidebar settings when the account response does not grant permission', async () => {
  useAuthStore.getState().auth.setUser({ ...profile })
  renderProfile()
  await screen.findByRole('heading', { name: 'Profile Test' })
  expect(
    screen.queryByText('Sidebar Personal Settings', { exact: true })
  ).not.toBeInTheDocument()
})

it('groups two-step verification inside Security without passkey or access-token controls', async () => {
  renderProfile()
  const security = await screen.findByRole('region', { name: 'Security' })
  expect(
    await within(security).findByText('Two-Step Verification')
  ).toBeVisible()
  expect(within(security).getByText('Disabled', { exact: true })).toBeVisible()
  expect(within(security).getByRole('button', { name: 'Enable' })).toBeVisible()
  expect(
    screen.queryByText('Passkey Login', { exact: true })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /Access Token/ })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText('Two-Factor Authentication', { exact: true })
  ).not.toBeInTheDocument()
})
