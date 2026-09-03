/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { DocsGuide } from './data'

type DocsLocale = 'en' | 'vi' | 'zhCN' | 'zhTW' | 'fr' | 'ru' | 'ja'

const UI = {
  en: {
    apiDocs: '94API API Documentation',
    build: 'Build with every model.',
    oneApi: 'One clean API.',
    summary:
      'Set up API keys, SDKs, Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch, and OpenAI-compatible endpoints.',
    baseUrl: 'Base URL',
    support: 'Need help? Contact 94API support',
    setup: 'Setup guides',
    integrations: 'step-by-step integrations',
    search: 'Search guides...',
    view: 'View setup guide',
    example: 'Example model',
    protocols: 'Protocols',
    noResults: 'No setup guides found.',
    clear: 'Clear search',
    back: 'Back to docs',
    browse: 'Browse guides',
    choose: 'Choose in console',
    copyCode: 'Copy code',
    common: 'Common problems',
    symptom: 'Symptom',
    action: 'What to do',
    onPage: 'On this page',
    needHelp: 'Need help with this setup?',
    helpDetail: 'Send the error message and tool name to 94API support.',
    contact: 'Contact support',
    close: 'Close',
    copyBase: 'Copy base URL',
    key: 'Create an API key',
    install: 'Install the tool',
    configure: 'Configure 94API',
    verify: 'Verify the connection',
    profile: 'Create an 94API profile',
    activate: 'Activate and verify',
    next: 'Choose your integration',
    firstRequest: 'Send your first request',
    client: 'Create the 94API client',
    start: 'Start the tool',
  },
  vi: {
    apiDocs: 'Tài liệu API 94API',
    build: 'Xây dựng với mọi mô hình.',
    oneApi: 'Một API tinh gọn.',
    summary:
      'Cài đặt API key, SDK, Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch và các endpoint tương thích 94API.',
    baseUrl: 'URL cơ sở',
    support: 'Cần hỗ trợ? Liên hệ 94API',
    setup: 'Hướng dẫn cài đặt',
    integrations: 'tích hợp từng bước',
    search: 'Tìm hướng dẫn...',
    view: 'Xem hướng dẫn cài đặt',
    example: 'Mô hình mẫu',
    protocols: 'Giao thức',
    noResults: 'Không tìm thấy hướng dẫn.',
    clear: 'Xóa tìm kiếm',
    back: 'Quay lại tài liệu',
    browse: 'Chọn hướng dẫn',
    choose: 'Chọn trong console',
    copyCode: 'Sao chép mã',
    common: 'Lỗi thường gặp',
    symptom: 'Hiện tượng',
    action: 'Cách xử lý',
    onPage: 'Trong trang này',
    needHelp: 'Cần hỗ trợ cài đặt?',
    helpDetail: 'Gửi thông báo lỗi và tên công cụ cho bộ phận hỗ trợ 94API.',
    contact: 'Liên hệ hỗ trợ',
    close: 'Đóng',
    copyBase: 'Sao chép URL cơ sở',
    key: 'Tạo API key',
    install: 'Cài đặt công cụ',
    configure: 'Cấu hình 94API',
    verify: 'Kiểm tra kết nối',
    profile: 'Tạo hồ sơ 94API',
    activate: 'Kích hoạt và kiểm tra',
    next: 'Chọn phương thức tích hợp',
    firstRequest: 'Gửi yêu cầu đầu tiên',
    client: 'Tạo 94API client',
    start: 'Khởi động công cụ',
  },
  zhCN: {
    apiDocs: '94API API 文档',
    build: '使用每一个模型构建。',
    oneApi: '一个简洁的 API。',
    summary:
      '设置 API 密钥、SDK、Codex、Claude Code、Gemini CLI、OpenCode、CC-Switch 和 94API 兼容端点。',
    baseUrl: '基础 URL',
    support: '需要帮助？联系 94API 支持',
    setup: '设置指南',
    integrations: '分步集成',
    search: '搜索指南...',
    view: '查看设置指南',
    example: '示例模型',
    protocols: '协议',
    noResults: '未找到设置指南。',
    clear: '清除搜索',
    back: '返回文档',
    browse: '浏览指南',
    choose: '在控制台中选择',
    copyCode: '复制代码',
    common: '常见问题',
    symptom: '症状',
    action: '处理方法',
    onPage: '本页内容',
    needHelp: '需要设置帮助？',
    helpDetail: '请将错误信息和工具名称发送给 94API 支持。',
    contact: '联系支持',
    close: '关闭',
    copyBase: '复制基础 URL',
    key: '创建 API 密钥',
    install: '安装工具',
    configure: '配置 94API',
    verify: '验证连接',
    profile: '创建 94API 配置',
    activate: '启用并验证',
    next: '选择集成方式',
    firstRequest: '发送第一个请求',
    client: '创建 94API 客户端',
    start: '启动工具',
  },
  zhTW: {
    apiDocs: '94API API 文件',
    build: '使用每一個模型建構。',
    oneApi: '一個簡潔的 API。',
    summary:
      '設定 API 金鑰、SDK、Codex、Claude Code、Gemini CLI、OpenCode、CC-Switch 與 94API 相容端點。',
    baseUrl: '基礎 URL',
    support: '需要協助？聯絡 94API 支援',
    setup: '設定指南',
    integrations: '逐步整合',
    search: '搜尋指南...',
    view: '查看設定指南',
    example: '範例模型',
    protocols: '通訊協定',
    noResults: '找不到設定指南。',
    clear: '清除搜尋',
    back: '返回文件',
    browse: '瀏覽指南',
    choose: '在控制台中選擇',
    copyCode: '複製程式碼',
    common: '常見問題',
    symptom: '症狀',
    action: '處理方式',
    onPage: '本頁內容',
    needHelp: '需要設定協助？',
    helpDetail: '請將錯誤訊息與工具名稱傳送給 94API 支援。',
    contact: '聯絡支援',
    close: '關閉',
    copyBase: '複製基礎 URL',
    key: '建立 API 金鑰',
    install: '安裝工具',
    configure: '設定 94API',
    verify: '驗證連線',
    profile: '建立 94API 設定檔',
    activate: '啟用並驗證',
    next: '選擇整合方式',
    firstRequest: '傳送第一個請求',
    client: '建立 94API 用戶端',
    start: '啟動工具',
  },
  fr: {
    apiDocs: "Documentation de l'API 94API",
    build: 'Construisez avec tous les modèles.',
    oneApi: 'Une API claire et unique.',
    summary:
      'Configurez les clés API, SDK, Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch et les endpoints compatibles 94API.',
    baseUrl: 'URL de base',
    support: "Besoin d'aide ? Contactez 94API",
    setup: "Guides d'installation",
    integrations: 'intégrations pas à pas',
    search: 'Rechercher un guide...',
    view: "Voir le guide d'installation",
    example: 'Modèle exemple',
    protocols: 'Protocoles',
    noResults: 'Aucun guide trouvé.',
    clear: 'Effacer la recherche',
    back: 'Retour aux docs',
    browse: 'Parcourir les guides',
    choose: 'Choisir dans la console',
    copyCode: 'Copier le code',
    common: 'Problèmes courants',
    symptom: 'Symptôme',
    action: 'Solution',
    onPage: 'Sur cette page',
    needHelp: "Besoin d'aide pour cette installation ?",
    helpDetail:
      "Envoyez le message d'erreur et le nom de l'outil au support 94API.",
    contact: 'Contacter le support',
    close: 'Fermer',
    copyBase: "Copier l'URL de base",
    key: 'Créer une clé API',
    install: "Installer l'outil",
    configure: 'Configurer 94API',
    verify: 'Vérifier la connexion',
    profile: 'Créer un profil 94API',
    activate: 'Activer et vérifier',
    next: "Choisir l'intégration",
    firstRequest: 'Envoyer la première requête',
    client: 'Créer le client 94API',
    start: "Démarrer l'outil",
  },
  ru: {
    apiDocs: 'Документация API 94API',
    build: 'Работайте с любой моделью.',
    oneApi: 'Один понятный API.',
    summary:
      'Настройте API-ключи, SDK, Codex, Claude Code, Gemini CLI, OpenCode, CC-Switch и совместимые с 94API эндпоинты.',
    baseUrl: 'Базовый URL',
    support: 'Нужна помощь? Свяжитесь с 94API',
    setup: 'Руководства по настройке',
    integrations: 'пошаговых интеграций',
    search: 'Поиск руководств...',
    view: 'Открыть руководство',
    example: 'Пример модели',
    protocols: 'Протоколы',
    noResults: 'Руководства не найдены.',
    clear: 'Очистить поиск',
    back: 'Назад к документации',
    browse: 'Выбрать руководство',
    choose: 'Выберите в консоли',
    copyCode: 'Копировать код',
    common: 'Частые проблемы',
    symptom: 'Симптом',
    action: 'Что делать',
    onPage: 'На этой странице',
    needHelp: 'Нужна помощь с настройкой?',
    helpDetail:
      'Отправьте сообщение об ошибке и название инструмента в поддержку 94API.',
    contact: 'Связаться с поддержкой',
    close: 'Закрыть',
    copyBase: 'Копировать базовый URL',
    key: 'Создать API-ключ',
    install: 'Установить инструмент',
    configure: 'Настроить 94API',
    verify: 'Проверить подключение',
    profile: 'Создать профиль 94API',
    activate: 'Активировать и проверить',
    next: 'Выбрать интеграцию',
    firstRequest: 'Отправить первый запрос',
    client: 'Создать клиент 94API',
    start: 'Запустить инструмент',
  },
  ja: {
    apiDocs: '94API APIドキュメント',
    build: 'すべてのモデルで構築。',
    oneApi: 'ひとつのクリーンなAPI。',
    summary:
      'APIキー、SDK、Codex、Claude Code、Gemini CLI、OpenCode、CC-Switch、94API互換エンドポイントを設定します。',
    baseUrl: 'ベースURL',
    support: 'お困りですか？94APIサポートへ',
    setup: 'セットアップガイド',
    integrations: 'ステップ別インテグレーション',
    search: 'ガイドを検索...',
    view: 'セットアップガイドを見る',
    example: 'モデル例',
    protocols: 'プロトコル',
    noResults: 'ガイドが見つかりません。',
    clear: '検索をクリア',
    back: 'ドキュメントに戻る',
    browse: 'ガイドを選ぶ',
    choose: 'コンソールで選択',
    copyCode: 'コードをコピー',
    common: 'よくある問題',
    symptom: '症状',
    action: '対処方法',
    onPage: 'このページの内容',
    needHelp: 'セットアップにお困りですか？',
    helpDetail: 'エラー内容とツール名を94APIサポートへ送信してください。',
    contact: 'サポートに連絡',
    close: '閉じる',
    copyBase: 'ベースURLをコピー',
    key: 'APIキーを作成',
    install: 'ツールをインストール',
    configure: '94APIを設定',
    verify: '接続を確認',
    profile: '94APIプロファイルを作成',
    activate: '有効化して確認',
    next: '連携方法を選択',
    firstRequest: '最初のリクエストを送信',
    client: '94APIクライアントを作成',
    start: 'ツールを起動',
  },
} as const

