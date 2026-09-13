/* First-party iframe: the application owns language, theme and notifications. */
;(() => {
  const root = document.documentElement
  const params = new URLSearchParams(location.search)
  if (params.get('embedded') === '1') {
    document.querySelector('.site-header').hidden = true
  }
  const translations = window.API94_TRANSLATIONS
  let language = 'en'
  const normalize = (text) => text.replaceAll(/\s+/g, ' ').trim()
  const nodes = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (
      node.parentElement.closest(
        'script, style, pre, code, [aria-hidden="true"]'
      )
    ) {
      continue
    }
    const key = normalize(node.textContent)
    if (key && translations[key]) nodes.push({ node, key })
  }
  const attributes = []
  document.querySelectorAll('[aria-label]').forEach((node) => {
    const key = node.getAttribute('aria-label')
    if (translations[key]) attributes.push({ node, key })
  })
  window.api94Translate = (key) => translations[key]?.[language] || key
  function setLanguage(value) {
    const aliases = {
      'zh-CN': 'zhCN',
      'zh-Hans': 'zhCN',
      zh: 'zhCN',
      'zh-TW': 'zhTW',
      'zh-Hant': 'zhTW',
    }
    const code = aliases[value] || value
    if (!['en', 'vi', 'fr', 'ru', 'ja', 'zhCN', 'zhTW'].includes(code)) return
    language = code
    root.lang = { zhCN: 'zh-CN', zhTW: 'zh-TW' }[code] || code
    nodes.forEach(({ node, key }) => {
      node.textContent = ` ${window.api94Translate(key)} `
    })
    attributes.forEach(({ node, key }) => {
      node.setAttribute('aria-label', window.api94Translate(key))
    })
    document.querySelector('.copy-button').textContent =
      window.api94Translate('Copy')
    document.title = `94API — ${window.api94Translate('One endpoint.')}`
  }
  function setTheme(value) {
    if (!['light', 'dark'].includes(value)) return
    root.dataset.theme = value
    root.style.colorScheme = value
    document.querySelector('meta[name="theme-color"]').content =
      value === 'dark' ? '#1b1b22' : '#fafbf7'
  }
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== location.origin) {
      return
    }
    if (!event.data || typeof event.data !== 'object') return
    if (typeof event.data.lang === 'string') setLanguage(event.data.lang)
    if (typeof event.data.themeMode === 'string') setTheme(event.data.themeMode)
  })
  // Same-origin initial state avoids flashes before the parent's onLoad sync.
  try {
    setTheme(
      window.parent.document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
    )
    setLanguage(localStorage.getItem('i18nextLng') || 'en')
  } catch {
    setTheme('dark')
  }
})()
