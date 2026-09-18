/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import i18n from '@/i18n/config'
import { api } from '@/lib/api'

import { ForgotPasswordForm } from '../forgot-password/components/forgot-password-form'
import { ResetPasswordConfirm } from '../reset-password-confirm'

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({
    status: { turnstile_check: true, turnstile_site_key: 'lab-site-key' },
  }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../auth-layout', () => ({
  AuthLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const originalAdapter = api.defaults.adapter
let verify: (token: string) => void

beforeEach(async () => {
  await i18n.changeLanguage('en')
  verify = () => {
    throw new Error('CAPTCHA widget was not rendered')
  }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 336, 44)
  )
  vi.stubGlobal('turnstile', {
    render: (_element: HTMLElement, options: Record<string, unknown>) => {
      verify = options.callback as typeof verify
      return 'lab-widget'
    },
    remove: vi.fn(),
  })
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.unstubAllGlobals()
})

it('shows the server error when a reset token is invalid, expired or already used', async () => {
  const error = vi.spyOn(toast, 'error')
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { success: false, message: 'This reset link has expired' },
  })
  const user = userEvent.setup()
  render(
    <ResetPasswordConfirm email='customer@example.test' token='expired-token' />
  )
  await user.click(
    screen.getByRole('button', {
      name: i18n.t('auth.resetPasswordConfirm.confirm'),
    })
  )
  await waitFor(() =>
    expect(error).toHaveBeenCalledWith('This reset link has expired')
  )
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
})

it('requires a new CAPTCHA when retrying a failed forgot-password request', async () => {
  const tokens: string[] = []
  api.defaults.adapter = async (config) => {
    tokens.push(config.params.turnstile)
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: false, message: 'Please retry' },
    }
  }
  const user = userEvent.setup()
  render(<ForgotPasswordForm />)
  await user.type(screen.getByLabelText('Email'), 'customer@example.test')
  const send = screen.getByRole('button', { name: 'Send reset email' })
  expect(send).toBeDisabled()
  act(() => verify('first-token'))
  await user.click(send)
  await waitFor(() => expect(tokens).toEqual(['first-token']))
  await waitFor(() => expect(send).toBeDisabled())
  act(() => verify('second-token'))
  await user.click(send)
  await waitFor(() => expect(tokens).toEqual(['first-token', 'second-token']))
})
