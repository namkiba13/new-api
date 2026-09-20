/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { SystemStatus } from '@/features/auth/types'
import i18n from '@/i18n/config'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SignUp } from '..'

const originalAdapter = api.defaults.adapter
const initialSystemConfig = useSystemConfigStore.getInitialState()
let client: QueryClient
let verify: (token: string) => void
let requests: { url: string | undefined; data: unknown; params: unknown }[]

beforeEach(async () => {
  await i18n.changeLanguage('en')
  localStorage.clear()
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.getState().setConfig({ systemName: '94API' })
  useSystemConfigStore.getState().setLoading(false)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 336, 44)
  )
  verify = () => {
    throw new Error('CAPTCHA was not rendered')
  }
  vi.stubGlobal('turnstile', {
    render: (element: HTMLElement, options: Record<string, unknown>) => {
      verify = options.callback as typeof verify
      const frame = document.createElement('iframe')
      frame.title = 'Cloudflare CAPTCHA'
      element.append(frame)
      return 'signup-widget'
    },
    remove: vi.fn(),
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  requests = []
  api.defaults.adapter = async (config) => {
    requests.push({
      url: config.url,
      data: config.data && JSON.parse(config.data),
      params: config.params,
    })
    const success =
      config.url === '/api/oauth/state' ||
      config.url === '/api/user/auth/logout'
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        success,
        data: 'signup-state',
        message: success ? '' : 'Please retry',
      },
    }
  }
})

afterEach(() => {
  cleanup()
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(initialSystemConfig, true)
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function renderSignUp(status: Partial<SystemStatus> = {}) {
  client.setQueryData(['status'], {
    user_agreement_enabled: true,
    privacy_policy_enabled: true,
    system_name: '94API',
    custom_oauth_providers: [
      {
        id: 1,
        name: 'Google',
        slug: 'google',
        icon: '',
        client_id: 'test-client',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: 'openid email profile',
      },
    ],
    ...status,
  })
  const router = createRouter({
    routeTree: createRootRoute({ component: SignUp }),
    history: createMemoryHistory({ initialEntries: ['/sign-up'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('heading', { name: 'Create an account' })
  return userEvent.setup()
}

it('puts the OAuth block before inputs in document and keyboard order, with one legal notice and no checkbox', async () => {
  const user = await renderSignUp({
    turnstile_check: true,
    turnstile_site_key: 'test-key',
  })
  const google = screen.getByRole('button', { name: 'Sign up with Google' })
  const controls = [
    screen.getByRole('heading', { name: 'Create an account' }),
    screen.getByText('Or continue with'),
    google,
    screen.getByLabelText('Username'),
    screen.getByTitle('Cloudflare CAPTCHA'),
    screen.getByRole('button', { name: 'Create account' }),
    screen.getByText(/By creating an account/),
  ]
  for (let i = 1; i < controls.length; i++) {
    expect(
      controls[i - 1].compareDocumentPosition(controls[i]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  }
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getAllByText(/By creating an account/)).toHaveLength(1)
  expect(google).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  google.focus()
  await user.tab()
  expect(screen.getByLabelText('Username')).toHaveFocus()
})

it('starts Google signup with the existing OAuth state flow without consent', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const user = await renderSignUp()
  await user.click(screen.getByRole('button', { name: 'Sign up with Google' }))
  await waitFor(() => expect(open).toHaveBeenCalled())
  expect(requests.map((request) => request.url)).toEqual([
    '/api/user/auth/logout',
    '/api/oauth/state',
  ])
  expect(requests[1].data).toEqual({ provider: 'google', intent: 'login' })
  const url = new URL(String(open.mock.calls[0][0]))
  expect(url.origin).toBe('https://accounts.google.com')
  expect(url.searchParams.get('state')).toBe('signup-state')
  expect(url.searchParams.get('scope')).toBe('openid email profile')
  expect(url.searchParams.get('redirect_uri')).toBe(
    `${window.location.origin}/oauth/google`
  )
})

it('disables Google while authentication starts and restores the button after failure', async () => {
  let finishRequest = () => {}
  const pending = new Promise<void>((resolve) => {
    finishRequest = resolve
  })
  api.defaults.adapter = async (config) => {
    await pending
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: false, message: 'Please retry' },
    }
  }
  const user = await renderSignUp()
  const google = screen.getByRole('button', { name: 'Sign up with Google' })
  await user.click(google)
  expect(google).toBeDisabled()
  expect(google).toHaveAccessibleName('Sign up with Google')
  act(() => finishRequest())
  await waitFor(() => expect(google).toBeEnabled())
})

it('allows WeChat signup without consent while still requiring a verification code', async () => {
  const user = await renderSignUp({ wechat_login: true })
  await user.click(screen.getByRole('button', { name: /Continue with WeChat/ }))
  const dialog = await screen.findByRole('dialog', { name: 'WeChat sign in' })
  const confirm = within(dialog).getByRole('button', { name: 'Confirm' })
  expect(confirm).toBeDisabled()
  await user.type(within(dialog).getByLabelText('Verification code'), '123456')
  await user.click(confirm)
  await waitFor(() =>
    expect(requests).toContainEqual({
      url: '/api/oauth/wechat',
      data: undefined,
      params: { code: '123456' },
    })
  )
})

it('keeps CAPTCHA and email verification required and resets CAPTCHA after a failed registration', async () => {
  const error = vi.spyOn(toast, 'error')
  const user = await renderSignUp({
    email_verification: true,
    turnstile_check: true,
    turnstile_site_key: 'test-key',
  })
  await user.type(screen.getByLabelText('Username'), 'signup-test')
  await user.type(
    screen.getByLabelText('Password', { exact: true }),
    'test-password'
  )
  await user.type(
    screen.getByLabelText('Confirm password', { exact: true }),
    'test-password'
  )
  await user.type(
    screen.getByLabelText('Email (required for verification)'),
    'signup@example.test'
  )
  const submit = screen.getByRole('button', { name: 'Create account' })
  expect(submit).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled()
  act(() => verify('first-token'))
  await user.click(submit)
  await waitFor(() =>
    expect(error).toHaveBeenCalledWith('Please enter the verification code')
  )
  expect(requests).toHaveLength(0)
  await user.type(screen.getByPlaceholderText('Verification code'), '123456')
  await user.click(submit)
  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0]).toMatchObject({
    url: '/api/user/register',
    data: {
      username: 'signup-test',
      email: 'signup@example.test',
      verification_code: '123456',
      turnstile: 'first-token',
    },
    params: { turnstile: 'first-token' },
  })
  await waitFor(() => expect(submit).toBeDisabled())
  act(() => verify('second-token'))
  await user.click(submit)
  await waitFor(() => expect(requests).toHaveLength(2))
  expect(requests[1].params).toEqual({ turnstile: 'second-token' })
})

it.each([{ oauth_register_enabled: false }, { custom_oauth_providers: [] }])(
  'hides the OAuth block when unavailable: %j',
  async (status) => {
    await renderSignUp(status)
    expect(
      screen.queryByRole('button', { name: 'Sign up with Google' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Or continue with')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  }
)
