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
} from '../smart-routing-strategy'

describe('Smart routing', () => {
  test('builds a native Auto token payload with cross-group retry', () => {
    expect(
      buildSmartApiKeyPayload({
        name: ' Hermes Custom ',
        groups: ['stable', 'FREETIER', 'low'],
        allowIps: ' 10.0.0.1 ',
      })
    ).toMatchObject({
      name: 'Hermes Custom',
      group: 'auto',
      auto_groups: ['stable', 'FREETIER', 'low'],
      cross_group_retry: true,
      allow_ips: '10.0.0.1',
      model_limits_enabled: false,
    })
  })

  test('preserves explicit global inheritance and usage restrictions', () => {
    expect(
      buildSmartApiKeyPayload({
        name: 'Global',
        groups: null,
        unlimitedQuota: false,
        remainQuota: 500,
        expiration: 123,
        allowIps: ' 10.0.0.0/24 ',
      })
    ).toMatchObject({
      auto_groups: null,
      unlimited_quota: false,
      remain_quota: 500,
      expired_time: 123,
      allow_ips: '10.0.0.0/24',
    })
    expect(
      buildSmartApiKeyPayload({ name: 'Empty', groups: [] }).auto_groups
    ).toEqual([])
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
