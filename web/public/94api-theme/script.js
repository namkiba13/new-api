const protocols = {
  responses: {
    endpoint: '/v1/responses',
    request: `curl -X POST "https://94api.dev/v1/responses" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "YOUR_MODEL",
    "input": "Build something remarkable."
  }'`,
    response: `{
  "status": "completed",
  "output": [{"type": "message", "role": "assistant",
    "content": [{"type": "output_text", "text": "Ready when you are."}]}]
}`,
  },
  chat: {
    endpoint: '/v1/chat/completions',
    request: `curl -X POST "https://94api.dev/v1/chat/completions" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "YOUR_MODEL",
    "messages": [{"role":"user","content":"Hello"}]
  }'`,
    response: `{
  "choices": [{"message": {"content": "Hello!"}}],
  "usage": {"total_tokens": 18}
}`,
  },
  claude: {
    endpoint: '/v1/messages',
    request: `curl -X POST "https://94api.dev/v1/messages" \\
  -H "x-api-key: $API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "YOUR_MODEL",
    "max_tokens": 1024,
    "messages": [{"role":"user","content":"Hello"}]
  }'`,
    response: `{
  "type": "message",
  "content": [{"type": "text", "text": "Hello!"}]
}`,
  },
  gemini: {
    endpoint: '/v1beta/models/{model}:generateContent',
    request: `curl -X POST "https://94api.dev/v1beta/models/YOUR_MODEL:generateContent" \\
  -H "x-goog-api-key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{"parts": [{"text": "Hello"}]}]
  }'`,
    response: `{
  "candidates": [{"content": {"parts": [{"text": "Hello!"}]}}],
  "usageMetadata": {"totalTokenCount": 16}
}`,
  },
}

const tabs = document.querySelectorAll('.protocol-tab')
const endpoint = document.querySelector('#endpoint')
const requestCode = document.querySelector('#request-code code')
const responseCode = document.querySelector('#response-code code')
const copyButton = document.querySelector('.copy-button')

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const current = protocols[tab.dataset.protocol]
    tabs.forEach((item) => {
      const selected = item === tab
      item.classList.toggle('active', selected)
      item.setAttribute('aria-selected', String(selected))
      item.tabIndex = selected ? 0 : -1
    })
    document
      .querySelector('#api-example')
      .setAttribute('aria-labelledby', tab.id)
    endpoint.textContent = current.endpoint
    requestCode.textContent = current.request
    responseCode.textContent = current.response
  })
  tab.addEventListener('keydown', (event) => {
    const index = [...tabs].indexOf(tab)
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    tabs[next].focus()
    tabs[next].click()
  })
})

copyButton.addEventListener('click', async () => {
  const active = document.querySelector('.protocol-tab.active')
  const value = protocols[active.dataset.protocol].request
  try {
    await navigator.clipboard.writeText(value)
    copyButton.textContent = window.api94Translate('Copied')
  } catch {
    const range = document.createRange()
    range.selectNodeContents(requestCode)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    copyButton.textContent = window.api94Translate('Select code')
  }
  window.setTimeout(() => {
    copyButton.textContent = window.api94Translate('Copy')
  }, 1600)
})

const menuToggle = document.querySelector('.menu-toggle')
const nav = document.querySelector('.nav')
menuToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open')
  menuToggle.setAttribute('aria-expanded', String(open))
  menuToggle.lastElementChild.textContent = open ? '−' : '+'
})
nav.querySelectorAll('a').forEach((link) =>
  link.addEventListener('click', () => {
    nav.classList.remove('open')
    menuToggle.setAttribute('aria-expanded', 'false')
    menuToggle.lastElementChild.textContent = '+'
  })
)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    menuToggle.click()
    menuToggle.focus()
  }
})

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.1 }
  )
  document.querySelectorAll('.reveal').forEach((element) => {
    element.classList.add('reveal-pending')
    observer.observe(element)
  })
}