const GUIDE_TITLES: Record<DocsLocale, Record<string, [string, string]>> = {
  en: {},
  vi: {
    quickstart: [
      'Khởi động nhanh 94API',
      'Tạo API key, gửi yêu cầu đầu tiên và kết nối ứng dụng tương thích OpenAI với 94API.',
    ],
    codex: [
      'Khởi động nhanh Codex',
      'Cài đặt Codex trên Windows, macOS hoặc Linux và kết nối qua cấu hình nhà cung cấp 94API.',
    ],
    'claude-code': [
      'Khởi động nhanh Claude Code',
      'Cấu hình Claude Code bằng API key 94API, tên model Claude và endpoint Anthropic.',
    ],
    'gemini-cli': [
      'Khởi động nhanh Gemini CLI',
      'Cài đặt Gemini CLI, cấu hình endpoint Gemini của 94API và kiểm tra kết nối.',
    ],
    'openai-sdk': [
      'Cài đặt OpenAI SDK',
      'Sử dụng thư viện OpenAI chính thức với 94API cho Chat Completions và Responses API.',
    ],
    'anthropic-sdk': [
      'Cài đặt Anthropic SDK',
      'Kết nối thư viện Anthropic chính thức với 94API và giữ nguyên định dạng Messages API.',
    ],
    'cc-switch': [
      'Cài đặt CC-Switch',
      'Tạo và chuyển đổi hồ sơ 94API cho Codex, Claude Code, Gemini CLI và các công cụ lập trình khác.',
    ],
    opencode: [
      'Cài đặt OpenCode',
      'Kết nối OpenCode với 94API như một nhà cung cấp tùy chỉnh và chuyển đổi model khả dụng.',
    ],
  },
  zhCN: {
    quickstart: [
      '94API 快速入门',
      '创建 API 密钥、发送第一个请求，并将 OpenAI 兼容应用连接到 94API。',
    ],
    codex: [
      'Codex 快速入门',
      '在 Windows、macOS 或 Linux 上安装 Codex，并通过 94API 提供商配置进行连接。',
    ],
    'claude-code': [
      'Claude Code 快速入门',
      '使用 94API 密钥、Claude 模型名称和 Anthropic 端点配置 Claude Code。',
    ],
    'gemini-cli': [
      'Gemini CLI 快速入门',
      '安装 Gemini CLI，配置 94API Gemini 端点并验证连接。',
    ],
    'openai-sdk': [
      'OpenAI SDK 设置',
      '使用官方 OpenAI 客户端库通过 94API 调用 Chat Completions 和 Responses API。',
    ],
    'anthropic-sdk': [
      'Anthropic SDK 设置',
      '将官方 Anthropic 库连接到 94API，同时保留原生 Messages API 格式。',
    ],
    'cc-switch': [
      'CC-Switch 设置',
      '为 Codex、Claude Code、Gemini CLI 和其他编码工具创建并切换 94API 配置。',
    ],
    opencode: [
      'OpenCode 设置',
      '将 OpenCode 作为自定义提供商连接到 94API，并切换可用模型。',
    ],
  },
  zhTW: {
    quickstart: [
      '94API 快速入門',
      '建立 API 金鑰、傳送第一個請求，並將 OpenAI 相容應用程式連接到 94API。',
    ],
    codex: [
      'Codex 快速入門',
      '在 Windows、macOS 或 Linux 安裝 Codex，並透過 94API 供應商設定連線。',
    ],
    'claude-code': [
      'Claude Code 快速入門',
      '使用 94API 金鑰、Claude 模型名稱與 Anthropic 端點設定 Claude Code。',
    ],
    'gemini-cli': [
      'Gemini CLI 快速入門',
      '安裝 Gemini CLI、設定 94API Gemini 端點並驗證連線。',
    ],
    'openai-sdk': [
      'OpenAI SDK 設定',
      '使用官方 OpenAI 用戶端程式庫透過 94API 呼叫 Chat Completions 與 Responses API。',
    ],
    'anthropic-sdk': [
      'Anthropic SDK 設定',
      '將官方 Anthropic 程式庫連接至 94API，並保留原生 Messages API 格式。',
    ],
    'cc-switch': [
      'CC-Switch 設定',
      '為 Codex、Claude Code、Gemini CLI 與其他程式設計工具建立及切換 94API 設定檔。',
    ],
    opencode: [
      'OpenCode 設定',
      '將 OpenCode 作為自訂供應商連接至 94API，並切換可用模型。',
    ],
  },
  fr: {
    quickstart: [
      'Démarrage rapide 94API',
      'Créez une clé API, envoyez votre première requête et connectez toute application compatible OpenAI.',
    ],
    codex: [
      'Démarrage rapide Codex',
      'Installez Codex sur Windows, macOS ou Linux et connectez-le avec la configuration fournisseur 94API.',
    ],
    'claude-code': [
      'Démarrage rapide Claude Code',
      "Configurez Claude Code avec une clé 94API, un modèle Claude et l'endpoint Anthropic.",
    ],
    'gemini-cli': [
      'Démarrage rapide Gemini CLI',
      "Installez Gemini CLI, configurez l'endpoint Gemini 94API et vérifiez la connexion.",
    ],
    'openai-sdk': [
      'Configuration du SDK OpenAI',
      'Utilisez les bibliothèques OpenAI officielles avec 94API pour Chat Completions et Responses API.',
    ],
    'anthropic-sdk': [
      'Configuration du SDK Anthropic',
      "Connectez les bibliothèques Anthropic officielles à 94API en conservant le format natif de l'API Messages.",
    ],
    'cc-switch': [
      'Configuration de CC-Switch',
      'Créez et changez de profil 94API pour Codex, Claude Code, Gemini CLI et les autres outils.',
    ],
    opencode: [
      'Configuration OpenCode',
      'Connectez OpenCode à 94API comme fournisseur personnalisé et changez de modèle.',
    ],
  },
  ru: {
    quickstart: [
      'Быстрый старт 94API',
      'Создайте API-ключ, отправьте первый запрос и подключите OpenAI-совместимое приложение к 94API.',
    ],
    codex: [
      'Быстрый старт Codex',
      'Установите Codex в Windows, macOS или Linux и подключите его через провайдер 94API.',
    ],
    'claude-code': [
      'Быстрый старт Claude Code',
      'Настройте Claude Code с ключом 94API, моделью Claude и эндпоинтом Anthropic.',
    ],
    'gemini-cli': [
      'Быстрый старт Gemini CLI',
      'Установите Gemini CLI, настройте эндпоинт 94API Gemini и проверьте подключение.',
    ],
    'openai-sdk': [
      'Настройка OpenAI SDK',
      'Используйте официальные библиотеки OpenAI с 94API для Chat Completions и Responses API.',
    ],
    'anthropic-sdk': [
      'Настройка Anthropic SDK',
      'Подключите официальные библиотеки Anthropic к 94API, сохраняя нативный формат Messages API.',
    ],
    'cc-switch': [
      'Настройка CC-Switch',
      'Создавайте и переключайте профили 94API для Codex, Claude Code, Gemini CLI и других инструментов.',
    ],
    opencode: [
      'Настройка OpenCode',
      'Подключите OpenCode к 94API как пользовательский провайдер и переключайте модели.',
    ],
  },
  ja: {
    quickstart: [
      '94APIクイックスタート',
      'APIキーを作成し、最初のリクエストを送信してOpenAI互換アプリを94APIへ接続します。',
    ],
    codex: [
      'Codexクイックスタート',
      'Windows、macOS、LinuxにCodexをインストールし、94APIプロバイダー設定で接続します。',
    ],
    'claude-code': [
      'Claude Codeクイックスタート',
      '94APIキー、Claudeモデル名、Anthropicエンドポイントを使ってClaude Codeを設定します。',
    ],
    'gemini-cli': [
      'Gemini CLIクイックスタート',
      'Gemini CLIをインストールし、94API Geminiエンドポイントを設定して接続を確認します。',
    ],
    'openai-sdk': [
      'OpenAI SDKセットアップ',
      '公式OpenAIライブラリを94API経由でChat CompletionsとResponses APIに使用します。',
    ],
    'anthropic-sdk': [
      'Anthropic SDKセットアップ',
      'ネイティブMessages API形式を保ったまま公式Anthropicライブラリを94APIへ接続します。',
    ],
    'cc-switch': [
      'CC-Switchセットアップ',
      'Codex、Claude Code、Gemini CLIなどの94APIプロファイルを作成・切り替えします。',
    ],
    opencode: [
      'OpenCodeセットアップ',
      'OpenCodeをカスタムプロバイダーとして94APIへ接続し、モデルを切り替えます。',
    ],
  },
}

