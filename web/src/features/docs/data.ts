/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  Bot,
  Braces,
  Code2,
  Command,
  MessagesSquare,
  Network,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react'

export type DocsGuide = {
  slug: string
  eyebrow: string
  title: string
  subtitle: string
  description: string
  protocols: string[]
  baseUrl: string
  model?: string
  icon: LucideIcon
  references: { label: string; href: string }[]
}

export const DOCS_REVIEW_DATE = '2026-09-20'

export const DOCS_GUIDES: DocsGuide[] = [
  {
    slug: 'quickstart',
    eyebrow: 'API Quick Start',
    title: '94API Quick Start',
    subtitle: 'OpenAI-compatible API',
    description:
      'Prepare balance and key permissions, select an available model, and send a Chat Completions request.',
    protocols: ['Chat Completions'],
    baseUrl: 'https://94api.dev/v1',
    model: 'gpt-5.5',
    icon: Sparkles,
    references: [
      {
        label: 'OpenAI SDK',
        href: 'https://github.com/openai/openai-node#usage',
      },
    ],
  },
  {
    slug: 'codex',
    eyebrow: 'Codex / OpenAI',
    title: 'Codex Provider Reference',
    subtitle: 'Codex / Responses API',
    description:
      'Configure a custom Codex provider after confirming Responses support for the selected model and route.',
    protocols: ['Responses API'],
    baseUrl: 'https://94api.dev/v1',
    icon: TerminalSquare,
    references: [
      {
        label: 'Codex CLI',
        href: 'https://github.com/openai/codex#quickstart',
      },
      {
        label: 'Codex configuration',
        href: 'https://developers.openai.com/codex/config-file/config-advanced#custom-model-providers',
      },
    ],
  },
  {
    slug: 'claude-code',
    eyebrow: 'Claude Code',
    title: 'Claude Code Gateway Reference',
    subtitle: 'Anthropic Messages',
    description:
      'Review Claude Code gateway requirements and credential setup without assuming Claude model availability.',
    protocols: ['Anthropic Messages'],
    baseUrl: 'https://94api.dev',
    icon: Bot,
    references: [
      {
        label: 'Claude Code setup',
        href: 'https://code.claude.com/docs/en/setup',
      },
      {
        label: 'Claude Code gateway',
        href: 'https://code.claude.com/docs/en/llm-gateway-connect',
      },
      {
        label: 'Claude Code model configuration',
        href: 'https://code.claude.com/docs/en/model-config',
      },
    ],
  },
  {
    slug: 'gemini-cli',
    eyebrow: 'Gemini CLI',
    title: 'Gemini CLI Gateway Reference',
    subtitle: 'Gemini / Native API',
    description:
      'Review Gemini CLI authentication, custom endpoints and model requirements before testing this integration.',
    protocols: ['Gemini API'],
    baseUrl: 'https://94api.dev',
    icon: Command,
    references: [
      {
        label: 'Gemini CLI installation',
        href: 'https://geminicli.com/docs/get-started/installation/',
      },
      {
        label: 'Gemini CLI authentication',
        href: 'https://geminicli.com/docs/get-started/authentication/',
      },
      {
        label: 'Gemini CLI configuration',
        href: 'https://geminicli.com/docs/reference/configuration/',
      },
    ],
  },
  {
    slug: 'openai-sdk',
    eyebrow: 'OpenAI SDK',
    title: 'OpenAI SDK Setup',
    subtitle: 'JavaScript & Python',
    description:
      'Use official JavaScript or Python clients for Chat Completions, with a separately qualified Responses example.',
    protocols: ['Chat Completions', 'Responses API'],
    baseUrl: 'https://94api.dev/v1',
    icon: Braces,
    references: [
      {
        label: 'OpenAI JavaScript SDK',
        href: 'https://github.com/openai/openai-node',
      },
      {
        label: 'OpenAI Python SDK',
        href: 'https://github.com/openai/openai-python',
      },
    ],
  },
  {
    slug: 'anthropic-sdk',
    eyebrow: 'Anthropic SDK',
    title: 'Anthropic SDK Reference',
    subtitle: 'JavaScript & Python',
    description:
      'Configure the official JavaScript and Python SDKs for a model and route confirmed to support Messages.',
    protocols: ['Anthropic Messages'],
    baseUrl: 'https://94api.dev',
    icon: MessagesSquare,
    references: [
      {
        label: 'Anthropic JavaScript SDK',
        href: 'https://github.com/anthropics/anthropic-sdk-typescript',
      },
      {
        label: 'Anthropic Python SDK',
        href: 'https://github.com/anthropics/anthropic-sdk-python',
      },
    ],
  },
  {
    slug: 'cc-switch',
    eyebrow: 'CC-Switch',
    title: 'CC-Switch Setup',
    subtitle: 'Local profile switching',
    description:
      'Manage custom OpenCode or Codex connection settings and verify the selected client configuration.',
    protocols: ['Chat Completions', 'Responses API'],
    baseUrl: 'https://94api.dev/v1',
    icon: Network,
    references: [
      { label: 'CC Switch', href: 'https://ccswitch.io' },
      {
        label: 'CC Switch user manual',
        href: 'https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/README.md',
      },
    ],
  },
  {
    slug: 'opencode',
    eyebrow: 'OpenCode',
    title: 'OpenCode Setup',
    subtitle: 'OpenAI-compatible provider',
    description:
      'Add a custom Chat Completions provider and select an accessible model in OpenCode.',
    protocols: ['Chat Completions'],
    baseUrl: 'https://94api.dev/v1',
    icon: Code2,
    references: [
      { label: 'OpenCode installation', href: 'https://opencode.ai/docs/' },
      {
        label: 'OpenCode custom provider',
        href: 'https://opencode.ai/docs/providers/#custom-provider',
      },
    ],
  },
]

export function getDocsGuide(slug: string) {
  return DOCS_GUIDES.find((guide) => guide.slug === slug)
}
