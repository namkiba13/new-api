/* Copyright (C) 2023-2026 QuantumNous */
import { expect, it } from 'vitest'

import { iframeSandbox } from '../iframe-sandbox'

it('allows external HTTP integrations their own storage but isolates same-origin and inline content', () => {
  const parent = 'https://94api.dev/profile'
  expect(iframeSandbox('https://chat.example.org/', parent)).toContain(
    'allow-same-origin'
  )
  for (const src of [
    undefined,
    '/profile',
    'https://94api.dev/chat',
    'data:text/html,test',
    'javascript:void(0)',
    'https://[invalid',
  ]) {
    expect(iframeSandbox(src, parent)).not.toContain('allow-same-origin')
    expect(iframeSandbox(src, parent)).toContain('allow-scripts')
  }
})