function localeOf(language: string): DocsLocale {
  if (language.startsWith('vi')) return 'vi'
  if (language === 'zh-TW' || language === 'zhTW') return 'zhTW'
  if (language.startsWith('zh')) return 'zhCN'
  if (language.startsWith('fr')) return 'fr'
  if (language.startsWith('ru')) return 'ru'
  if (language.startsWith('ja')) return 'ja'
  return 'en'
}

export type DocsUiKey = keyof typeof UI.en

export function docsUi(language: string, key: DocsUiKey) {
  return UI[localeOf(language)][key]
}

export function docsGuideTitle(language: string, guide: DocsGuide) {
  return GUIDE_TITLES[localeOf(language)][guide.slug]?.[0] || guide.title
}

export function docsGuideDescription(language: string, guide: DocsGuide) {
  return GUIDE_TITLES[localeOf(language)][guide.slug]?.[1] || guide.description
}

export function docsSectionTitle(
  language: string,
  id: string,
  fallback: string
) {
  const locale = localeOf(language)
  if (locale === 'en') return fallback
  const prefix = fallback.match(/^\d+\./)?.[0] || ''
  const sectionKeys: Record<string, DocsUiKey> = {
    'create-key': 'key',
    install: 'install',
    configure: 'configure',
    verify: 'verify',
    profile: 'profile',
    switch: 'activate',
    next: 'next',
    'first-request': 'firstRequest',
    client: 'client',
    start: 'start',
  }
  const key = sectionKeys[id] || 'configure'
  return `${prefix} ${docsUi(language, key)}`.trim()
}

