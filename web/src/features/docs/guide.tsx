/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { usePageSeo, type SeoLocale } from '@/lib/page-seo'

import { DOCS_GUIDES, type DocsGuide } from './data'
import { GUIDE_CONTENT, type GuideCode } from './guide-content'
import {
  docsGuideDescription,
  docsGuideTitle,
  docsSectionParagraphs,
  docsSectionTitle,
  docsUi,
} from './translations'

function CodeBlock(props: { code: GuideCode; copyLabel: string }) {
  const { copyToClipboard } = useCopyToClipboard()
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await copyToClipboard(props.code.value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className='overflow-hidden border bg-[#111310] text-[#eef1ea]'>
      <div className='flex h-10 items-center justify-between border-b border-white/10 px-3'>
        <span className='font-mono text-[10px] font-bold tracking-[0.08em] text-white/55 uppercase'>
          {props.code.label} · {props.code.language}
        </span>
        <button
          type='button'
          onClick={handleCopy}
          className='flex size-7 items-center justify-center text-white/55 transition-colors hover:bg-white/10 hover:text-white'
          aria-label={props.copyLabel}
        >
          {copied ? (
            <Check className='size-3.5' />
          ) : (
            <Copy className='size-3.5' />
          )}
        </button>
      </div>
      <pre className='overflow-x-auto p-4 text-[12px] leading-6 sm:p-5 sm:text-[13px]'>
        <code>{props.code.value}</code>
      </pre>
    </div>
  )
}

export function DocsGuidePage(props: { guide: DocsGuide }) {
  const { t, i18n } = useTranslation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const sections = GUIDE_CONTENT[props.guide.slug] || []
  const Icon = props.guide.icon
  let seoLocale = i18n.language as SeoLocale
  if (i18n.language === 'zhCN') seoLocale = 'zh-CN'
  if (i18n.language === 'zhTW') seoLocale = 'zh-TW'
  usePageSeo({
    title: `${docsGuideTitle(i18n.language, props.guide)} | 94API Docs`,
    description: docsGuideDescription(i18n.language, props.guide),
    locale: seoLocale,
    path: `/docs/${props.guide.slug}`,
  })

  return (
    <PublicLayout showMainContainer={false}>
      <div className='docs-shell min-h-svh'>
        <div className='mx-auto w-full max-w-[1680px] px-4 pt-20 sm:px-6 sm:pt-24 lg:px-10 xl:px-14'>
          <div className='flex items-center justify-between border-b py-4'>
            <Link
              to='/docs'
              className='text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors'
            >
              <ArrowLeft className='size-4' />
              {docsUi(i18n.language, 'back')}
            </Link>
            <button
              type='button'
              onClick={() => setMobileNavOpen(true)}
              className='hover:bg-muted flex h-9 items-center gap-2 border px-3 text-xs font-medium lg:hidden'
            >
              <Menu className='size-4' />
              {docsUi(i18n.language, 'browse')}
            </button>
          </div>

          <div className='grid lg:grid-cols-[260px_minmax(0,1fr)_220px]'>
            <aside className='hidden border-e py-8 pe-6 lg:block'>
              <DocsGuideNavigation currentSlug={props.guide.slug} />
            </aside>
            <main className='min-w-0 py-10 lg:px-10 xl:px-14'>
              <header className='max-w-4xl border-b pb-10'>
                <div className='mb-7 flex size-12 items-center justify-center border bg-[var(--docs-accent)] text-black'>
                  <Icon className='size-6' />
                </div>
                <p className='docs-kicker font-mono text-xs font-semibold tracking-[0.14em] uppercase'>
                  {docsUi(i18n.language, 'apiDocs')} / {t(props.guide.eyebrow)}
                </p>
                <h1 className='mt-4 text-[clamp(2.75rem,7vw,5rem)] leading-[0.95] font-semibold tracking-[-0.055em]'>
                  {docsGuideTitle(i18n.language, props.guide)}
                </h1>
                <p className='text-muted-foreground mt-6 max-w-3xl text-base leading-relaxed sm:text-lg'>
                  {docsGuideDescription(i18n.language, props.guide)}
                </p>
                <dl className='mt-8 grid border border-b-0 sm:grid-cols-3'>
                  <MetaItem
                    label={docsUi(i18n.language, 'baseUrl')}
                    value={props.guide.baseUrl}
                  />
                  <MetaItem
                    label={docsUi(i18n.language, 'example')}
                    value={props.guide.model || docsUi(i18n.language, 'choose')}
                  />
                  <MetaItem
                    label={docsUi(i18n.language, 'protocols')}
                    value={props.guide.protocols.join(' · ')}
                    last
                  />
                </dl>
              </header>

              <div className='max-w-4xl'>
                {sections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className='scroll-mt-28 border-b py-10 sm:py-12'
                  >
                    <h2 className='text-2xl font-semibold tracking-[-0.035em] sm:text-3xl'>
                      {docsSectionTitle(
                        i18n.language,
                        section.id,
                        section.title
                      )}
                    </h2>
                    <div className='mt-5 space-y-4'>
                      {(
                        docsSectionParagraphs(
                          i18n.language,
                          props.guide,
                          section.id
                        ) || section.paragraphs
                      ).map((paragraph) => (
                        <p
                          key={paragraph}
                          className='text-muted-foreground text-[15px] leading-7'
                        >
                          {t(paragraph)}
                        </p>
                      ))}
                    </div>
                    {section.code && (
                      <div className='mt-7 space-y-4'>
                        {section.code.map((code) => (
                          <CodeBlock
                            key={`${section.id}-${code.label}`}
                            code={code}
                            copyLabel={docsUi(i18n.language, 'copyCode')}
                          />
                        ))}
                      </div>
                    )}
                    {section.note && (
                      <div className='mt-7 flex gap-3 border-s-2 border-[var(--docs-accent)] bg-[var(--docs-accent-soft)] p-4'>
                        <Info className='mt-0.5 size-4 shrink-0 text-[var(--docs-accent)]' />
                        <p className='text-sm leading-6'>
                          {docsSectionParagraphs(
                            i18n.language,
                            props.guide,
                            section.id
                          )?.[0] || t(section.note)}
                        </p>
                      </div>
                    )}
                  </section>
                ))}

                <section id='common-problems' className='scroll-mt-28 py-10'>
                  <h2 className='text-2xl font-semibold tracking-[-0.035em]'>
                    {docsUi(i18n.language, 'common')}
                  </h2>
                  <div className='mt-6 overflow-x-auto border'>
                    <table className='w-full min-w-[560px] text-start text-sm'>
                      <thead className='bg-muted/50 font-mono text-[10px] uppercase'>
                        <tr>
                          <th className='border-e p-3 text-start'>
                            {docsUi(i18n.language, 'symptom')}
                          </th>
                          <th className='p-3 text-start'>
                            {docsUi(i18n.language, 'action')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            '401 / Unauthorized',
                            'Create a new key and confirm that the complete value is being used.',
                          ],
                          [
                            'model_not_found',
                            'Choose a model enabled for the API key group or copy its exact catalog name.',
                          ],
                          [
                            'Connection timeout',
                            'Check the Base URL, network connection, and remove any trailing duplicate /v1.',
                          ],
                        ].map(([symptom, solution]) => (
                          <tr key={symptom} className='border-t'>
                            <td className='border-e p-3 font-mono text-xs font-semibold'>
                              {symptom}
                            </td>
                            <td className='text-muted-foreground p-3'>
                              {t(solution)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className='mb-14 flex flex-col justify-between gap-5 border bg-[var(--docs-accent-soft)] p-6 sm:flex-row sm:items-center'>
                  <div>
                    <p className='font-semibold'>
                      {docsUi(i18n.language, 'needHelp')}
                    </p>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      {docsUi(i18n.language, 'helpDetail')}
                    </p>
                  </div>
                  <a
                    href='mailto:support@94api.dev'
                    className='inline-flex h-10 items-center justify-center gap-2 bg-[var(--docs-accent)] px-4 text-sm font-semibold text-black'
                  >
                    {docsUi(i18n.language, 'contact')}
                    <ExternalLink className='size-4' />
                  </a>
                </div>
              </div>
            </main>

            <aside className='hidden border-s py-10 ps-6 lg:block'>
              <div className='sticky top-24'>
                <p className='text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase'>
                  {docsUi(i18n.language, 'onPage')}
                </p>
                <nav className='mt-4 space-y-1'>
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className='text-muted-foreground hover:text-foreground block border-s ps-3 text-xs leading-5 transition-colors hover:border-[var(--docs-accent)]'
                    >
                      {docsSectionTitle(
                        i18n.language,
                        section.id,
                        section.title
                      )}
                    </a>
                  ))}
                  <a
                    href='#common-problems'
                    className='text-muted-foreground hover:text-foreground block border-s ps-3 text-xs leading-5 transition-colors hover:border-[var(--docs-accent)]'
                  >
                    {docsUi(i18n.language, 'common')}
                  </a>
                </nav>
              </div>
            </aside>
          </div>
        </div>

        {mobileNavOpen && (
          <div className='fixed inset-0 z-60 bg-black/55 p-3 backdrop-blur-sm lg:hidden'>
            <div className='bg-background ms-auto flex h-full w-full max-w-sm flex-col border shadow-2xl'>
              <div className='flex items-center justify-between border-b p-4'>
                <strong>{docsUi(i18n.language, 'setup')}</strong>
                <button
                  type='button'
                  onClick={() => setMobileNavOpen(false)}
                  className='hover:bg-muted flex size-9 items-center justify-center border'
                  aria-label={docsUi(i18n.language, 'close')}
                >
                  <X className='size-4' />
                </button>
              </div>
              <div className='overflow-y-auto p-4'>
                <DocsGuideNavigation
                  currentSlug={props.guide.slug}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
        <Footer />
      </div>
    </PublicLayout>
  )
}

