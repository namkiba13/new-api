/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthLayout } from '@/features/auth/auth-layout'
import type { SystemStatus } from '@/features/auth/types'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SignIn } from '..'

const initialSystemConfig = useSystemConfigStore.getInitialState()
let queryClient: QueryClient

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(initialSystemConfig, true)
  useSystemConfigStore.getState().setConfig({ systemName: '94API' })
  useSystemConfigStore.getState().setLoading(false)
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(initialSystemConfig, true)
  localStorage.clear()
})

async function renderSignIn(status: Partial<SystemStatus> = {}) {
  queryClient.setQueryData(['status'], {
    password_login_enabled: true,
    register_enabled: true,
    ...status,
  })
  const rootRoute = createRootRoute()
  const authRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '(auth)',
  })
  const signInRoute = createRoute({
    getParentRoute: () => authRoute,
    path: '/sign-in',
    component: SignIn,
    validateSearch: () => ({ redirect: undefined }),
  })
  const forgotPasswordRoute = createRoute({
    getParentRoute: () => authRoute,
    path: '/forgot-password',
    component: () => (
      <AuthLayout>
        <h2>Reset password</h2>
      </AuthLayout>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      authRoute.addChildren([signInRoute, forgotPasswordRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: ['/sign-in'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return screen.findByRole('region', { name: 'Welcome back!' })
}

describe('login-03 layout', () => {
  it('keeps branding above the card and legal footer outside it when terms are enabled', async () => {
    const card = await renderSignIn({ user_agreement_enabled: true })
    const brand = screen.getByRole('link', { name: /94API/ })
    expect(brand).toHaveAttribute('href', '/')
    expect(
      brand.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(within(card).getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/sign-up'
    )
    const footer = screen.getByText(/By clicking sign in/)
    expect(card).not.toContainElement(footer)
    expect(
      card.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // Let tall forms expand instead of clipping content on short/mobile screens.
    const canvas = card.closest('.auth-login')
    expect(canvas).toHaveClass('min-h-svh')
    expect(canvas).not.toHaveClass('h-svh', 'overflow-hidden')
  })

  it.each([{ register_enabled: false }, { self_use_mode_enabled: true }])(
    'hides registration when server configuration is %j',
    async (status) => {
      await renderSignIn(status)
      expect(
        screen.queryByRole('link', { name: 'Sign up' })
      ).not.toBeInTheDocument()
    }
  )

  it('shows configured OAuth without password inputs when password login is disabled', async () => {
    await renderSignIn({ password_login_enabled: false, github_oauth: true })
    expect(
      screen.getByRole('button', { name: /Continue with GitHub/ })
    ).toBeEnabled()
    expect(screen.queryByLabelText('Username or Email')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sign in' })
    ).not.toBeInTheDocument()
  })

  it('supports keyboard entry, password visibility and required legal consent inside the card', async () => {
    const user = userEvent.setup()
    await renderSignIn({ user_agreement_enabled: true })
    const username = screen.getByLabelText('Username or Email')
    const password = screen.getByLabelText('Password')
    const submit = screen.getByRole('button', { name: 'Sign in' })
    expect(username).toHaveAttribute('autocomplete', 'username')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(submit).toBeDisabled()
    await user.click(username)
    await user.keyboard('demo')
    await user.tab()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveFocus()
    await user.tab()
    expect(password).toHaveFocus()
    await user.keyboard('example-password')
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Toggle password visibility' })
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('example-password')
    await user.click(screen.getByRole('checkbox'))
    expect(submit).toBeEnabled()
  })

  it('uses the original auth layout after following the forgot-password link', async () => {
    const user = userEvent.setup()
    await renderSignIn()
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }))
    expect(
      await screen.findByRole('heading', { name: 'Reset password' })
    ).toBeVisible()
    expect(document.querySelector('.auth-login')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /94API/ })).toBeVisible()
  })
})
