/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
export type GuideCode = {
  label: string
  language: string
  value: string
}

export type GuideSection = {
  id: string
  title: string
  paragraphs: string[]
  code?: GuideCode[]
  note?: string
}

const account: GuideSection = {
  id: 'account',
  title: 'Prepare your account and key',
  paragraphs: [
    'Sign in, check your wallet balance, then open API Keys and select Create API Key. Creating a key does not add funds.',
    'At the 20 September 2026 review, enabled channels used stable; default and low had no enabled channels. Select stable explicitly and check the current catalog before choosing another group.',
    'Use an exact model ID available to your key and the required API format. A model name, protocol compatibility and support for every client feature are different things.',
    'To add funds, use a method currently offered in your wallet or contact support@94api.dev. This guide does not assume online checkout is enabled.',
  ],
  note: 'Keep API keys out of browser-side code, public repositories, screenshots and support messages.',
}

const environment: GuideSection = {
  id: 'environment',
  title: 'Set the key and model',
  paragraphs: [
    'Replace YOUR_94API_KEY with your 94API key and YOUR_MODEL_ID with the exact model ID you selected. These are placeholders, not working credentials or model names.',
    'Run the commands for your shell. Environment variables apply to this terminal and programs launched from it; start the client from the same terminal.',
  ],
  code: [
    {
      label: 'Bash / Zsh',
      language: 'bash',
      value: `export API94_KEY='YOUR_94API_KEY'
export API94_MODEL='YOUR_MODEL_ID'`,
    },
    {
      label: 'Windows PowerShell',
      language: 'powershell',
      value: `$env:API94_KEY = 'YOUR_94API_KEY'
$env:API94_MODEL = 'YOUR_MODEL_ID'`,
    },
  ],
}

const verify: GuideSection = {
  id: 'verify',
  title: 'Verify the request',
  paragraphs: [
    'Send a short prompt, then inspect Usage Logs in 94API. Match the time, key, model, group and charged usage; do not rely on the model describing its own identity.',
    'A successful text request does not verify streaming, tool calls, images or every client feature. Test each feature you intend to use.',
  ],
  note: 'Inference requests can consume paid balance. An HTTP 200 response from /api/status or a model listing is not a successful inference test.',
}

const responsesRequirement =
  'Codex requires the Responses API. Confirm that your selected 94API model and route support /v1/responses; a successful Chat Completions request alone is not enough.'

export const GUIDE_TROUBLESHOOTING = [
  [
    '401 / Unauthorized',
    'Check that the complete 94API key is loaded, enabled and not expired. Check the authentication header before replacing a key.',
  ],
  [
    '403 / model_not_found',
    'Check key permissions, its group and the exact model ID. The selected group may have no available channel; contact support if the catalog and routing disagree.',
  ],
  [
    'Insufficient quota / 429',
    'Read the returned error: check account balance, key quota and request limits. For rate limiting, reduce concurrency and wait before retrying.',
  ],
  [
    'Connection timeout',
    'Check the endpoint, network and returned error. Verify the configured API format and avoid duplicating /v1; a timeout can also come from the upstream service.',
  ],
] as const

