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

const verifyCurl = `curl https://94api.dev/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_94API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5-mini",
    "messages": [{"role": "user", "content": "Reply with: 94API connected"}]
  }'`

export const GUIDE_CONTENT: Record<string, GuideSection[]> = {
  quickstart: [
    {
      id: 'create-key',
      title: '1. Create an API key',
      paragraphs: [
        'Sign in to the 94API console, open API Keys, and create a key for the model groups you want to use.',
        'Copy the key now and store it securely. 94API never needs your upstream provider key in client applications.',
      ],
    },
    {
      id: 'first-request',
      title: '2. Send your first request',
      paragraphs: [
        'Use the OpenAI-compatible endpoint below. Replace the placeholder with your 94API API key.',
      ],
      code: [{ label: 'cURL', language: 'bash', value: verifyCurl }],
      note: 'Never expose a production API key in browser-side code or a public repository.',
    },
    {
      id: 'next',
      title: '3. Choose your integration',
      paragraphs: [
        'The same key works with supported SDKs and coding tools. Continue with the dedicated guide for Codex, Claude Code, Gemini CLI, OpenCode, or CC-Switch.',
      ],
    },
  ],
  codex: [
    {
      id: 'create-key',
      title: '1. Create an API key',
      paragraphs: [
        'Create an 94API key with access to your preferred OpenAI-compatible model. Keep the key ready for the local credential file.',
      ],
    },
    {
      id: 'install',
      title: '2. Install Codex',
      paragraphs: [
        'Install Codex for your operating system, then open a new terminal.',
      ],
      code: [
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value:
            'irm https://chatgpt.com/codex/install.ps1 | iex\ncodex --version',
        },
        {
          label: 'macOS / Linux',
          language: 'bash',
          value:
            'curl -fsSL https://chatgpt.com/codex/install.sh | sh\ncodex --version',
        },
      ],
    },
    {
      id: 'configure',
      title: '3. Configure the 94API provider',
      paragraphs: [
        'Create config.toml inside your user-level .codex directory. Store the API key in the separate 94api_key file.',
      ],
      code: [
        {
          label: 'config.toml',
          language: 'toml',
          value: `model_provider = "94API"
model = "gpt-5"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.apimore]
name = "94API"
base_url = "https://94api.dev/v1"
wire_api = "responses"

[model_providers.apimore.auth]
command = "sh"
args = ["-lc", "cat ~/.codex/94api_key"]`,
        },
      ],
      note: 'On Windows, use PowerShell to read $HOME\\.codex\\94api_key in the auth command.',
    },
    {
      id: 'verify',
      title: '4. Verify the connection',
      paragraphs: [
        'Open a new project directory and start Codex with the configured model.',
      ],
      code: [
        {
          label: 'Terminal',
          language: 'bash',
          value:
            'mkdir my-94api-project\ncd my-94api-project\ncodex --model gpt-5',
        },
      ],
    },
  ],
  'claude-code': [
    {
      id: 'create-key',
      title: '1. Create an API key',
      paragraphs: [
        'Create an 94API key that can access a Claude model such as claude-opus-5.',
      ],
    },
    {
      id: 'install',
      title: '2. Install Claude Code',
      paragraphs: [
        'Install the official Claude Code CLI and confirm that the command is available.',
      ],
      code: [
        {
          label: 'Terminal',
          language: 'bash',
          value: 'npm install -g @anthropic-ai/claude-code\nclaude --version',
        },
      ],
    },
    {
      id: 'configure',
      title: '3. Configure 94API',
      paragraphs: [
        'Set the Anthropic base URL and your 94API key in the terminal session that launches Claude Code.',
      ],
      code: [
        {
          label: 'macOS / Linux',
          language: 'bash',
          value: `export ANTHROPIC_BASE_URL="https://94api.dev"
export ANTHROPIC_AUTH_TOKEN="YOUR_94API_KEY"
export ANTHROPIC_MODEL="claude-opus-5"
claude`,
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: `$env:ANTHROPIC_BASE_URL="https://94api.dev"
$env:ANTHROPIC_AUTH_TOKEN="YOUR_94API_KEY"
$env:ANTHROPIC_MODEL="claude-opus-5"
claude`,
        },
      ],
    },
    {
      id: 'verify',
      title: '4. Verify the connection',
      paragraphs: [
        'Ask Claude Code to report the active model. A normal response confirms that the setup is complete.',
      ],
    },
  ],
  'gemini-cli': [
    {
      id: 'install',
      title: '1. Install Gemini CLI',
      paragraphs: [
        'Install the official CLI and verify the installed version.',
      ],
      code: [
        {
          label: 'Terminal',
          language: 'bash',
          value: 'npm install -g @google/gemini-cli\ngemini --version',
        },
      ],
    },
    {
      id: 'configure',
      title: '2. Configure 94API',
      paragraphs: [
        'Provide the 94API key and Gemini-compatible base URL before starting the CLI.',
      ],
      code: [
        {
          label: 'macOS / Linux',
          language: 'bash',
          value: `export GEMINI_API_KEY="YOUR_94API_KEY"
export GOOGLE_GEMINI_BASE_URL="https://94api.dev"
gemini --model gemini-3.5-flash`,
        },
        {
          label: 'Windows PowerShell',
          language: 'powershell',
          value: `$env:GEMINI_API_KEY="YOUR_94API_KEY"
$env:GOOGLE_GEMINI_BASE_URL="https://94api.dev"
gemini --model gemini-3.5-flash`,
        },
      ],
    },
    {
      id: 'verify',
      title: '3. Verify the connection',
      paragraphs: [
        'Send a short prompt and confirm the response appears without an authentication or model error.',
      ],
    },
  ],
  'openai-sdk': [
    {
      id: 'install',
      title: '1. Install the SDK',
      paragraphs: [
        'Choose the official package for your application language.',
      ],
      code: [
        { label: 'JavaScript', language: 'bash', value: 'npm install openai' },
        { label: 'Python', language: 'bash', value: 'pip install openai' },
      ],
    },
    {
      id: 'configure',
      title: '2. Create the 94API client',
      paragraphs: [
        'Set baseURL to 94API and load the key from a server-side environment variable.',
      ],
      code: [
        {
          label: 'JavaScript',
          language: 'javascript',
          value: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.API94_KEY,
  baseURL: "https://94api.dev/v1",
});

const response = await client.responses.create({
  model: "gpt-5-mini",
  input: "Reply with: 94API connected",
});

console.log(response.output_text);`,
        },
        {
          label: 'Python',
          language: 'python',
          value: `import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["94api_key"],
    base_url="https://94api.dev/v1",
)

response = client.responses.create(
    model="gpt-5-mini",
    input="Reply with: 94API connected",
)

print(response.output_text)`,
        },
      ],
    },
  ],
  'anthropic-sdk': [
    {
      id: 'install',
      title: '1. Install the SDK',
      paragraphs: [
        'Install the official Anthropic library for JavaScript or Python.',
      ],
      code: [
        {
          label: 'JavaScript',
          language: 'bash',
          value: 'npm install @anthropic-ai/sdk',
        },
        { label: 'Python', language: 'bash', value: 'pip install anthropic' },
      ],
    },
    {
      id: 'configure',
      title: '2. Create the 94API client',
      paragraphs: [
        'Use the native Messages API while routing the request through 94API.',
      ],
      code: [
        {
          label: 'JavaScript',
          language: 'javascript',
          value: `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.API94_KEY,
  baseURL: "https://94api.dev",
});

