import { readFileSync } from 'node:fs'
/* Copyright (C) 2023-2026 QuantumNous */
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { createRsbuild, loadConfig } from '@rsbuild/core'

const tokenFile =
  process.env.API94_TOKEN_FILE || join(homedir(), '.94api-admin.env')
const tokenLine = readFileSync(tokenFile, 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('API_ADMIN_TOKEN='))
const token = tokenLine?.slice('API_ADMIN_TOKEN='.length).trim()
if (!token) {
  throw new Error('Missing API_ADMIN_TOKEN in the local credentials file')
}
const allowed = new Set([
  '/api/status',
  '/api/pricing',
  '/api/notice',
  '/api/user/self',
  '/api/user/models',
  '/api/user/self/groups',
  '/api/user/2fa/status',
  '/api/data',
  '/api/data/self',
  '/api/data/users',
  '/api/data/flow',
  '/api/data/flow/self',
  '/api/uptime/status',
  '/api/token/',
  '/api/token/search',
  '/api/token/auto-groups',
  '/api/user/topup/info',
  '/api/user/topup/self',
  '/api/user/aff',
  '/api/subscription/plans',
  '/api/subscription/self',
  '/api/log/self',
  '/api/log/self/stat',
  '/api/log/',
  '/api/log/stat',
])
const origins = new Set(['http://127.0.0.1:4184', 'http://localhost:4184'])
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !/^(access_token|refresh_token|password|secret|api_key|key)$/i.test(
            key
          )
      )
      .map(([key, item]) => [key, sanitize(item)])
  )
}
const gateway = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  const fail = (status, message) => {
    res.writeHead(status)
    res.end(JSON.stringify({ success: false, message }))
  }
  const origin = req.headers.origin
  if (
    (origin && !origins.has(origin)) ||
    req.headers['sec-fetch-site'] === 'cross-site'
  ) {
    return fail(403, 'Local preview only')
  }
  if (req.method !== 'GET') {
    return fail(403, 'Read-only preview: changes are disabled')
  }
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname === '/api/setup') {
    return res.end(
      JSON.stringify({
        success: true,
        data: { status: true, root_init: true, database_type: 'preview' },
      })
    )
  }
  if (!allowed.has(url.pathname)) {
    return fail(403, 'This endpoint is not enabled in the read-only preview')
  }
  try {
    const response = await fetch(
      `https://94api.dev${url.pathname}${url.search}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      }
    )
    const data = sanitize(await response.json())
    res.writeHead(response.status)
    res.end(JSON.stringify(data))
  } catch {
    fail(502, 'Unable to read data from 94api.dev')
  }
})
await new Promise((resolve, reject) => {
  gateway.once('error', reject)
  gateway.listen(4185, '127.0.0.1', resolve)
})
const { content } = await loadConfig({ path: 'rsbuild.config.ts' })
content.source.entry = { index: './scripts/preview-live-entry.ts' }
content.server.port = 4184
content.server.strictPort = true
content.server.host = '127.0.0.1'
content.server.open = false
content.server.proxy = {
  '/api': { target: 'http://127.0.0.1:4185', changeOrigin: true },
}
const rsbuild = await createRsbuild({ rsbuildConfig: content })
await rsbuild.startDevServer()
console.log('Read-only 94API preview: http://127.0.0.1:4184/dashboard/overview')

