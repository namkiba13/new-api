/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Link } from '@tanstack/react-router'
import { ArrowRight, Copy, ExternalLink, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { usePageSeo, type SeoLocale } from '@/lib/page-seo'

import { DOCS_GUIDES } from './data'
import { docsGuideDescription, docsGuideTitle, docsUi } from './translations'

export function DocsIndex() {
  const { t, i18n } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const [search, setSearch] = useState('')

  const seoCopy = useMemo(() => {
    const copy = {
      en: [
        '94API API Documentation – Setup Guides',
        'Connect Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch, and official SDKs to the 94API AI gateway.',
      ],
      vi: [
        'Tài liệu API 94API – Hướng dẫn cài đặt',
        'Kết nối Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch và các SDK chính thức với cổng AI 94API.',
      ],
      zhCN: [
        '94API API 文档 – 设置指南',
        '将 Codex、Claude Code、Gemini CLI、OpenCode、CC-Switch 和官方 SDK 连接到 94API AI 网关。',
      ],
      zhTW: [
        '94API API 文件 – 設定指南',
        '將 Codex、Claude Code、Gemini CLI、OpenCode、CC-Switch 與官方 SDK 連接至 94API AI 閘道。',
      ],
      fr: [
        "Documentation de l'API 94API – Guides de configuration",
        'Connectez Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch et les SDK officiels à la passerelle IA 94API.',
      ],
      ru: [
        'Документация API 94API — Руководства по настройке',
        'Подключите Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch и официальные SDK к ИИ-шлюзу 94API.',
      ],
      ja: [
        '94API APIドキュメント – セットアップガイド',
        'Codex、Claude Code、Gemini CLI、OpenCode、CC-Switch、公式SDKを94API AIゲートウェイに接続します。',
      ],
    } as const
    return copy[i18n.language as keyof typeof copy] || copy.en
  }, [i18n.language])

  let seoLocale = i18n.language as SeoLocale
  if (i18n.language === 'zhCN') seoLocale = 'zh-CN'
  if (i18n.language === 'zhTW') seoLocale = 'zh-TW'
  usePageSeo({
    title: seoCopy[0],
    description: seoCopy[1],
    locale: seoLocale,
    path: '/docs',
  })

  const guides = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return DOCS_GUIDES
    return DOCS_GUIDES.filter((guide) =>
      [
        guide.title,
        docsGuideTitle(i18n.language, guide),
        guide.eyebrow,
        guide.description,
        docsGuideDescription(i18n.language, guide),
        ...guide.protocols,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [i18n.language, search])

  return (
    <PublicLayout showMainContainer={false}>
      <div className='docs-shell relative min-h-svh'>
        <div className='relative mx-auto w-full max-w-[1680px] px-4 pt-20 pb-16 sm:px-6 sm:pt-24 lg:px-10 xl:px-14'>
          <header className='grid gap-10 pt-5 pb-12 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end'>
            <div className='max-w-5xl'>
              <p className='docs-kicker mb-5 flex items-center gap-3 font-mono text-xs font-semibold tracking-[0.14em] uppercase sm:text-sm'>
                <span className='size-2.5 bg-[var(--docs-accent)] shadow-[4px_4px_0_var(--docs-accent-soft)]' />
                {docsUi(i18n.language, 'apiDocs')}
              </p>
              <h1 className='max-w-5xl text-[clamp(3rem,7vw,5.75rem)] leading-[0.94] font-semibold tracking-[-0.06em]'>
                {docsUi(i18n.language, 'build')}
                <br />
                <span className='text-[var(--docs-accent)]'>
                  {docsUi(i18n.language, 'oneApi')}
                </span>
              </h1>
              <p className='text-muted-foreground mt-7 max-w-3xl text-base leading-relaxed sm:text-lg'>
                {docsUi(i18n.language, 'summary')}
              </p>
            </div>

            <div className='space-y-3'>
              <div className='bg-background/90 border p-4 shadow-[0_24px_80px_-52px_rgba(0,0,0,.65)] backdrop-blur-sm'>
                <span className='text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase'>
                  {docsUi(i18n.language, 'baseUrl')}
                </span>
                <div className='mt-2 flex items-center justify-between gap-3'>
                  <code className='min-w-0 truncate font-mono text-sm font-semibold'>
                    https://94api.dev/v1
                  </code>
                  <button
                    type='button'
                    onClick={() => copyToClipboard('https://94api.dev/v1')}
                    className='hover:bg-muted flex size-9 shrink-0 items-center justify-center border transition-colors'
                    aria-label={docsUi(i18n.language, 'copyBase')}
                  >
                    <Copy className='size-4' />
                  </button>
                </div>
              </div>
              <a
                href='mailto:support@94api.dev'
                className='text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs transition-colors'
              >
                {docsUi(i18n.language, 'support')}
                <ExternalLink className='size-3.5' />
              </a>
            </div>
          </header>

          <section className='border-t pt-8'>
            <div className='mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end'>
              <div>
                <p className='docs-kicker font-mono text-xs font-semibold tracking-[0.12em] uppercase'>
                  {docsUi(i18n.language, 'setup')}
                </p>
                <p className='text-muted-foreground mt-2 text-sm'>
                  {String(DOCS_GUIDES.length).padStart(2, '0')} —{' '}
                  {docsUi(i18n.language, 'integrations')}
                </p>
              </div>
              <label className='bg-background/90 flex h-11 w-full items-center gap-3 border px-3 sm:w-80'>
                <Search className='text-muted-foreground size-4' />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={docsUi(i18n.language, 'search')}
                  className='text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none'
                  aria-label={docsUi(i18n.language, 'search')}
                />
                <kbd className='text-muted-foreground hidden border px-1.5 py-0.5 font-mono text-[9px] sm:block'>
                  /
                </kbd>
              </label>
            </div>

            <div className='grid border border-b-0 md:grid-cols-2 xl:grid-cols-4'>
              {guides.map((guide, index) => {
                const Icon = guide.icon
                return (
                  <article
                    key={guide.slug}
                    className='group relative flex min-h-[430px] flex-col border-e border-b p-5 transition-colors hover:bg-[var(--docs-accent-soft)] sm:p-6'
                  >
                    <div className='mb-10 flex items-start justify-between gap-4'>
                      <span className='font-mono text-xs font-bold text-[var(--docs-accent)]'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className='bg-muted flex size-10 items-center justify-center border text-black dark:bg-white/90'>
                        <Icon className='size-5' />
                      </span>
                    </div>
                    <p className='text-muted-foreground font-mono text-[10px] font-bold tracking-[0.1em] uppercase'>
                      {t(guide.eyebrow)}
                    </p>
                    <h2 className='mt-3 text-2xl leading-tight font-semibold tracking-[-0.035em]'>
                      {docsGuideTitle(i18n.language, guide)}
                    </h2>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t(guide.subtitle)}
                    </p>
                    <p className='text-muted-foreground mt-5 text-sm leading-relaxed'>
                      {docsGuideDescription(i18n.language, guide)}
                    </p>
                    <div className='mt-6 flex flex-wrap gap-1.5'>
                      {guide.protocols.map((protocol) => (
                        <span
                          key={protocol}
                          className='border px-2 py-1 font-mono text-[9px] uppercase'
                        >
                          {protocol}
                        </span>
                      ))}
                    </div>
                    <dl className='mt-auto grid gap-3 pt-8 text-xs'>
                      <div>
                        <dt className='text-muted-foreground font-mono text-[9px] uppercase'>
                          {docsUi(i18n.language, 'baseUrl')}
                        </dt>
                        <dd className='mt-1 truncate font-mono font-semibold'>
                          {guide.baseUrl}
                        </dd>
                      </div>
                      {guide.model && (
                        <div>
                          <dt className='text-muted-foreground font-mono text-[9px] uppercase'>
                            {docsUi(i18n.language, 'example')}
                          </dt>
                          <dd className='mt-1 truncate font-mono font-semibold'>
                            {guide.model}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <Link
                      to='/docs/$guide'
                      params={{ guide: guide.slug }}
                      className='mt-7 flex min-h-11 items-center justify-between bg-[var(--docs-accent)] px-4 font-mono text-[10px] font-bold tracking-[0.1em] text-black uppercase shadow-[4px_4px_0_var(--docs-accent-soft)] transition-[transform,filter,box-shadow] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--docs-accent-soft)] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--docs-accent)]'
                    >
                      {docsUi(i18n.language, 'view')}
                      <ArrowRight className='size-4 transition-transform group-hover:translate-x-1' />
                    </Link>
                  </article>
                )
              })}
            </div>

            {guides.length === 0 && (
              <div className='border border-t-0 p-12 text-center'>
                <p className='font-semibold'>
                  {docsUi(i18n.language, 'noResults')}
                </p>
                <button
                  type='button'
                  onClick={() => setSearch('')}
                  className='text-muted-foreground hover:text-foreground mt-3 text-sm underline underline-offset-4'
                >
                  {docsUi(i18n.language, 'clear')}
                </button>
              </div>
            )}
          </section>
        </div>
        <Footer />
      </div>
    </PublicLayout>
  )
}
