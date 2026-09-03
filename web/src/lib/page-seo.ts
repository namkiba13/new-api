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
import { useEffect } from 'react'

export type SeoLocale = 'en' | 'fr' | 'ja' | 'ru' | 'vi' | 'zh-CN' | 'zh-TW'

type PageSeoOptions = {
  title: string
  description: string
  locale: SeoLocale
  path: string
  image?: string
  modelCount?: number
}

const BASE_URL = 'https://94api.dev'
const LOCALES: SeoLocale[] = ['en', 'vi', 'zh-CN', 'zh-TW', 'fr', 'ru', 'ja']

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([name, value]) => {
    element?.setAttribute(name, value)
  })
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLLinkElement>(selector)
  if (!element) {
    element = document.createElement('link')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([name, value]) => {
    element?.setAttribute(name, value)
  })
}

export function usePageSeo(options: PageSeoOptions) {
  useEffect(() => {
    const canonical = `${BASE_URL}${options.path}?lang=${encodeURIComponent(options.locale)}`
    const image = options.image || `${BASE_URL}/logo.png`
    const previousTitle = document.title
    const previousLanguage = document.documentElement.lang

    document.title = options.title
    document.documentElement.lang = options.locale
    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: options.description,
    })
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: 'index, follow, max-image-preview:large',
    })
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'website',
    })
    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: '94API',
    })
    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: options.title,
    })
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: options.description,
    })
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: canonical,
    })
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: image,
    })
    upsertMeta('meta[property="og:locale"]', {
      property: 'og:locale',
      content: options.locale.replace('-', '_'),
    })
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    })
    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: options.title,
    })
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: options.description,
    })
    upsertMeta('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: image,
    })
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonical })

    document.head
      .querySelectorAll('link[data-94API-hreflang]')
      .forEach((element) => element.remove())
    LOCALES.forEach((locale) => {
      const element = document.createElement('link')
      element.rel = 'alternate'
      element.hreflang = locale
      element.href = `${BASE_URL}${options.path}?lang=${encodeURIComponent(locale)}`
      element.dataset.94APIHreflang = 'true'
      document.head.appendChild(element)
    })
    const fallback = document.createElement('link')
    fallback.rel = 'alternate'
    fallback.hreflang = 'x-default'
    fallback.href = `${BASE_URL}${options.path}?lang=en`
    fallback.dataset.94APIHreflang = 'true'
    document.head.appendChild(fallback)

    let structuredData = document.head.querySelector<HTMLScriptElement>(
      'script[data-94API-seo]'
    )
    if (!structuredData) {
      structuredData = document.createElement('script')
      structuredData.type = 'application/ld+json'
      structuredData.dataset.94APISeo = 'true'
      document.head.appendChild(structuredData)
    }
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${BASE_URL}/#website`,
          name: '94API',
          url: BASE_URL,
          inLanguage: options.locale,
        },
        {
          '@type': 'CollectionPage',
          '@id': `${canonical}#webpage`,
          name: options.title,
          description: options.description,
          url: canonical,
          isPartOf: { '@id': `${BASE_URL}/#website` },
          inLanguage: options.locale,
          ...(options.modelCount == null
            ? {}
            : { numberOfItems: options.modelCount }),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: '94API',
              item: BASE_URL,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: options.title,
              item: canonical,
            },
          ],
        },
      ],
    })

    return () => {
      document.title = previousTitle
      document.documentElement.lang = previousLanguage
    }
  }, [
    options.description,
    options.image,
    options.locale,
    options.modelCount,
    options.path,
    options.title,
  ])
}
