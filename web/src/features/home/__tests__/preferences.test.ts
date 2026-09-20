import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (
    html: string,
    options: { url: string; runScripts: string }
  ) => { window: Window & typeof globalThis }
}

function openHome() {
  const root = resolve('public/94api-theme')
  const dom = new JSDOM(readFileSync(resolve(root, 'home.html'), 'utf8'), {
    url: 'https://94api.dev/94api-theme/home.html?embedded=1',
    runScripts: 'outside-only',
  })
  dom.window.eval(
    'window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }'
  )
  for (const script of dom.window.document.querySelectorAll('script[src]')) {
    const src = script.getAttribute('src')
    if (!src) throw new Error('Missing script source')
    dom.window.eval(readFileSync(resolve(root, src.split('?')[0]), 'utf8'))
  }
  return dom
}

describe('embedded homepage preferences', () => {
  it('translates the full document for every supported language and restores English', () => {
    const dom = openHome()
    try {
      for (const [lang, heading] of Object.entries({
        vi: 'Một điểm truy cập.',
        fr: 'Un seul point d’accès.',
        ru: 'Единая точка доступа.',
        ja: 'ひとつのエンドポイント。',
        zhCN: '一个端点。',
        zhTW: '一個端點。',
        en: 'One endpoint.',
      })) {
        dom.window.dispatchEvent(
          new dom.window.MessageEvent('message', {
            source: dom.window.parent,
            origin: 'https://94api.dev',
            data: { lang },
          })
        )
        expect(dom.window.document.querySelector('h1')?.textContent).toContain(
          heading
        )
        if (lang !== 'en') {
          expect(
            dom.window.document.querySelector('.hero-intro')?.textContent
          ).not.toContain('Connect OpenAI')
          expect(
            dom.window.document
              .querySelector('.copy-button')
              ?.getAttribute('aria-label')
          ).not.toBe('Copy request')
          const footer = dom.window.document.querySelector('footer')
          expect(footer?.textContent).not.toContain(
            'Access AI models, manage API keys'
          )
          expect(footer?.textContent).not.toContain('Resources')
          expect(footer?.textContent).not.toContain('Terms of Use')
          expect(footer?.textContent).not.toContain('Privacy Policy')
        }
        const footer = dom.window.document.querySelector('footer')
        const links = [...(footer?.querySelectorAll('nav a') ?? [])]
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
          '/docs',
          '/docs/quickstart',
          '/pricing',
          'mailto:support@94api.dev',
          '/user-agreement',
          '/privacy-policy',
        ])
        expect(
          links.every((link) => link.getAttribute('target') === '_top')
        ).toBe(true)
        expect(footer?.textContent).toContain('New API')
        expect(footer?.textContent).toContain('© 2023–2026 QuantumNous')
      }
    } finally {
      dom.window.close()
    }
  })

  it('applies parent light and dark preferences but ignores unrelated senders', () => {
    const dom = openHome()
    try {
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          source: dom.window.parent,
          origin: 'https://94api.dev',
          data: { themeMode: 'light' },
        })
      )
      expect(dom.window.document.documentElement.dataset.theme).toBe('light')
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          source: null,
          origin: 'https://94api.dev',
          data: { themeMode: 'dark' },
        })
      )
      expect(dom.window.document.documentElement.dataset.theme).toBe('light')
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          source: dom.window.parent,
          origin: 'https://untrusted.example',
          data: { themeMode: 'dark' },
        })
      )
      expect(dom.window.document.documentElement.dataset.theme).toBe('light')
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          source: dom.window.parent,
          origin: 'https://94api.dev',
          data: { themeMode: 'dark' },
        })
      )
      expect(dom.window.document.documentElement.dataset.theme).toBe('dark')
    } finally {
      dom.window.close()
    }
  })
})
