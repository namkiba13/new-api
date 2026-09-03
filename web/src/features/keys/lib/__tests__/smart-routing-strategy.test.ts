/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import {
  buildSmartApiKeyPayload,
  detectSmartRoutingStrategy,
  resolveSmartStrategyGroups,
} from '../smart-routing-strategy'

const groups = [
  'auto',
  'openai-stable',
  'claude-stable',
  'google-stable',
  'openai-premium',
  'claude-premium',
  'openai-award',
  'claude-award',
  'default',
]

describe('resolveSmartStrategyGroups', () => {
  test('maps Balanced to all provider stable groups', () => {
    expect(resolveSmartStrategyGroups(groups, 'balanced')).toEqual([
      'openai-stable',
      'claude-stable',
      'google-stable',
    ])
  })

  test('maps Stability first to all provider premium groups', () => {
    expect(resolveSmartStrategyGroups(groups, 'stability')).toEqual([
      'openai-premium',
      'claude-premium',
    ])
  })

  test('maps Low price first to all provider award groups', () => {
    expect(resolveSmartStrategyGroups(groups, 'low-price')).toEqual([
      'openai-award',
      'claude-award',
    ])
  })

  test('preserves order and removes duplicates', () => {
    expect(
      resolveSmartStrategyGroups(
        ['claude-stable', 'openai-stable', 'claude-stable'],
        'balanced'
      )
    ).toEqual(['claude-stable', 'openai-stable'])
  })

  test('builds a native Auto token payload with cross-group retry', () => {
    expect(
      buildSmartApiKeyPayload({
        name: ' Hermes Balanced ',
        groups,
        strategy: 'balanced',
        allowIps: ' 10.0.0.1 ',
      })
    ).toMatchObject({
      name: 'Hermes Balanced',
      group: 'auto',
      auto_groups: ['openai-stable', 'claude-stable', 'google-stable'],
      cross_group_retry: true,
      allow_ips: '10.0.0.1',
      model_limits_enabled: false,
    })
  })

  test('detects a display strategy from stored Auto groups', () => {
    expect(detectSmartRoutingStrategy(['openai-stable', 'claude-stable'])).toBe(
      'balanced'
    )
    expect(
      detectSmartRoutingStrategy(['openai-premium', 'claude-premium'])
    ).toBe('stability')
    expect(detectSmartRoutingStrategy(['openai-award'])).toBe('low-price')
    expect(
      detectSmartRoutingStrategy(['openai-stable', 'claude-premium'])
    ).toBe('custom')
  })
})