const message = await client.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 512,
  messages: [{ role: "user", content: "Hello from 94API" }],
});`,
        },
      ],
    },
  ],
  'cc-switch': [
    {
      id: 'install',
      title: '1. Install CC-Switch',
      paragraphs: [
        'Install CC-Switch from its official release and open the provider profile manager.',
      ],
    },
    {
      id: 'profile',
      title: '2. Create an 94API profile',
      paragraphs: [
        'Choose the tool you want to configure, create a custom provider named 94API, and enter the matching base URL from the table above.',
        'Paste your 94API API key only into the local credential field. Select a supported model, then save the profile.',
      ],
    },
    {
      id: 'switch',
      title: '3. Activate and verify',
      paragraphs: [
        'Activate the 94API profile, fully restart the target CLI, and send a short test prompt.',
      ],
    },
  ],
  opencode: [
    {
      id: 'install',
      title: '1. Install OpenCode',
      paragraphs: [
        'Install OpenCode and confirm that the command is available in a new terminal.',
      ],
      code: [
        {
          label: 'Terminal',
          language: 'bash',
          value: 'npm install -g opencode-ai\nopencode --version',
        },
      ],
    },
    {
      id: 'configure',
      title: '2. Add 94API as a provider',
      paragraphs: [
        'Add an OpenAI-compatible provider to your OpenCode configuration.',
      ],
      code: [
        {
          label: 'opencode.json',
          language: 'json',
          value: `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "94API": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "94API",
      "options": {
        "baseURL": "https://94api.dev/v1",
        "apiKey": "{env:94api_key}"
      },
      "models": {
        "gpt-5-mini": { "name": "GPT-5 Mini" }
      }
    }
  }
}`,
        },
      ],
    },
    {
      id: 'verify',
      title: '3. Start OpenCode',
      paragraphs: [
        'Export 94api_key, start OpenCode, and select the 94API model from the model picker.',
      ],
    },
  ],
}