function MetaItem(props: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`border-b p-4 ${props.last ? '' : 'sm:border-e'}`}>
      <dt className='text-muted-foreground font-mono text-[9px] font-bold uppercase'>
        {props.label}
      </dt>
      <dd className='mt-2 truncate font-mono text-xs font-semibold'>
        {props.value}
      </dd>
    </div>
  )
}

function DocsGuideNavigation(props: {
  currentSlug: string
  onNavigate?: () => void
}) {
  const { i18n } = useTranslation()
  return (
    <nav>
      <p className='text-muted-foreground mb-4 font-mono text-[10px] font-bold tracking-[0.12em] uppercase'>
        {docsUi(i18n.language, 'setup')}
      </p>
      <div className='space-y-1'>
        {DOCS_GUIDES.map((guide, index) => (
          <Link
            key={guide.slug}
            to='/docs/$guide'
            params={{ guide: guide.slug }}
            onClick={props.onNavigate}
            className={`group flex items-center gap-3 border-s-2 px-3 py-2.5 text-sm transition-colors ${props.currentSlug === guide.slug ? 'text-foreground border-[var(--docs-accent)] bg-[var(--docs-accent-soft)]' : 'text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'}`}
          >
            <span className='font-mono text-[9px]'>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className='min-w-0 flex-1 truncate'>
              {docsGuideTitle(i18n.language, guide)}
            </span>
            <ChevronRight className='size-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
          </Link>
        ))}
      </div>
    </nav>
  )
}