export function docsSectionParagraphs(
  language: string,
  guide: DocsGuide,
  sectionId: string
) {
  const locale = localeOf(language)
  if (locale === 'en') return null
  const tool = docsGuideTitle(language, guide)
  const model = guide.model || 'model'
  const copy = {
    vi: {
      key: `Tạo API key 94API có quyền truy cập ${model}. Sao chép và lưu key ở nơi an toàn.`,
      install: `Cài đặt ${tool} bằng lệnh dành cho hệ điều hành của bạn, sau đó mở terminal mới để kiểm tra phiên bản.`,
      configure: `Cấu hình ${tool} sử dụng URL ${guide.baseUrl}, API key 94API và tên model ${model}.`,
      verify: `Khởi động lại ${tool}, gửi một yêu cầu ngắn và xác nhận không còn lỗi xác thực hoặc không tìm thấy model.`,
      other: `Thực hiện các bước hiển thị bên dưới theo đúng thứ tự. Giữ nguyên URL, biến môi trường và tên model trong khối mã.`,
    },
    zhCN: {
      key: `创建可访问 ${model} 的 94API API 密钥，并将其安全保存。`,
      install: `使用适合您操作系统的命令安装 ${tool}，然后打开新终端检查版本。`,
      configure: `配置 ${tool} 使用 ${guide.baseUrl}、94API API 密钥和模型名称 ${model}。`,
      verify: `重新启动 ${tool}，发送一个简短请求，并确认没有身份验证或模型未找到错误。`,
      other:
        '按顺序完成以下步骤。请保持代码块中的 URL、环境变量和模型名称不变。',
    },
    zhTW: {
      key: `建立可存取 ${model} 的 94API API 金鑰，並安全保存。`,
      install: `使用適合您作業系統的命令安裝 ${tool}，然後開啟新終端機檢查版本。`,
      configure: `設定 ${tool} 使用 ${guide.baseUrl}、94API API 金鑰與模型名稱 ${model}。`,
      verify: `重新啟動 ${tool}、傳送簡短請求，並確認沒有驗證或找不到模型的錯誤。`,
      other:
        '依序完成以下步驟。請保持程式碼區塊中的 URL、環境變數與模型名稱不變。',
    },
    fr: {
      key: `Créez une clé API 94API donnant accès à ${model} et conservez-la en lieu sûr.`,
      install: `Installez ${tool} avec la commande adaptée à votre système, puis ouvrez un nouveau terminal pour vérifier la version.`,
      configure: `Configurez ${tool} avec ${guide.baseUrl}, votre clé 94API et le modèle ${model}.`,
      verify: `Redémarrez ${tool}, envoyez une courte requête et vérifiez l'absence d'erreur d'authentification ou de modèle.`,
      other:
        "Suivez les étapes ci-dessous dans l'ordre. Conservez les URL, variables et noms de modèles des blocs de code.",
    },
    ru: {
      key: `Создайте ключ 94API с доступом к ${model} и сохраните его в безопасном месте.`,
      install: `Установите ${tool} командой для вашей ОС, затем откройте новый терминал и проверьте версию.`,
      configure: `Настройте ${tool} с URL ${guide.baseUrl}, ключом 94API и моделью ${model}.`,
      verify: `Перезапустите ${tool}, отправьте короткий запрос и убедитесь, что ошибок авторизации или модели нет.`,
      other:
        'Выполняйте шаги по порядку. Не изменяйте URL, переменные окружения и имена моделей в блоках кода.',
    },
    ja: {
      key: `${model}へアクセスできる94API APIキーを作成し、安全に保管してください。`,
      install: `OSに合ったコマンドで${tool}をインストールし、新しいターミナルでバージョンを確認します。`,
      configure: `${tool}に${guide.baseUrl}、94API APIキー、モデル名${model}を設定します。`,
      verify: `${tool}を再起動して短いリクエストを送り、認証エラーやモデル未検出エラーがないことを確認します。`,
      other:
        '以下の手順を順番に実行してください。コード内のURL、環境変数、モデル名はそのまま使用します。',
    },
  } as const
  const selected = copy[locale]
  if (sectionId === 'create-key') return [selected.key]
  if (sectionId === 'install') return [selected.install]
  if (sectionId === 'configure' || sectionId === 'profile') {
    return [selected.configure]
  }
  if (
    sectionId === 'verify' ||
    sectionId === 'switch' ||
    sectionId === 'start'
  ) {
    return [selected.verify]
  }
  return [selected.other]
}
