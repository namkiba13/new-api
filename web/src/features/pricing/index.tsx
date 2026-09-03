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
import { Check, ChevronDown, ChevronRight, Copy, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { usePageSeo, type SeoLocale } from '@/lib/page-seo'

import {
  LoadingSkeleton,
  EmptyState,
  SearchBar,
  PricingTable,
  PricingToolbar,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import {
  EXCLUDED_GROUPS,
  getEndpointTypeDisplayName,
  VIEW_MODES,
} from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'
import { isTokenBasedModel } from './lib/model-helpers'
import {
  formatFixedPrice,
  formatGroupPrice,
  formatPrice,
  formatRequestPrice,
} from './lib/price'
import { getPricingModelIcon, getPricingProvider } from './lib/provider-icon'

export function Pricing() {
  const { t, i18n } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )
  const [selectedCatalogModelName, setSelectedCatalogModelName] = useState<
    string | null
  >(null)
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false)
  const [pendingCatalogModelName, setPendingCatalogModelName] = useState<
    string | null
  >(null)
  const mobileCatalogDialogRef = useRef<HTMLDialogElement>(null)
  const [openCatalogGroups, setOpenCatalogGroups] = useState(
    () => new Set<string>()
  )
  const [expandedCatalogGroups, setExpandedCatalogGroups] = useState(
    () => new Set<string>()
  )

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  useEffect(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get(
      'lang'
    )
    if (requestedLanguage && requestedLanguage !== i18n.language) {
      void i18n.changeLanguage(requestedLanguage)
    }
  }, [i18n])

  useEffect(() => {
    const dialog = mobileCatalogDialogRef.current
    if (!dialog) return
    if (mobileCatalogOpen && !dialog.open) dialog.showModal()
    if (!mobileCatalogOpen && dialog.open) dialog.close()
  }, [mobileCatalogOpen])

  const seoCopy = useMemo(() => {
    const copy = {
      en: [
        'AI Model Pricing – GPT, Claude & Gemini | 94API',
        'Compare API pricing, endpoints, and capabilities for GPT, Claude, Gemini, and other AI models available through 94API.',
      ],
      vi: [
        'Bảng giá mô hình AI – GPT, Claude và Gemini | 94API',
        'So sánh giá API, endpoint và khả năng của GPT, Claude, Gemini cùng các mô hình AI khác được cung cấp qua 94API.',
      ],
      zhCN: [
        'AI 模型价格 – GPT、Claude 与 Gemini | 94API',
        '比较 94API 提供的 GPT、Claude、Gemini 及其他 AI 模型的 API 价格、端点和能力。',
      ],
      zhTW: [
        'AI 模型價格 – GPT、Claude 與 Gemini | 94API',
        '比較 94API 提供的 GPT、Claude、Gemini 與其他 AI 模型的 API 價格、端點及能力。',
      ],
      fr: [
        'Tarifs des modèles IA – GPT, Claude et Gemini | 94API',
        "Comparez les tarifs API, les points d'accès et les capacités de GPT, Claude, Gemini et d'autres modèles IA sur 94API.",
      ],
      ru: [
        'Цены на ИИ-модели – GPT, Claude и Gemini | 94API',
        'Сравнивайте цены API, эндпоинты и возможности GPT, Claude, Gemini и других ИИ-моделей в 94API.',
      ],
      ja: [
        'AIモデル料金 – GPT・Claude・Gemini | 94API',
        '94APIで利用できるGPT、Claude、GeminiなどのAIモデルのAPI料金、エンドポイント、機能を比較できます。',
      ],
    } as const
    return copy[i18n.language as keyof typeof copy] || copy.en
  }, [i18n.language])

  let seoLocale = i18n.language as SeoLocale
  if (i18n.language === 'zhCN') {
    seoLocale = 'zh-CN'
  } else if (i18n.language === 'zhTW') {
    seoLocale = 'zh-TW'
  }

  usePageSeo({
    title: seoCopy[0],
    description: seoCopy[1],
    locale: seoLocale,
    path: '/pricing',
    modelCount: models?.length,
  })

  const {
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    tokenUnit,
    viewMode,
    showRechargePrice,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setGroupFilter,
    setQuotaTypeFilter,
    setEndpointTypeFilter,
    setTagFilter,
    setTokenUnit,
    setViewMode,
    setShowRechargePrice,
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    availableTags,
    clearFilters,
    clearSearch,
  } = useFilters(models || [])

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? (models || []).find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [models, selectedModelName]
  )

  const visibleSelectedCatalogModelName = filteredModels.some(
    (model) => model.model_name === selectedCatalogModelName
  )
    ? selectedCatalogModelName
    : (filteredModels[0]?.model_name ?? null)

  const selectedCatalogModel = useMemo(
    () =>
      visibleSelectedCatalogModelName
        ? (models || []).find(
            (model) => model.model_name === visibleSelectedCatalogModelName
          ) || null
        : null,
    [models, visibleSelectedCatalogModelName]
  )

  const availableGroups = useMemo(
    () =>
      Object.keys(usableGroup || {}).filter(
        (g) => !EXCLUDED_GROUPS.includes(g)
      ),
    [usableGroup]
  )

  const catalogGroups = useMemo(() => {
    const grouped = new Map<string, typeof filteredModels>()
    for (const model of filteredModels) {
      const provider = getPricingProvider(model)
      const items = grouped.get(provider) || []
      items.push(model)
      grouped.set(provider, items)
    }
    return Array.from(grouped, ([label, items]) => ({ label, items })).sort(
      (a, b) =>
        b.items.length - a.items.length || a.label.localeCompare(b.label)
    )
  }, [filteredModels])

  const selectedPricing = useMemo(() => {
    if (!selectedCatalogModel) return null
    if (!isTokenBasedModel(selectedCatalogModel)) {
      const request = formatRequestPrice(
        selectedCatalogModel,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupFilter
      )
      return { input: request, cache: '—', output: request }
    }
    return {
      input: formatPrice(
        selectedCatalogModel,
        'input',
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupFilter
      ),
      cache:
        selectedCatalogModel.cache_ratio == null
          ? '—'
          : formatPrice(
              selectedCatalogModel,
              'cache',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              groupFilter
            ),
      output: formatPrice(
        selectedCatalogModel,
        'output',
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupFilter
      ),
    }
  }, [
    groupFilter,
    priceRate,
    selectedCatalogModel,
    showRechargePrice,
    tokenUnit,
    usdExchangeRate,
  ])

  const selectedGroupRoutes = useMemo(() => {
    if (!selectedCatalogModel) return []

    const enabledGroups = selectedCatalogModel.enable_groups || []
    const familyPrefixes = new Set(
      enabledGroups
        .map((group) => group.match(/^(.+)-(award|stable|premium)$/)?.[1])
        .filter((prefix): prefix is string => Boolean(prefix))
    )
    const tierOrder: Record<string, number> = {
      award: 0,
      stable: 1,
      premium: 2,
    }
    const relatedGroups = Object.keys(usableGroup || {}).filter((group) => {
      const match = group.match(/^(.+)-(award|stable|premium)$/)
      return Boolean(match && familyPrefixes.has(match[1]))
    })
    const groups = relatedGroups.length > 0 ? relatedGroups : enabledGroups

    return [...new Set(groups)]
      .filter((group) => group && !EXCLUDED_GROUPS.includes(group))
      .sort((left, right) => {
        const leftTier = left.split('-').at(-1) || ''
        const rightTier = right.split('-').at(-1) || ''
        return (tierOrder[leftTier] ?? 99) - (tierOrder[rightTier] ?? 99)
      })
      .map((group) => {
        const groupInfo = usableGroup?.[group]
        const description =
          typeof groupInfo === 'string' ? groupInfo : groupInfo?.desc
        const tier = group.split('-').at(-1) || group
        const fixedPrice = formatFixedPrice(
          selectedCatalogModel,
          group,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          groupRatio
        )
        const formatRoutePrice = (type: 'input' | 'output' | 'cache') => {
          if (isTokenBasedModel(selectedCatalogModel)) {
            return formatGroupPrice(
              selectedCatalogModel,
              group,
              type,
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              groupRatio
            )
          }
          return type === 'cache' ? '—' : fixedPrice
        }

        return {
          group,
          tier,
          description,
          ratio: groupRatio[group] ?? 1,
          recommended: tier === 'stable',
          input: formatRoutePrice('input'),
          output: formatRoutePrice('output'),
          cache:
            selectedCatalogModel.cache_ratio == null
              ? '—'
              : formatRoutePrice('cache'),
        }
      })
  }, [
    groupRatio,
    priceRate,
    selectedCatalogModel,
    showRechargePrice,
    tokenUnit,
    usableGroup,
    usdExchangeRate,
  ])

  const handleClearAll = useCallback(() => {
    clearFilters()
    clearSearch()
  }, [clearFilters, clearSearch])

  const renderPricingContent = () => {
    if (filteredModels.length === 0) {
      return (
        <EmptyState
          searchQuery={searchInput}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAll}
        />
      )
    }

    const visibleModels = selectedCatalogModel
      ? [selectedCatalogModel]
      : filteredModels

    if (viewMode === VIEW_MODES.CARD) {
      return (
        <ModelCardGrid
          models={visibleModels}
          onModelClick={handleModelClick}
          priceRate={priceRate}
          usdExchangeRate={usdExchangeRate}
          tokenUnit={tokenUnit}
          showRechargePrice={showRechargePrice}
          selectedGroup={groupFilter}
        />
      )
    }

    return (
      <PricingTable
        models={visibleModels}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
        selectedGroup={groupFilter}
        onModelClick={handleModelClick}
      />
    )
  }

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <LoadingSkeleton viewMode={viewMode} />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='pricing-shell relative min-h-svh'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[600px] opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
              'radial-gradient(ellipse 40% 35% at 50% 70%, oklch(0.70 0.12 280 / 40%) 0%, transparent 70%)',
            ].join(', '),
            maskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />
        <PageTransition className='relative mx-auto w-full max-w-[1680px] transform-none! px-4 pt-20 pb-12 sm:px-6 sm:pt-24 lg:px-10 xl:px-14'>
          <header className='mb-8 max-w-5xl pt-5 text-start sm:mb-12 sm:pt-10'>
            <p className='pricing-kicker mb-5 flex items-center gap-3 font-mono text-xs font-semibold tracking-[0.14em] uppercase sm:text-sm'>
              <span
                aria-hidden
                className='size-2.5 bg-[var(--pricing-accent)] shadow-[4px_4px_0_var(--pricing-accent-soft)]'
              />
              {t('This site currently has {{count}} models enabled', {
                count: models?.length || 0,
              })}
            </p>
            <h1 className='max-w-4xl text-[clamp(2.75rem,7vw,4.75rem)] leading-[0.96] font-semibold tracking-[-0.055em]'>
              {t('Models & Pricing')}
            </h1>
            <p className='text-muted-foreground mt-5 max-w-3xl text-base leading-relaxed sm:text-lg'>
              {t(
                'Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.'
              )}
            </p>
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onClear={clearSearch}
              placeholder={t(
                'Search model name, provider, endpoint, or tag...'
              )}
              className='mt-7 max-w-3xl xl:hidden'
            />
          </header>

          {selectedCatalogModel && (
            <button
              type='button'
              onClick={() => setMobileCatalogOpen(true)}
              className='group bg-background/90 dark:bg-card/80 hover:bg-muted/40 mb-3 flex w-full items-center gap-2.5 border px-3 py-2.5 text-start transition-colors xl:hidden dark:border-white/10'
            >
              <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-sm dark:bg-white/90'>
                {getPricingModelIcon(selectedCatalogModel, 20) ||
                  selectedCatalogModel.model_name.charAt(0).toUpperCase()}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='text-muted-foreground block font-mono text-[9px] tracking-[0.1em] uppercase'>
                  {t('Selected Model')}
                </span>
                <strong className='mt-0.5 block truncate font-mono text-xs'>
                  {getPricingProvider(selectedCatalogModel)}
                </strong>
              </span>
              <span className='flex h-8 shrink-0 items-center gap-1 bg-[var(--pricing-accent)] px-2.5 text-xs font-semibold text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)] transition-[filter,transform] group-hover:brightness-95 group-active:translate-y-px dark:shadow-[0_0_0_1px_rgba(255,255,255,.08)]'>
                {t('Change model')}
                <ChevronRight className='size-4' />
              </span>
            </button>
          )}

          <div className='pricing-workspace bg-background/90 dark:bg-card/80 grid min-h-[680px] overflow-hidden rounded-sm border shadow-[0_24px_80px_-52px_rgba(0,0,0,.65)] backdrop-blur-sm xl:grid-cols-[340px_minmax(0,1fr)] dark:border-white/10'>
            <dialog
              ref={mobileCatalogDialogRef}
              onCancel={() => setMobileCatalogOpen(false)}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setMobileCatalogOpen(false)
                }
              }}
              className='m-0 h-dvh max-h-none w-full max-w-none items-end justify-center bg-transparent p-3 backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:flex xl:contents xl:backdrop:bg-transparent xl:[&:not([open])]:contents'
            >
              <aside
                className={`bg-background text-foreground dark:bg-card w-full max-w-xl flex-col overflow-hidden rounded-sm border shadow-2xl xl:sticky xl:top-20 xl:flex xl:max-h-[calc(100dvh-6rem)] xl:max-w-none xl:self-start xl:rounded-none xl:border-y-0 xl:border-s-0 xl:border-e xl:shadow-none dark:border-white/10 ${
                  mobileCatalogOpen
                    ? 'animate-in fade-in-0 slide-in-from-bottom-4 flex max-h-[82dvh] duration-300'
                    : 'hidden'
                }`}
              >
                <div className='border-b p-4'>
                  <div className='mb-3 flex items-center justify-between font-mono text-[11px] font-bold tracking-[0.12em] uppercase'>
                    <span className='text-foreground'>
                      {t('Model Catalog')}
                    </span>
                    <span className='text-muted-foreground ms-auto'>
                      {filteredModels.length} {t('models')}
                    </span>
                    <button
                      type='button'
                      aria-label={t('Close')}
                      onClick={() => setMobileCatalogOpen(false)}
                      className='hover:bg-muted ms-2 -me-1 flex size-8 items-center justify-center rounded-sm transition-colors xl:hidden'
                    >
                      <X className='size-4' />
                    </button>
                  </div>
                  <SearchBar
                    value={searchInput}
                    onChange={setSearchInput}
                    onClear={clearSearch}
                    placeholder={t('Search models...')}
                  />
                </div>
                <div className='hover-scrollbar flex-1 [scrollbar-gutter:stable] overflow-y-auto p-3'>
                  <div className='space-y-3'>
                    {catalogGroups.map(({ label, items }) => {
                      const isOpen = openCatalogGroups.has(label)
                      const expanded = expandedCatalogGroups.has(label)
                      const visibleItems = expanded ? items : items.slice(0, 3)
                      const hiddenCount = items.length - visibleItems.length
                      return (
                        <section
                          key={label}
                          className='border-b pb-3 last:border-b-0'
                        >
                          <button
                            type='button'
                            onClick={() =>
                              setOpenCatalogGroups((current) =>
                                current.has(label)
                                  ? new Set<string>()
                                  : new Set<string>([label])
                              )
                            }
                            aria-expanded={isOpen}
                            className='hover:bg-muted/50 flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-2 text-start transition-colors'
                          >
                            <span className='bg-muted flex size-6 items-center justify-center rounded-sm font-mono text-[10px] font-bold dark:bg-white/90'>
                              {getPricingModelIcon(items[0], 15) ||
                                label.charAt(0)}
                            </span>
                            <strong className='text-foreground flex-1 font-mono text-xs uppercase'>
                              {t(label)}
                            </strong>
                            <span className='text-muted-foreground font-mono text-[10px]'>
                              {items.length} {t('models')}
                            </span>
                            {isOpen ? (
                              <ChevronDown className='text-muted-foreground size-3.5' />
                            ) : (
                              <ChevronRight className='text-muted-foreground size-3.5' />
                            )}
                          </button>

                          <div
                            aria-hidden={!isOpen}
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                              isOpen
                                ? 'grid-rows-[1fr] opacity-100'
                                : 'pointer-events-none grid-rows-[0fr] opacity-0'
                            }`}
                          >
                            <div className='min-h-0 overflow-hidden'>
                              <div className='mt-1 space-y-1.5'>
                                {visibleItems.map((model) => {
                                  const active =
                                    model.model_name ===
                                      visibleSelectedCatalogModelName ||
                                    model.model_name === pendingCatalogModelName
                                  const endpoints =
                                    model.supported_endpoint_types || []
                                  return (
                                    <button
                                      key={model.model_name}
                                      type='button'
                                      onClick={() => {
                                        setPendingCatalogModelName(
                                          model.model_name
                                        )
                                        setSelectedCatalogModelName(
                                          model.model_name
                                        )
                                        window.setTimeout(() => {
                                          setMobileCatalogOpen(false)
                                          setPendingCatalogModelName(null)
                                        }, 220)
                                      }}
                                      className={`group/catalog relative flex w-full items-center gap-3 rounded-sm border px-2.5 py-2.5 text-start transition-all ${
                                        active
                                          ? 'border-[var(--pricing-accent)] bg-[var(--pricing-accent-soft)] shadow-[inset_3px_0_0_var(--pricing-accent)]'
                                          : 'hover:border-border hover:bg-muted/45 border-transparent'
                                      }`}
                                    >
                                      <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-sm font-mono text-[11px] font-bold dark:bg-white/90'>
                                        {getPricingModelIcon(model, 20) ||
                                          model.model_name
                                            .charAt(0)
                                            .toUpperCase()}
                                      </span>
                                      <span className='min-w-0 flex-1'>
                                        <strong className='text-foreground block truncate font-mono text-xs'>
                                          {model.model_name}
                                        </strong>
                                        <span className='text-muted-foreground mt-1 block truncate text-[11px]'>
                                          {getPricingProvider(model)} ·{' '}
                                          {endpoints[0]
                                            ? getEndpointTypeDisplayName(
                                                endpoints[0]
                                              )
                                            : t('Model')}
                                        </span>
                                      </span>
                                      <span className='shrink-0 text-end'>
                                        <span className='text-muted-foreground block font-mono text-[8px] uppercase'>
                                          {t('Routes')}
                                        </span>
                                        <strong className='font-mono text-xs'>
                                          {endpoints.length || 1}
                                        </strong>
                                      </span>
                                    </button>
                                  )
                                })}

                                {hiddenCount > 0 && (
                                  <button
                                    type='button'
                                    onClick={() =>
                                      setExpandedCatalogGroups((current) => {
                                        const next = new Set(current)
                                        next.add(label)
                                        return next
                                      })
                                    }
                                    className='text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-3 py-2 text-xs transition-colors'
                                  >
                                    <span>{t('Expand')}</span>
                                    <span className='font-mono'>
                                      +{hiddenCount}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </section>
                      )
                    })}
                  </div>
                </div>
              </aside>
            </dialog>

            <main className='min-w-0 space-y-0'>
              {selectedCatalogModel && selectedPricing && (
                <>
                  <div className='flex min-h-28 flex-col justify-between gap-5 border-b p-4 sm:p-5 lg:flex-row lg:items-center'>
                    <div className='flex min-w-0 items-start gap-3'>
                      <span className='bg-muted flex size-11 shrink-0 items-center justify-center rounded-sm font-mono text-sm font-bold dark:bg-white/90'>
                        {getPricingModelIcon(selectedCatalogModel, 28) ||
                          selectedCatalogModel.model_name
                            .charAt(0)
                            .toUpperCase()}
                      </span>
                      <div className='min-w-0'>
                        <p className='text-muted-foreground mb-2 font-mono text-[10px] font-bold tracking-[0.12em] uppercase'>
                          {t('Selected Model')} /{' '}
                          {getPricingProvider(selectedCatalogModel)}
                        </p>
                        <div className='flex min-w-0 items-center gap-2.5'>
                          <h2 className='min-w-0 truncate font-mono text-xl font-bold sm:text-2xl'>
                            {selectedCatalogModel.model_name}
                          </h2>
                          <button
                            type='button'
                            onClick={() =>
                              copyToClipboard(selectedCatalogModel.model_name)
                            }
                            className='bg-background hover:bg-muted flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors'
                            title={t('Copy')}
                            aria-label={t('Copy model name')}
                          >
                            {copiedText ===
                            selectedCatalogModel.model_name ? (
                              <Check className='text-success size-3.5 shrink-0' />
                            ) : (
                              <Copy className='size-3.5 shrink-0' />
                            )}
                          </button>
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1.5'>
                          {(
                            selectedCatalogModel.supported_endpoint_types || []
                          ).map((endpoint) => (
                            <span
                              key={endpoint}
                              className='bg-muted/40 border px-2 py-0.5 font-mono text-[9px] uppercase'
                            >
                              {getEndpointTypeDisplayName(endpoint)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='text-muted-foreground me-1 font-mono text-[9px] font-bold tracking-[0.12em] uppercase'>
                        {t('Price display')}
                      </span>
                      <div className='flex border'>
                        {(['M', 'K'] as const).map((unit) => (
                          <button
                            key={unit}
                            type='button'
                            onClick={() => setTokenUnit(unit)}
                            className={`h-8 border-e px-3 font-mono text-[10px] last:border-e-0 ${
                              tokenUnit === unit
                                ? 'bg-foreground text-background'
                                : 'hover:bg-muted'
                            }`}
                          >
                            /1{unit}
                          </button>
                        ))}
                      </div>
                      <button
                        type='button'
                        onClick={() =>
                          handleModelClick(selectedCatalogModel.model_name)
                        }
                        className='bg-foreground text-background h-8 px-3 text-xs font-medium transition-opacity hover:opacity-85'
                      >
                        {t('View details')} ↗
                      </button>
                    </div>
                  </div>

                  <div className='hidden xl:block'>
                    <div className='grid grid-cols-[minmax(260px,1.5fr)_repeat(3,minmax(130px,1fr))_130px] border-b font-mono text-[9px] font-bold tracking-[0.1em] uppercase'>
                      <div className='p-5'>{t('Available Routes')}</div>
                      {['Input', 'Output', 'Cached'].map((label) => (
                        <div key={label} className='border-s p-5 text-center'>
                          {t(label)}
                          <span className='text-muted-foreground mt-1 block normal-case'>
                            {t('Per')} 1{tokenUnit} tokens
                          </span>
                        </div>
                      ))}
                      <div className='border-s p-5 text-center'>
                        {t('Status')}
                      </div>
                    </div>

                    {selectedGroupRoutes.map((route) => (
                      <div
                        key={route.group}
                        className='grid min-h-28 grid-cols-[minmax(260px,1.5fr)_repeat(3,minmax(130px,1fr))_130px] items-stretch border-b last:border-b-0'
                      >
                        <div className='flex items-center gap-3 p-5'>
                          <span className='size-2 shrink-0 bg-[var(--pricing-accent)]' />
                          <div className='min-w-0'>
                            <strong className='block text-sm capitalize'>
                              {getPricingProvider(selectedCatalogModel)} ·{' '}
                              {route.tier}
                            </strong>
                            <span className='text-muted-foreground mt-1 block text-xs'>
                              {route.description ||
                                selectedCatalogModel.description ||
                                t('No description available.')}
                            </span>
                            <div className='mt-2 flex flex-wrap items-center gap-2'>
                              <span className='border px-2 py-0.5 font-mono text-[9px] font-bold uppercase'>
                                {route.group}
                              </span>
                              <span className='text-muted-foreground font-mono text-[9px] font-bold'>
                                {route.ratio}×
                              </span>
                              {route.recommended && (
                                <span className='inline-flex bg-[var(--pricing-accent)] px-2 py-0.5 font-mono text-[9px] font-bold text-black uppercase'>
                                  {t('Recommended')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {[
                          ['input', route.input],
                          ['output', route.output],
                          ['cache', route.cache],
                        ].map(([priceKey, price]) => (
                          <div
                            key={priceKey}
                            className='flex items-center justify-center border-s p-5 text-center font-mono text-sm font-bold'
                          >
                            {price}
                          </div>
                        ))}
                        <div className='flex items-center justify-center border-s p-5 text-center'>
                          <span className='font-mono text-xs font-bold'>
                            100%
                            <span className='text-muted-foreground mt-1 block text-[9px] font-normal'>
                              {t('Ready')}
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className='xl:hidden'>
                <div className='hidden'>
                  <PricingToolbar
                    filteredCount={filteredModels.length}
                    totalCount={models?.length}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    tokenUnit={tokenUnit}
                    onTokenUnitChange={setTokenUnit}
                    showRechargePrice={showRechargePrice}
                    onRechargePriceChange={setShowRechargePrice}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    quotaTypeFilter={quotaTypeFilter}
                    endpointTypeFilter={endpointTypeFilter}
                    vendorFilter={vendorFilter}
                    groupFilter={groupFilter}
                    tagFilter={tagFilter}
                    onQuotaTypeChange={setQuotaTypeFilter}
                    onEndpointTypeChange={setEndpointTypeFilter}
                    onVendorChange={setVendorFilter}
                    onGroupChange={setGroupFilter}
                    onTagChange={setTagFilter}
                    vendors={vendors || []}
                    groups={availableGroups}
                    groupRatios={groupRatio}
                    tags={availableTags}
                    models={models || []}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onClearFilters={clearFilters}
                  />
                </div>
                <div className='p-3 sm:p-5'>{renderPricingContent()}</div>
              </div>
            </main>
          </div>

          {selectedModel && (
            <ModelDetailsDrawer
              open={Boolean(selectedModel)}
              onOpenChange={(open) => {
                if (!open) setSelectedModelName(null)
              }}
              model={selectedModel}
              groupRatio={groupRatio || {}}
              usableGroup={usableGroup || {}}
              endpointMap={
                (endpointMap as Record<
                  string,
                  { path?: string; method?: string }
                >) || {}
              }
              autoGroups={autoGroups || []}
              priceRate={priceRate ?? 1}
              usdExchangeRate={usdExchangeRate ?? 1}
              tokenUnit={tokenUnit}
              showRechargePrice={showRechargePrice}
            />
          )}
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
