/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import assert from 'node:assert/strict'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { afterEach, expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vietnamese from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zhCN from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DOCS_GUIDES } from '../data'
import { DocsGuidePage } from '../guide'
import { GUIDE_CONTENT, GUIDE_TROUBLESHOOTING } from '../guide-content'
import { docsUi } from '../translations'

const locales = { en, vi: vietnamese, fr, ru, ja, zhCN, zhTW }
const adapter = api.defaults.adapter
const initialConfig = useSystemConfigStore.getInitialState()
let client: QueryClient | undefined

afterEach(async () => {
  cleanup()
  client?.clear()
  api.defaults.adapter = adapter
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(initialConfig, true)
  await i18n.changeLanguage('en')
  vi.restoreAllMocks()
})

it.each(Object.entries(locales))(
  'provides complete guide prose, requirements and notes in %s',
  (language, locale) => {
    const keys = new Set([
      'Official references',
      'Sources reviewed',
      'These are source-checked configuration examples, not a claim that every client feature has been tested end to end on 94API.',
    ])
    for (const guide of DOCS_GUIDES) {
      keys.add(guide.title)
      keys.add(guide.description)
      for (const section of GUIDE_CONTENT[guide.slug]) {
        keys.add(section.title)
        section.paragraphs.forEach((text) => keys.add(text))
        if (section.note) keys.add(section.note)
      }
    }
    GUIDE_TROUBLESHOOTING.flat().forEach((text) => keys.add(text))
    for (const key of keys) {
      const translated = (locale.translation as Record<string, string>)[key]
      expect(translated, `${language}: ${key}`).toBeTruthy()
      if (language !== 'en' && key.length > 50) expect(translated).not.toBe(key)
      expect(translated).not.toContain('\uFFFD')
    }
  }
)

it('keeps the custom provider config parseable and uses explicit key and model placeholders', () => {
  const configured = GUIDE_CONTENT.opencode.find(
    (section) => section.id === 'configure'
  )
  assert(configured?.code?.[0])
  const config = JSON.parse(configured.code[0].value)
  expect(config.provider.api94.options).toEqual({
    baseURL: 'https://94api.dev/v1',
    apiKey: '{env:API94_KEY}',
  })
  expect(Object.keys(config.provider.api94.models)).toEqual(['YOUR_MODEL_ID'])
  const allCode = Object.values(GUIDE_CONTENT)
    .flat()
    .flatMap((section) => section.code ?? [])
    .map((code) => code.value)
    .join('\n')
  expect(allCode).not.toMatch(
    /gpt-5-mini|claude-opus-4-7|gemini-3\.5-flash|disable_response_storage|model_providers\.apimore|env:94api_key/
  )
  expect(allCode).not.toContain('\u0000')
})

it.each(['vi', 'fr'])(
  'renders the actual Codex instructions and security notes, and copies exact TOML in %s',
  async (language) => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    for (const [lng, locale] of Object.entries(locales)) {
      i18n.addResourceBundle(lng, 'translation', locale.translation, true, true)
    }
    await i18n.changeLanguage(language)
    useAuthStore.getState().auth.reset()
    useSystemConfigStore.getState().setConfig({ systemName: '94API' })
    useSystemConfigStore.getState().setLoading(false)
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(['status'], {
      system_name: '94API',
      setup: true,
      custom_oauth_providers: [],
    })
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: true, data: config.url === '/api/notice' ? '' : [] },
    })
    const guide = DOCS_GUIDES.find((guide) => guide.slug === 'codex')
    assert(guide)
    const router = createRouter({
      routeTree: createRootRoute({
        component: () => <DocsGuidePage guide={guide} />,
      }),
      history: createMemoryHistory({ initialEntries: ['/docs/codex'] }),
    })
    const user = userEvent.setup()
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    await screen.findByRole('heading', { level: 1, name: i18n.t(guide.title) })
    const instructions = GUIDE_CONTENT.codex.find(
      (section) => section.id === 'configure'
    )
    assert(instructions?.note && instructions.code?.[0])
    const accountNote = GUIDE_CONTENT.codex[0].note
    assert(accountNote)
    expect(
      await screen.findByText(i18n.t(instructions.paragraphs[0]))
    ).toBeVisible()
    expect(screen.getByText(i18n.t(instructions.note))).toBeVisible()
    expect(screen.getByText(i18n.t(accountNote))).toBeVisible()
    const section = screen
      .getByRole('heading', { name: i18n.t(instructions.title), level: 2 })
      .closest('section')
    assert(section)
    await user.click(
      within(section).getByRole('button', {
        name: docsUi(language, 'copyCode'),
      })
    )
    expect(copy).toHaveBeenCalledWith(instructions.code[0].value)
    const references = screen.getByRole('region', {
      name: i18n.t('Official references'),
    })
    expect(within(references).getAllByRole('link')).toHaveLength(
      guide.references.length + 1
    )
  }
)
