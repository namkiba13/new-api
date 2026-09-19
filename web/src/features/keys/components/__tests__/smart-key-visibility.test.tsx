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
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { api } from '@/lib/api'

import { ApiKeysDialogs } from '../api-keys-dialogs'
import { ApiKeysPrimaryButtons } from '../api-keys-primary-buttons'
import { ApiKeysProvider } from '../api-keys-provider'

const i18n = createInstance()
await i18n
  .use(initReactI18next)
  .init({ lng: 'en', resources: { en: { translation: {} } } })
type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
const clientApi = api as unknown as { get: ApiMethod; post: ApiMethod }
const originalGet = clientApi.get
const originalPost = clientApi.post
let client: QueryClient
let posted: unknown[]

beforeEach(() => {
  localStorage.clear()
  posted = []
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clientApi.get = async (url) => {
    if (url === '/api/user/models') {
      return { data: { success: true, data: ['gpt-test'] } }
    }
    if (url === '/api/user/self/groups') {
      return {
        data: {
          success: true,
          data: {
            auto: { desc: 'Auto', ratio: 'auto' },
            'openai-stable': { desc: 'Stable', ratio: 1 },
          },
        },
      }
    }
    if (url === '/api/token/auto-groups') {
      return {
        data: {
          success: true,
          data: { groups: ['openai-stable'], max_count: 5 },
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  }
  clientApi.post = async (url, data) => {
    expect(url).toBe('/api/token/')
    posted.push(data)
    return { data: { success: true, message: '' } }
  }
})

afterEach(() => {
  cleanup()
  client.clear()
  clientApi.get = originalGet
  clientApi.post = originalPost
  localStorage.clear()
})

function show(enabled?: boolean) {
  client.setQueryData(['status'], { smart_key_wizard_enabled: enabled })
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ApiKeysProvider>
          <ApiKeysPrimaryButtons />
          <ApiKeysDialogs />
        </ApiKeysProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('Smart API Key creator visibility', () => {
  test.each([false, undefined])(
    'keeps the standard creator usable when the flag is %s',
    async (enabled) => {
      show(enabled)
      expect(
        screen.queryByRole('button', { name: 'Create Smart API Key' })
      ).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Create API Key' }))
      expect(
        await screen.findByRole('dialog', { name: 'Create API Key' })
      ).toBeInTheDocument()
      expect(posted).toEqual([])
    }
  )

  test('creates through the existing Auto token API when enabled', async () => {
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    fireEvent.change(within(dialog).getByPlaceholderText('API Key Name'), {
      target: { value: 'Smart test' },
    })
    const create = within(dialog).getByRole('button', {
      name: 'Create Smart API Key',
    })
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      name: 'Smart test',
      group: 'auto',
      auto_groups: ['openai-stable'],
      cross_group_retry: true,
    })
  })

  test('closes an open Smart dialog when disabled and does not reopen it when re-enabled', async () => {
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    expect(
      await screen.findByRole('dialog', { name: 'Create Smart API Key' })
    ).toBeInTheDocument()
    await act(async () => {
      client.setQueryData(['status'], { smart_key_wizard_enabled: false })
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create Smart API Key' })
      ).not.toBeInTheDocument()
    )
    expect(
      screen.queryByRole('button', { name: 'Create Smart API Key' })
    ).not.toBeInTheDocument()
    await act(async () => {
      client.setQueryData(['status'], { smart_key_wizard_enabled: true })
    })
    expect(
      await screen.findByRole('button', { name: 'Create Smart API Key' })
    ).toBeEnabled()
    expect(
      screen.queryByRole('dialog', { name: 'Create Smart API Key' })
    ).not.toBeInTheDocument()
    expect(posted).toEqual([])
  })
})
