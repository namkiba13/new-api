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
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { Turnstile } from '@/components/turnstile'

let width = 336
let resize: () => void
const renderWidget = vi.fn<
  (element: HTMLElement, options: Record<string, unknown>) => string
>(() => 'widget-id')
const removeWidget = vi.fn()

beforeEach(() => {
  width = 336
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width }) as DOMRect
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('turnstile', { render: renderWidget, remove: removeWidget })
})

afterEach(() => {
  cleanup()
  document.querySelector('#cf-turnstile')?.remove()
  vi.unstubAllGlobals()
})

it.each([
  [240, 'compact'],
  [300, 'flexible'],
  [336, 'flexible'],
] as const)(
  'uses the fitting widget size for a %ipx container',
  (containerWidth, size) => {
    width = containerWidth
    render(<Turnstile siteKey='test-site-key' onVerify={vi.fn()} />)
    expect(renderWidget).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: 'test-site-key', size })
    )
  }
)

it('preserves verification while typing or resizing within the same size, but clears it when switching size', () => {
  const verify = vi.fn()
  const expire = vi.fn()
  const { rerender, unmount } = render(
    <Turnstile siteKey='key' onVerify={vi.fn()} onExpire={vi.fn()} />
  )
  rerender(<Turnstile siteKey='key' onVerify={verify} onExpire={expire} />)
  width = 310
  act(() => resize())
  expect(renderWidget).toHaveBeenCalledTimes(1)
  expect(expire).not.toHaveBeenCalled()
  const options = renderWidget.mock.calls[0][1] as Record<
    string,
    (token?: string) => void
  >
  act(() => options.callback('verified-token'))
  expect(verify).toHaveBeenCalledWith('verified-token')
  width = 240
  act(() => resize())
  expect(expire).toHaveBeenCalledTimes(1)
  expect(removeWidget).toHaveBeenCalledWith('widget-id')
  expect(renderWidget).toHaveBeenLastCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ size: 'compact' })
  )
  unmount()
  expect(removeWidget).toHaveBeenCalledTimes(2)
})

it('renders a newly mounted form when the shared script finishes loading and ignores the unmounted form', () => {
  vi.stubGlobal('turnstile', undefined)
  const old = render(<Turnstile siteKey='old-key' onVerify={vi.fn()} />)
  const script = document.querySelector('#cf-turnstile')
  old.unmount()
  render(<Turnstile siteKey='new-key' onVerify={vi.fn()} />)
  vi.stubGlobal('turnstile', { render: renderWidget, remove: removeWidget })
  act(() => {
    script?.dispatchEvent(new Event('load'))
  })
  expect(renderWidget).toHaveBeenCalledTimes(1)
  expect(renderWidget).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ sitekey: 'new-key' })
  )
})
