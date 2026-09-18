/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import i18n from '@/i18n/config'
import { api } from '@/lib/api'

import { EmailBindDialog } from '../components/dialogs/email-bind-dialog'

const status = vi.hoisted(() => ({
  turnstile_check: true,
  turnstile_site_key: 'lab-site-key',
}))
vi.mock('@/hooks/use-status', () => ({ useStatus: () => ({ status }) }))

const originalAdapter = api.defaults.adapter
let verify: (token: string) => void
let expire: () => void

beforeEach(async () => {
  await i18n.changeLanguage('en')
  status.turnstile_check = true
  verify = () => {
    throw new Error('CAPTCHA widget was not rendered')
  }
  expire = verify.bind(null, '')
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 336, 44)
  )
  vi.stubGlobal('turnstile', {
    render: (_element: HTMLElement, options: Record<string, unknown>) => {
      verify = options.callback as typeof verify
      expire = options['expired-callback'] as typeof expire
      return 'lab-widget'
    },
    remove: vi.fn(),
  })
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.unstubAllGlobals()
})

it('requires a fresh CAPTCHA for verification, sends its token, and binds the received code', async () => {
  const requests: { url: string; body?: string }[] = []
  api.defaults.adapter = async (config) => {
    requests.push({ url: config.url || '', body: config.data })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: true },
    }
  }
  const onSuccess = vi.fn()
  const onOpenChange = vi.fn()
  const user = userEvent.setup()
  render(
    <EmailBindDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />
  )
  await user.type(
    screen.getByLabelText('Email Address'),
    'customer+test@example.test'
  )
  const send = screen.getByRole('button', { name: 'Send' })
  expect(send).toBeDisabled()
  act(() => verify('expired-token'))
  expect(send).toBeEnabled()
  act(() => expire())
  expect(send).toBeDisabled()
  act(() => verify('fresh-token'))
  await user.click(send)
  await waitFor(() => expect(requests).toHaveLength(1))
  const url = new URL(requests[0].url, 'http://localhost')
  expect(url.searchParams.get('email')).toBe('customer+test@example.test')
  expect(url.searchParams.get('turnstile')).toBe('fresh-token')
  await user.type(screen.getByLabelText('Verification Code'), 'abc123')
  await user.click(screen.getByRole('button', { name: 'Bind Email' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  expect(JSON.parse(requests[1].body || '{}')).toEqual({
    email: 'customer+test@example.test',
    code: 'abc123',
  })
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it('discards a consumed token after SMTP failure and allows retry with a new challenge', async () => {
  const tokens: (string | null)[] = []
  api.defaults.adapter = async (config) => {
    tokens.push(
      new URL(config.url || '', 'http://localhost').searchParams.get(
        'turnstile'
      )
    )
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: false, message: 'SMTP unavailable' },
    }
  }
  const user = userEvent.setup()
  render(<EmailBindDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
  await user.type(screen.getByLabelText('Email Address'), 'retry@example.test')
  act(() => verify('first-token'))
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(tokens).toEqual(['first-token']))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  )
  act(() => verify('second-token'))
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(tokens).toEqual(['first-token', 'second-token']))
})

it('permits sending when CAPTCHA is disabled by the server', async () => {
  status.turnstile_check = false
  const user = userEvent.setup()
  render(<EmailBindDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
  await user.type(screen.getByLabelText('Email Address'), 'plain@example.test')
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
})

it('requires a new challenge after closing and reopening the email dialog', async () => {
  const user = userEvent.setup()
  const props = { onOpenChange: vi.fn(), onSuccess: vi.fn() }
  const view = render(<EmailBindDialog {...props} open />)
  await user.type(screen.getByLabelText('Email Address'), 'reopen@example.test')
  act(() => verify('old-token'))
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  view.rerender(<EmailBindDialog {...props} open={false} />)
  view.rerender(<EmailBindDialog {...props} open />)
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  act(() => verify('new-token'))
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
})
