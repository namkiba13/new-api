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
}

export const DOCS_GUIDES: DocsGuide[] = [
  {
    slug: 'quickstart',
    eyebrow: 'API Quick Start',
    title: '94API Quick Start',
    subtitle: 'OpenAI-compatible API',
    description:
      'Create an API key, send your first request, and connect any OpenAI-compatible application to 94API.',
    protocols: ['Chat Completions', 'Responses API'],
    baseUrl: 'https://94api.dev/v1',
    model: 'gpt-5',
    icon: Sparkles,
  },
  {
    slug: 'codex',
    eyebrow: 'Codex / OpenAI',
    title: 'Codex Quick Start',
    subtitle: 'Codex / Responses API',
    description:
      'Install Codex on Windows, macOS, or Linux and connect it to 94API with a provider configuration.',
    protocols: ['Responses API'],
    baseUrl: 'https://94api.dev/v1',
    model: 'gpt-5',
    icon: TerminalSquare,
  },
  {
    slug: 'claude-code',
    eyebrow: 'Claude Code',
    title: 'Claude Code Quick Start',
    subtitle: 'Anthropic Messages',
    description:
      'Configure Claude Code with an 94API key, supported Claude model names, and the Anthropic endpoint.',
    protocols: ['Anthropic Messages'],
    baseUrl: 'https://94api.dev',
    model: 'claude-opus-5',
    icon: Bot,
  },
  {
    slug: 'gemini-cli',
    eyebrow: 'Gemini CLI',
    title: 'Gemini CLI Quick Start',
    subtitle: 'Gemini / Native API',
    description:
      'Install Gemini CLI, configure the 94API Gemini endpoint, and verify the connection.',
    protocols: ['Gemini API'],
    baseUrl: 'https://94api.dev',
    model: 'gemini-3.5-flash',
    icon: Command,
  },
  {
    slug: 'openai-sdk',
    eyebrow: 'OpenAI SDK',
    title: 'OpenAI SDK Setup',
    subtitle: 'JavaScript & Python',
    description:
      'Use official OpenAI client libraries with 94API for chat completions and Responses API requests.',
    protocols: ['Chat Completions', 'Responses API'],
    baseUrl: 'https://94api.dev/v1',
    model: 'gpt-5-mini',
    icon: Braces,
  },
  {
    slug: 'anthropic-sdk',
    eyebrow: 'Anthropic SDK',
    title: 'Anthropic SDK Setup',
    subtitle: 'JavaScript & Python',
    description:
      'Connect official Anthropic libraries to 94API while keeping the native Messages API format.',
    protocols: ['Anthropic Messages'],
    baseUrl: 'https://94api.dev',
    model: 'claude-opus-4-7',
    icon: MessagesSquare,
  },
  {
    slug: 'cc-switch',
    eyebrow: 'CC-Switch',
    title: 'CC-Switch Setup',
    subtitle: 'Local profile switching',
    description:
      'Create and switch 94API profiles for Codex, Claude Code, Gemini CLI, and other coding tools.',
    protocols: ['Responses API', 'Anthropic Messages', 'Gemini API'],
    baseUrl: 'https://94api.dev',
    icon: Network,
  },
  {
    slug: 'opencode',
    eyebrow: 'OpenCode',
    title: 'OpenCode Setup',
    subtitle: 'OpenAI-compatible provider',
    description:
      'Connect OpenCode to 94API as a custom provider and switch between available model groups.',
    protocols: ['Chat Completions'],
    baseUrl: 'https://94api.dev/v1',
    model: 'gpt-5-mini',
    icon: Code2,
  },
]

export function getDocsGuide(slug: string) {
  return DOCS_GUIDES.find((guide) => guide.slug === slug)
}
