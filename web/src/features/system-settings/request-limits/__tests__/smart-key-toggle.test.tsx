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
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { ApiKeysPrimaryButtons } from '@/features/keys/components/api-keys-primary-buttons'
import { ApiKeysProvider } from '@/features/keys/components/api-keys-provider'
import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { TokenLimitSection } from '../token-limit-section'

const i18n = createInstance()
await i18n
  .use(initReactI18next)
  .init({ lng: 'en', resources: { en: { translation: {} } } })
type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
const clientApi = api as unknown as { get: ApiMethod; put: ApiMethod }
const originalGet = clientApi.get
const originalPut = clientApi.put
let client: QueryClient
let actions: HTMLDivElement
let enabled: boolean
let rejectSave: boolean
let updates: unknown[]

beforeEach(() => {
  localStorage.clear()
  enabled = false
  rejectSave = false
  updates = []
  actions = document.createElement('div')
  document.body.append(actions)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(['status'], { smart_key_wizard_enabled: false })
  clientApi.get = async (url) => {
    expect(url).toBe('/api/status')
    return {
      data: { success: true, data: { smart_key_wizard_enabled: enabled } },
    }
  }
  clientApi.put = async (url, data) => {
    expect(url).toBe('/api/option/')
    const update = data as { key: string; value: boolean }
    expect(update.key).toBe('token_setting.smart_key_wizard_enabled')
    updates.push(update)
    if (rejectSave) return { data: { success: false, message: 'Rejected' } }
    enabled = update.value
    return { data: { success: true } }
  }
})

afterEach(() => {
  cleanup()
  actions.remove()
  client.clear()
  clientApi.get = originalGet
  clientApi.put = originalPut
  localStorage.clear()
})

function content(saved: boolean) {
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <SettingsPageProvider actionsContainer={actions}>
          <TokenLimitSection
            defaultValues={{
              'token_setting.max_user_tokens': 1000,
              'token_setting.smart_key_wizard_enabled': saved,
            }}
          />
        </SettingsPageProvider>
        <ApiKeysProvider>
          <ApiKeysPrimaryButtons />
        </ApiKeysProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

test('saving on/off refreshes creator visibility and keeps the token count unchanged', async () => {
  const view = render(content(false))
  const toggle = screen.getByRole('switch', {
    name: 'Show Smart API Key creator',
  })
  expect(toggle).not.toBeChecked()
  expect(
    screen.queryByRole('button', { name: 'Create Smart API Key' })
  ).not.toBeInTheDocument()
  fireEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Save token limits' }))
  expect(
    await screen.findByRole('button', { name: 'Create Smart API Key' })
  ).toBeEnabled()
  expect(
    screen.getByRole('spinbutton', { name: 'Maximum tokens per user' })
  ).toHaveValue(1000)
  view.rerender(content(true))
  await waitFor(() =>
    expect(
      screen.getByRole('switch', { name: 'Show Smart API Key creator' })
    ).toBeChecked()
  )
  fireEvent.click(
    screen.getByRole('switch', { name: 'Show Smart API Key creator' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save token limits' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Create Smart API Key' })
    ).not.toBeInTheDocument()
  )
  expect(updates).toEqual([
    { key: 'token_setting.smart_key_wizard_enabled', value: true },
    { key: 'token_setting.smart_key_wizard_enabled', value: false },
  ])
  expect(screen.getByRole('button', { name: 'Create API Key' })).toBeEnabled()
})

test('a rejected save does not advertise the creator as enabled', async () => {
  rejectSave = true
  render(content(false))
  fireEvent.click(
    screen.getByRole('switch', { name: 'Show Smart API Key creator' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save token limits' }))
  await waitFor(() => expect(updates).toHaveLength(1))
  expect(client.getQueryData(['status'])).toEqual({
    smart_key_wizard_enabled: false,
  })
  expect(
    screen.queryByRole('button', { name: 'Create Smart API Key' })
  ).not.toBeInTheDocument()
})
