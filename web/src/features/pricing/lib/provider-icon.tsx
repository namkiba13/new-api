/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { getLobeIcon } from '@/lib/lobe-icon'

import type { PricingModel } from '../types'

const PROVIDER_ICONS: Record<string, string> = {
  alibaba: 'Qwen.Color',
  anthropic: 'Claude.Color',
  cohere: 'Cohere.Color',
  deepseek: 'DeepSeek.Color',
  google: 'Gemini.Color',
  'jina ai': 'Jina.Color',
  mistral: 'Mistral.Color',
  'mistral ai': 'Mistral.Color',
  moonshot: 'Moonshot',
  openai: 'OpenAI.Avatar',
  xai: 'Grok',
  阿里巴巴: 'Qwen.Color',
}

const ICON_ALIASES: Record<string, string> = {
  anthropic: 'Claude.Color',
  claude: 'Claude.Color',
  cohere: 'Cohere.Color',
  deepseek: 'DeepSeek.Color',
  gemini: 'Gemini.Color',
  google: 'Gemini.Color',
  grok: 'Grok',
  jina: 'Jina.Color',
  mistral: 'Mistral.Color',
  kimi: 'Moonshot',
  moonshot: 'Moonshot',
  openai: 'OpenAI.Avatar',
  qwen: 'Qwen.Color',
  xai: 'Grok',
}

export function getPricingProvider(model: PricingModel) {
  if (model.vendor_name && model.vendor_name.toLowerCase() !== '94API') {
    return model.vendor_name
  }

  const fingerprint = [
    model.model_name,
    model.tags,
    ...(model.supported_endpoint_types || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (fingerprint.includes('anthropic') || fingerprint.includes('claude')) {
    return 'Anthropic'
  }
  if (fingerprint.includes('gemini')) return 'Google'
  if (fingerprint.includes('jina') || fingerprint.includes('rerank')) {
    return 'Jina AI'
  }
  if (fingerprint.includes('deepseek')) return 'DeepSeek'
  if (fingerprint.includes('kimi') || fingerprint.includes('moonshot')) {
    return 'Moonshot'
  }
  if (fingerprint.includes('qwen') || fingerprint.includes('dashscope')) {
    return 'Alibaba'
  }
  if (fingerprint.includes('mistral')) return 'Mistral AI'
  if (fingerprint.includes('grok') || fingerprint.includes('xai')) return 'xAI'
  if (fingerprint.includes('cohere')) return 'Cohere'

  return 'OpenAI'
}

function normalizeIconKey(iconKey: string) {
  return ICON_ALIASES[iconKey.trim().toLowerCase()] || iconKey
}

export function getPricingModelIcon(model: PricingModel, size: number) {
  const explicitIcon = model.icon || model.vendor_icon
  const iconKey = explicitIcon
    ? normalizeIconKey(explicitIcon)
    : PROVIDER_ICONS[getPricingProvider(model).toLowerCase()]

  return iconKey ? getLobeIcon(iconKey, size) : null
}
