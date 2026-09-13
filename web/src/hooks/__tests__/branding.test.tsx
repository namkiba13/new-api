import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { ThemeProvider, useTheme } from '@/context/theme-provider'
import { useSystemConfig } from '@/hooks/use-system-config'
import { applyFaviconToDom } from '@/lib/dom-utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

const initial = useSystemConfigStore.getState()

beforeEach(() => {
  document.cookie = 'vite-ui-theme=; Max-Age=0; path=/'
  document.head
    .querySelectorAll('link[rel~="icon"]')
    .forEach((node) => node.remove())
})
afterEach(() => {
  useSystemConfigStore.setState(initial)
  document.cookie = 'vite-ui-theme=; Max-Age=0; path=/'
  document.head
    .querySelectorAll('link[rel~="icon"]')
    .forEach((node) => node.remove())
})

it('uses a readable icon and a theme-aware wordmark for the configured horizontal 94API logo', () => {
  const source = 'https://94api.dev/94api-logo-transparent.png'
  useSystemConfigStore.getState().setConfig({ logo: source })
  const { result } = renderHook(
    () => ({ config: useSystemConfig(), theme: useTheme() }),
    {
      wrapper: ({ children }) => (
        <ThemeProvider defaultTheme='light'>{children}</ThemeProvider>
      ),
    }
  )
  expect(result.current.config.logo).toBe('/94api-logo-mark-v1.png')
  expect(result.current.config.logoWordmark).toBe(
    '/94api-logo-wordmark-light-v1.png'
  )
  act(() => result.current.theme.setTheme('dark'))
  expect(result.current.config.logoWordmark).toBe(
    '/94api-logo-wordmark-dark-v1.png'
  )
  expect(useSystemConfigStore.getState().config.logo).toBe(source)
  applyFaviconToDom(source)
  expect(document.querySelector('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/94api-logo-mark-v1.png'
  )
})

it('keeps other configured logos and the default square logo intact', () => {
  const { result, rerender } = renderHook(() => useSystemConfig())
  for (const source of [
    '/logo.png',
    'https://example.com/94api-logo-transparent.png',
  ]) {
    act(() => useSystemConfigStore.getState().setConfig({ logo: source }))
    rerender()
    expect(result.current.logo).toBe(source)
    expect(result.current.logoWordmark).toBeUndefined()
  }
})
