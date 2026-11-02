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
let groups: Record<string, { desc: string; ratio: number | string }>
let maxGroups: number

beforeEach(() => {
  localStorage.clear()
  posted = []
  groups = {
    auto: { desc: 'Auto', ratio: 'auto' },
    low: { desc: 'Low', ratio: 0.2 },
    stable: { desc: 'Stable', ratio: 1 },
    FREETIER: { desc: 'Free tier', ratio: 0.2 },
  }
  maxGroups = 5
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
          data: { ...groups },
        },
      }
    }
    if (url === '/api/token/auto-groups') {
      return {
        data: {
          success: true,
          data: { groups: ['low', 'stable'], max_count: maxGroups },
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
    const add = await within(dialog).findByRole('combobox', {
      name: 'Add Auto group',
    })
    await waitFor(() => expect(add).toBeEnabled())
    fireEvent.click(add)
    fireEvent.click(await screen.findByRole('option', { name: /^low/ }))
    fireEvent.click(add)
    fireEvent.click(await screen.findByRole('option', { name: /^stable/ }))
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Move stable up' })
    )
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      name: 'Smart test',
      group: 'auto',
      auto_groups: ['stable', 'low'],
      cross_group_retry: true,
    })
  })

  test('blocks empty routes and honors the group limit without hiding other permitted groups', async () => {
    maxGroups = 1
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    fireEvent.change(within(dialog).getByPlaceholderText('API Key Name'), {
      target: { value: 'Single group' },
    })
    const create = within(dialog).getByRole('button', {
      name: 'Create Smart API Key',
    })
    expect(create).toBeDisabled()
    const add = await within(dialog).findByRole('combobox', {
      name: 'Add Auto group',
    })
    await waitFor(() => expect(add).toBeEnabled())
    fireEvent.click(add)
    expect(
      await screen.findByRole('option', { name: /^FREETIER/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /^auto/i })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /^low/ }))
    expect(
      within(dialog).getByRole('combobox', {
        name: 'Maximum 1 groups selected',
      })
    ).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove low' }))
    expect(create).toBeDisabled()
    expect(posted).toEqual([])
  })

  test('does not bypass Auto permission even when concrete groups are available', async () => {
    delete groups.auto
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    expect(
      await within(dialog).findByText(
        'The groups are configured, but this account has not been granted access to the Auto routing group.'
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Create Smart API Key' })
    ).toBeDisabled()
    expect(posted).toEqual([])
  })

  test('restores global Auto without silently treating an empty custom selection as inheritance', async () => {
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    fireEvent.change(within(dialog).getByPlaceholderText('API Key Name'), {
      target: { value: 'Global Auto' },
    })
    const create = within(dialog).getByRole('button', {
      name: 'Create Smart API Key',
    })
    expect(create).toBeDisabled()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Restore global Auto' })
    )
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      group: 'auto',
      auto_groups: null,
      cross_group_retry: true,
    })
  })

  test('blocks a selected group after permissions refresh instead of routing through another group', async () => {
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    const add = await within(dialog).findByRole('combobox', {
      name: 'Add Auto group',
    })
    await waitFor(() => expect(add).toBeEnabled())
    fireEvent.click(add)
    fireEvent.click(await screen.findByRole('option', { name: /^low/ }))
    delete groups.low
    await act(async () => {
      client.setQueryData(['user-groups'], {
        success: true,
        data: { ...groups },
      })
    })
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Create Smart API Key' })
      ).toBeDisabled()
    )
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Some selected groups are no longer available.'
    )
    expect(posted).toEqual([])
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

  test('blocks creation when global Auto has no permitted routes', async () => {
    delete groups.low
    delete groups.stable
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    const restore = within(dialog).getByRole('button', {
      name: 'Restore global Auto',
    })
    await waitFor(() => expect(restore).toBeEnabled())
    fireEvent.click(restore)
    expect(
      within(dialog).getByRole('button', { name: 'Create Smart API Key' })
    ).toBeDisabled()
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'No available groups in the global Auto order.'
    )
    expect(posted).toEqual([])
  })

  test('blocks creation when the routing configuration request fails', async () => {
    const get = clientApi.get
    clientApi.get = async (url) => {
      if (url === '/api/token/auto-groups') throw new Error('Offline')
      return get(url)
    }
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    await waitFor(() =>
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'Unable to load Auto routing configuration.'
      )
    )
    expect(
      within(dialog).getByRole('button', { name: 'Create Smart API Key' })
    ).toBeDisabled()
    expect(posted).toEqual([])
  })

  test('keeps the selected order after server rejection and clears it on close', async () => {
    clientApi.post = async (url, data) => {
      expect(url).toBe('/api/token/')
      posted.push(data)
      return { data: { success: false, message: 'Rejected' } }
    }
    show(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    fireEvent.change(within(dialog).getByPlaceholderText('API Key Name'), {
      target: { value: 'Retry' },
    })
    const add = within(dialog).getByRole('combobox', { name: 'Add Auto group' })
    await waitFor(() => expect(add).toBeEnabled())
    fireEvent.click(add)
    fireEvent.click(await screen.findByRole('option', { name: /^low/ }))
    const create = within(dialog).getByRole('button', {
      name: 'Create Smart API Key',
    })
    fireEvent.click(create)
    await waitFor(() => expect(posted).toHaveLength(1))
    await waitFor(() => expect(create).toBeEnabled())
    expect(
      within(dialog).getByRole('button', { name: 'Remove low' })
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create Smart API Key' })
      ).not.toBeInTheDocument()
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Smart API Key' })
    )
    const reopened = await screen.findByRole('dialog', {
      name: 'Create Smart API Key',
    })
    expect(within(reopened).getByPlaceholderText('API Key Name')).toHaveValue(
      ''
    )
    expect(
      within(reopened).queryByRole('button', { name: 'Remove low' })
    ).not.toBeInTheDocument()
    expect(
      within(reopened).getByRole('button', { name: 'Create Smart API Key' })
    ).toBeDisabled()
  })
})
