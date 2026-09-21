// bun e2e/docs-examples.ts
// Optional SDK contract checks: DOCS_SDK_DIR with openai/@anthropic-ai/sdk,
// DOCS_PYTHON with openai/anthropic installed. Only loopback HTTP is used.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'

import { GUIDE_CONTENT } from '../web/src/features/docs/guide-content'

const python = process.env.DOCS_PYTHON || 'python'
const bash = process.env.DOCS_BASH || 'bash'
const sdkDir = process.env.DOCS_SDK_DIR
const examples = Object.values(GUIDE_CONTENT).flat().flatMap(section => section.code ?? [])

function run(executable: string, args: string[], input: string, env = process.env, cwd = process.cwd()): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(executable, args, { env, cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${executable}: ${stderr || error.message}`))
      else resolve(stdout)
    })
    child.stdin?.end(input)
  })
}

const distinct = [...new Map(examples.map(code => [code.language + code.value, code])).values()]
for (const code of distinct) {
  assert(!code.value.includes('\u0000'))
  if (code.language === 'json') JSON.parse(code.value)
  if (code.language === 'toml') {
    const config = Bun.TOML.parse(code.value) as { model_provider: string; model_providers: Record<string, { env_key: string; wire_api: string; base_url: string }> }
    const provider = config.model_providers[config.model_provider]
    assert.equal(provider.env_key, 'API94_KEY')
    assert.equal(provider.wire_api, 'responses')
    assert.equal(provider.base_url, 'https://94api.dev/v1')
  }
  if (code.language === 'javascript') await run('node', ['--check', '--input-type=module'], code.value)
  if (code.language === 'python') await run(python, ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], code.value)
  if (code.language === 'bash') await run(bash, ['-n'], code.value)
  if (code.language === 'powershell') await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', '-'], `$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(code.value).toString('base64')}')); $errors=$null; $tokens=$null; $null=[System.Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors); if($errors.Count){$errors; exit 1}\n`)
}

// JSON.parse alone would silently accept duplicate translation keys.
await run(python, ['-c', `import json,sys
from pathlib import Path
def unique(pairs):
    result = {}
    for key, value in pairs:
        assert key not in result, 'Duplicate locale key: ' + key
        result[key] = value
    return result
for path in Path(sys.argv[1]).glob('*.json'):
    json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique)
print('Locale JSON keys are unique')`, resolve(import.meta.dir, '../web/src/i18n/locales')], '')
console.log(JSON.stringify({ syntax_checked: distinct.length, json_toml_bash_powershell_javascript_python: true }))

const requests: { path: string; model?: string }[] = []
const server = Bun.serve({
  hostname: '127.0.0.1', port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname
    assert.equal(request.headers.get(path === '/v1/messages' ? 'x-api-key' : 'authorization'), path === '/v1/messages' ? 'docs-lab-key' : 'Bearer docs-lab-key')
    if (path === '/v1/models') {
      assert.equal(request.method, 'GET')
      requests.push({ path })
      return Response.json({ object: 'list', data: [{ id: 'docs-lab-model', object: 'model', owned_by: 'lab' }] })
    }
    assert.equal(request.method, 'POST')
    const body = await request.json() as { model: string; messages?: { content: string }[]; input?: string; max_tokens?: number }
    assert.equal(body.model, 'docs-lab-model')
    requests.push({ path, model: body.model })
    if (path === '/v1/responses') {
      assert.equal(body.input, 'Reply with: 94API connected')
      return Response.json({ id: 'resp_lab', object: 'response', status: 'completed', model: body.model, output: [{ type: 'message', id: 'msg_lab', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '94API connected', annotations: [] }] }] })
    }
    if (path === '/v1/messages') {
      assert.equal(body.messages?.[0].content, 'Hello from 94API')
      assert.equal(body.max_tokens, 128)
      assert.equal(request.headers.get('anthropic-version'), '2023-06-01')
      return Response.json({ id: 'msg_lab', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: '94API connected' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 3 } })
    }
    assert.equal(path, '/v1/chat/completions')
    assert.equal(body.messages?.[0].content, 'Reply with: 94API connected')
    return Response.json({ id: 'chatcmpl_lab', object: 'chat.completion', created: 1, model: body.model, choices: [{ index: 0, message: { role: 'assistant', content: '94API connected' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 3, total_tokens: 4 } })
  },
})
const env = { ...process.env, API94_KEY: 'docs-lab-key', API94_MODEL: 'docs-lab-model', PYTHONDONTWRITEBYTECODE: '1', MSYS_NO_PATHCONV: '1' }
const localize = (code: string) => code.replaceAll('https://94api.dev', `http://127.0.0.1:${server.port}`)
try {
  for (const section of GUIDE_CONTENT.quickstart.filter(section => ['models', 'first-request'].includes(section.id))) {
    for (const code of section.code!) {
      const command = localize(code.value)
      const before = requests.length
      const output = code.language === 'bash'
        ? await run(bash, ['-s'], command, env)
        : await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', '-'], `$ErrorActionPreference='Stop'; & ([scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(command).toString('base64')}')))); if (-not $?) { exit 1 }\n`, env)
      assert.equal(requests.length, before + 1)
      assert.match(output, section.id === 'models' ? /docs-lab-model/ : /94API connected/)
    }
  }
  if (sdkDir) {
    for (const slug of ['openai-sdk', 'anthropic-sdk']) {
      const configured = GUIDE_CONTENT[slug].find(section => section.id === 'configure')!.code!
      const alternatives = GUIDE_CONTENT[slug].find(section => section.id === 'responses')?.code ?? []
      for (const code of [...configured, ...alternatives]) {
        let source = code.value
        if (alternatives.includes(code)) {
          const full = configured.find(item => item.language === code.language)!.value
          source = full.slice(0, full.indexOf(code.language === 'python' ? 'response = ' : 'const response = ')) + source
        }
        const before = requests.length
        const output = code.language === 'python'
          ? await run(python, ['-c', localize(source)], '', env, sdkDir)
          : await run('node', ['--input-type=module'], localize(source), env, sdkDir)
        assert.equal(requests.length, before + 1)
        assert.match(output, /94API connected/)
      }
    }
  }
  console.log(JSON.stringify({ loopback_http_examples: 4, sdk_examples: sdkDir ? 6 : 'not run; set DOCS_SDK_DIR and DOCS_PYTHON', requests: requests.length, live_inference: false }))
} finally { server.stop(true) }