export const GUIDE_CONTENT: Record<string, GuideSection[]> = {
  quickstart: [
    account,
    environment,
    {
      id: 'models',
      title: 'Check the current model list',
      paragraphs: [
        'Models & pricing lists the current catalog. GET /v1/models checks which model IDs are visible to this key; it does not generate an answer.',
        'gpt-5.5 was listed in stable on 20 September 2026. It is an example, not a permanent default. Update API94_MODEL to a currently accessible ID.',
      ],
      code: [
        {
          label: 'Bash / Zsh',
          language: 'bash',
          value: `curl --show-error --include 'https://94api.dev/v1/models' \\
  -H "Authorization: Bearer $API94_KEY"`,
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: `$headers = @{ Authorization = "Bearer $env:API94_KEY" }
(Invoke-RestMethod -Uri 'https://94api.dev/v1/models' -Headers $headers).data`,
        },
      ],
    },
    {
      id: 'first-request',
      title: 'Send a Chat Completions request',
      paragraphs: [
        'The SDK base URL is https://94api.dev/v1. This raw HTTP example posts to https://94api.dev/v1/chat/completions and reads the variables set above.',
        'Check the HTTP status and response body. A successful chat response contains choices and message content; report the actual error and request ID if it fails.',
      ],
      code: [
        {
          label: 'Bash / Zsh',
          language: 'bash',
          value: String.raw`curl --show-error --include 'https://94api.dev/v1/chat/completions' \
  -H "Authorization: Bearer $API94_KEY" \
  -H 'Content-Type: application/json' \
  --data "{\"model\":\"$API94_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with: 94API connected\"}]}"`,
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: `$headers = @{ Authorization = "Bearer $env:API94_KEY" }
$body = @{
  model = $env:API94_MODEL
  messages = @(@{ role = 'user'; content = 'Reply with: 94API connected' })
} | ConvertTo-Json -Depth 4
$response = Invoke-RestMethod -Method Post \`
  -Uri 'https://94api.dev/v1/chat/completions' \`
  -Headers $headers -ContentType 'application/json; charset=utf-8' \`
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
$response.choices[0].message.content`,
        },
      ],
    },
    verify,
  ],
  codex: [
    account,
    {
      id: 'requirements',
      title: 'Confirm client requirements',
      paragraphs: [responsesRequirement],
      note: 'This is a documentation-based configuration reference. End-to-end Codex compatibility with 94API has not been established by this guide.',
    },
    {
      id: 'install',
      title: 'Install the client',
      paragraphs: [
        'Install Codex from its official instructions. With a supported Node.js installation, the npm method below works in Bash and PowerShell. Record the installed version.',
      ],
      code: [
        {
          label: 'Bash / PowerShell',
          language: 'shell',
          value: 'npm install -g @openai/codex\ncodex --version',
        },
      ],
    },
    environment,
    {
      id: 'configure',
      title: 'Configure the provider',
      paragraphs: [
        'Merge this configuration into the user-level ~/.codex/config.toml, or $HOME\\.codex\\config.toml in PowerShell. If CODEX_HOME is set, use its config.toml instead. Preserve unrelated settings.',
        'The provider ID api94 must match in model_provider and the table name. env_key reads API94_KEY; the launch command below selects API94_MODEL. No ChatGPT login is required for this custom-provider credential.',
      ],
      code: [
        {
          label: 'config.toml',
          language: 'toml',
          value: `model_provider = "api94"

[model_providers.api94]
name = "94API"
base_url = "https://94api.dev/v1"
env_key = "API94_KEY"
wire_api = "responses"`,
        },
      ],
      note: 'Current Codex documentation places provider settings in user configuration, not project-local .codex/config.toml. This example makes no data-retention or context-window guarantee.',
    },
    {
      id: 'start',
      title: 'Start the client',
      paragraphs: [
        'Open a terminal in the project you intend to use. Start Codex with the model whose Responses support you confirmed.',
      ],
      code: [
        {
          label: 'Bash / Zsh',
          language: 'bash',
          value: 'codex --model "$API94_MODEL"',
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: 'codex --model $env:API94_MODEL',
        },
      ],
    },
    verify,
  ],
  'claude-code': [
    account,
    {
      id: 'requirements',
      title: 'Confirm client requirements',
      paragraphs: [
        'The reviewed 94API catalog contained GPT model IDs, not a listed Claude model. Messages-format conversion is not proof of Claude model availability or full Claude Code compatibility.',
        'Anthropic documents gateway routing for Claude Code but does not support routing it to non-Claude models. Confirm a suitable model and client version with 94API support before using this configuration.',
      ],
    },
    {
      id: 'install',
      title: 'Install the client',
      paragraphs: [
        'Use the official Claude Code installer for your operating system, then check the installed version.',
      ],
      code: [
        {
          label: 'Bash / Zsh',
          language: 'bash',
          value:
            'curl -fsSL https://claude.ai/install.sh | bash\nclaude --version',
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: 'irm https://claude.ai/install.ps1 | iex\nclaude --version',
        },
      ],
    },
    environment,
    {
      id: 'configure',
      title: 'Configure the gateway connection',
      paragraphs: [
        'ANTHROPIC_BASE_URL uses the origin without /v1; the client adds /v1/messages. ANTHROPIC_AUTH_TOKEN sends a Bearer credential. Launch from this terminal after confirming model support.',
      ],
      code: [
        {
          label: 'Bash / Zsh',
          language: 'bash',
          value: `export ANTHROPIC_BASE_URL="https://94api.dev"
export ANTHROPIC_AUTH_TOKEN="$API94_KEY"
claude --model "$API94_MODEL"`,
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: `$env:ANTHROPIC_BASE_URL = 'https://94api.dev'
$env:ANTHROPIC_AUTH_TOKEN = $env:API94_KEY
claude --model $env:API94_MODEL`,
        },
      ],
    },
    {
      id: 'status',
      title: 'Check the active connection',
      paragraphs: [
        'Run /status in Claude Code. Confirm the Anthropic base URL and credential source refer to this gateway rather than an existing claude.ai login. A model describing itself is not connection verification.',
      ],
    },
    verify,
  ],
  'gemini-cli': [
    account,
    {
      id: 'requirements',
      title: 'Confirm client requirements',
      paragraphs: [
        'The reviewed 94API catalog did not list a Gemini model. A Gemini-format endpoint does not establish Gemini CLI compatibility. Confirm the model and required client features before using this reference.',
        'Gemini CLI supports a custom base URL, but authentication behavior differs by version. Choosing the main model does not override subagent or other auxiliary models.',
      ],
    },
    {
      id: 'install',
      title: 'Install the client',
      paragraphs: [
        'Follow the official Gemini CLI installation and runtime requirements. Check the installed version before choosing matching authentication instructions.',
      ],
      code: [
        {
          label: 'Bash / PowerShell',
          language: 'shell',
          value: 'npm install -g @google/gemini-cli\ngemini --version',
        },
      ],
    },
    environment,
    {
      id: 'configure',
      title: 'Configure the gateway connection',
      paragraphs: [
        'Set GOOGLE_GEMINI_BASE_URL to https://94api.dev, not the OpenAI /v1 base. Set GEMINI_API_KEY from API94_KEY and select the confirmed model explicitly.',
        'Use /auth to check the active authentication method. Follow the API-key or gateway setup documented for your installed version; an existing Google-login session is not proof that the 94API key is active.',
      ],
      code: [
        {
          label: 'Bash / Zsh',
          language: 'bash',
          value: `export GEMINI_API_KEY="$API94_KEY"
export GOOGLE_GEMINI_BASE_URL="https://94api.dev"
gemini --model "$API94_MODEL"`,
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: `$env:GEMINI_API_KEY = $env:API94_KEY
$env:GOOGLE_GEMINI_BASE_URL = 'https://94api.dev'
gemini --model $env:API94_MODEL`,
        },
      ],
    },
    verify,
  ],
  'openai-sdk': [
    account,
    {
      id: 'install',
      title: 'Install an SDK in your project',
      paragraphs: [
        'Use Node.js 22 or later for these JavaScript examples, or Python 3.10 or later for Python. Choose one SDK; the Python commands create an isolated .venv in your project.',
      ],
      code: [
        { label: 'Node.js', language: 'shell', value: 'npm install openai' },
        {
          label: 'Python — Bash / Zsh',
          language: 'bash',
          value:
            'python3 -m venv .venv\n.venv/bin/python -m pip install openai',
        },
        {
          label: 'Python — PowerShell',
          language: 'powershell',
          value:
            'py -m venv .venv\n.\\.venv\\Scripts\\python.exe -m pip install openai',
        },
      ],
    },
    environment,
    {
      id: 'configure',
      title: 'Create the SDK client',
      paragraphs: [
        'Save the JavaScript example as example.mjs or the Python example as example.py. Both use API94_KEY and API94_MODEL from the environment and the OpenAI-compatible /v1 base.',
      ],
      code: [
        {
          label: 'example.mjs',
          language: 'javascript',
          value: `import OpenAI from "openai";

if (!process.env.API94_KEY || !process.env.API94_MODEL) {
  throw new Error("Set API94_KEY and API94_MODEL first");
}
const client = new OpenAI({
  apiKey: process.env.API94_KEY,
  baseURL: "https://94api.dev/v1",
});

const response = await client.chat.completions.create({
  model: process.env.API94_MODEL,
  messages: [{ role: "user", content: "Reply with: 94API connected" }],
});

console.log(response.choices[0].message.content);`,
        },
        {
          label: 'example.py',
          language: 'python',
          value: `import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["API94_KEY"],
    base_url="https://94api.dev/v1",
)

response = client.chat.completions.create(
    model=os.environ["API94_MODEL"],
    messages=[{"role": "user", "content": "Reply with: 94API connected"}],
)

print(response.choices[0].message.content)`,
        },
      ],
    },
    {
      id: 'run',
      title: 'Run the saved example',
      paragraphs: [
        'Run the command matching your SDK from the folder containing the saved file, in the terminal where you set the environment variables.',
      ],
      code: [
        { label: 'Node.js', language: 'shell', value: 'node example.mjs' },
        {
          label: 'Python — Bash / Zsh',
          language: 'bash',
          value: '.venv/bin/python example.py',
        },
        {
          label: 'Python — PowerShell',
          language: 'powershell',
          value: '.\\.venv\\Scripts\\python.exe example.py',
        },
      ],
    },
    {
      id: 'responses',
      title: 'Responses API alternative',
      paragraphs: [
        'Only use this alternative after confirming Responses support for your selected model and route. In the saved example, replace the request and print statements below the client initialization with the matching block.',
      ],
      code: [
        {
          label: 'JavaScript',
          language: 'javascript',
          value: `const response = await client.responses.create({
  model: process.env.API94_MODEL,
  input: "Reply with: 94API connected",
});
console.log(response.output_text);`,
        },
        {
          label: 'Python',
          language: 'python',
          value: `response = client.responses.create(
    model=os.environ["API94_MODEL"],
    input="Reply with: 94API connected",
)
print(response.output_text)`,
        },
      ],
    },
    verify,
  ],
  'anthropic-sdk': [
    account,
    {
      id: 'requirements',
      title: 'Confirm client requirements',
      paragraphs: [
        'This example uses the client-facing Messages format. Confirm a model and route supporting /v1/messages before running it. Format conversion does not mean the upstream model is Claude or that every Anthropic feature is preserved.',
      ],
    },
    {
      id: 'install',
      title: 'Install an SDK in your project',
      paragraphs: [
        'Use Node.js 22 or later for these JavaScript examples, or Python 3.10 or later for Python. Choose one SDK; the Python commands create an isolated .venv in your project.',
      ],
      code: [
        {
          label: 'Node.js',
          language: 'shell',
          value: 'npm install @anthropic-ai/sdk',
        },
        {
          label: 'Python — Bash / Zsh',
          language: 'bash',
          value:
            'python3 -m venv .venv\n.venv/bin/python -m pip install anthropic',
        },
        {
          label: 'Python — PowerShell',
          language: 'powershell',
          value:
            'py -m venv .venv\n.\\.venv\\Scripts\\python.exe -m pip install anthropic',
        },
      ],
    },
    environment,
    {
      id: 'configure',
      title: 'Create the SDK client',
      paragraphs: [
        'Save the JavaScript example as example.mjs or the Python example as example.py. The Anthropic SDK base is https://94api.dev; the SDK adds /v1/messages and sends the key in x-api-key.',
      ],
      code: [
        {
          label: 'example.mjs',
          language: 'javascript',
          value: `import Anthropic from "@anthropic-ai/sdk";

if (!process.env.API94_KEY || !process.env.API94_MODEL) {
  throw new Error("Set API94_KEY and API94_MODEL first");
}
const client = new Anthropic({
  apiKey: process.env.API94_KEY,
  baseURL: "https://94api.dev",
});

const message = await client.messages.create({
  model: process.env.API94_MODEL,
  max_tokens: 128,
  messages: [{ role: "user", content: "Hello from 94API" }],
});
console.log(message.content);`,
        },
        {
          label: 'example.py',
          language: 'python',
          value: `import os
from anthropic import Anthropic

client = Anthropic(
    api_key=os.environ["API94_KEY"],
    base_url="https://94api.dev",
)
message = client.messages.create(
    model=os.environ["API94_MODEL"],
    max_tokens=128,
    messages=[{"role": "user", "content": "Hello from 94API"}],
)
print(message.content)`,
        },
      ],
    },
    {
      id: 'run',
      title: 'Run the saved example',
      paragraphs: [
        'Run the command matching your SDK from the folder containing the saved file, in the terminal where you set the environment variables.',
      ],
      code: [
        { label: 'Node.js', language: 'shell', value: 'node example.mjs' },
        {
          label: 'Python — Bash / Zsh',
          language: 'bash',
          value: '.venv/bin/python example.py',
        },
        {
          label: 'Python — PowerShell',
          language: 'powershell',
          value: '.\\.venv\\Scripts\\python.exe example.py',
        },
      ],
    },
    verify,
  ],
  'cc-switch': [
    account,
    {
      id: 'install',
      title: 'Install the client',
      paragraphs: [
        'Download CC Switch from ccswitch.io or the farion1231/cc-switch GitHub releases. Record its version. It manages client configuration; it does not provide model access or credit.',
      ],
    },
    {
      id: 'profile',
      title: 'Add a custom provider',
      paragraphs: [
        'Select the target application in App Switcher, click + / Add Provider, and choose Custom. Use 94API as the display name and enter your key in the credential field.',
        'For OpenCode, choose OpenAI Compatible for Chat Completions or OpenAI Responses only for a confirmed Responses route. Both use https://94api.dev/v1. Add the exact model ID; do not invent context or output limits.',
        'For Codex, use a confirmed Responses route and inspect the generated Config TOML and Auth JSON. CC Switch file-managed authentication and the standalone env_key recipe are different methods; do not mix them blindly.',
        'Fetch Models can discover IDs, but it does not test inference. Optional local routing requires the CC Switch proxy to remain running and is not required by this guide.',
      ],
    },
    {
      id: 'switch',
      title: 'Apply the configuration',
      paragraphs: [
        'For Codex, enable the provider. For OpenCode, add the provider to its configuration, then choose its model in OpenCode. Exact button labels depend on the CC Switch version.',
        'Restart the target client from the intended environment and inspect its active provider. Existing environment variables or another configuration manager can override the saved settings.',
      ],
    },
    verify,
  ],
  opencode: [
    account,
    {
      id: 'install',
      title: 'Install the client',
      paragraphs: [
        'Install OpenCode using its official instructions and record the version. This reference follows the linked custom-provider documentation; verify its applicability before using a different major version.',
      ],
      code: [
        {
          label: 'Bash / PowerShell',
          language: 'shell',
          value: 'npm install -g opencode-ai\nopencode --version',
        },
      ],
    },
    environment,
    {
      id: 'configure',
      title: 'Add a custom provider',
      paragraphs: [
        'Merge this provider into opencode.json in your project. Replace the YOUR_MODEL_ID property name with the exact ID selected above; that property name is not read from API94_MODEL.',
        'This configuration uses @ai-sdk/openai-compatible for Chat Completions and reads API94_KEY. A Responses-only route needs @ai-sdk/openai instead. Do not guess model context or output limits.',
      ],
      code: [
        {
          label: 'opencode.json',
          language: 'json',
          value: `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "api94": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "94API",
      "options": {
        "baseURL": "https://94api.dev/v1",
        "apiKey": "{env:API94_KEY}"
      },
      "models": {
        "YOUR_MODEL_ID": { "name": "94API model" }
      }
    }
  }
}`,
        },
      ],
    },
    {
      id: 'start',
      title: 'Start the client',
      paragraphs: [
        'Start opencode from this project and terminal. Use /models and choose the model under 94API. The provider ID is api94; selecting a different saved provider uses that provider instead.',
      ],
      code: [
        { label: 'Bash / PowerShell', language: 'shell', value: 'opencode' },
      ],
    },
    verify,
  ],
}
