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

export type SmartRoutingStrategy = 'balanced' | 'stability' | 'low-price'

export type SmartApiKeyPayloadInput = {
  name: string
  groups: string[] | null
  unlimitedQuota?: boolean
  remainQuota?: number
  expiration?: number
  allowIps?: string
}

const STRATEGY_SUFFIX: Record<SmartRoutingStrategy, string> = {
  balanced: '-stable',
  stability: '-premium',
  'low-price': '-award',
}

export function detectSmartRoutingStrategy(
  groups: string[] | null | undefined
): SmartRoutingStrategy | 'custom' {
  if (!groups || groups.length === 0) return 'custom'
  const match = (
    Object.entries(STRATEGY_SUFFIX) as Array<[SmartRoutingStrategy, string]>
  ).find(([, suffix]) => groups.every((group) => group.endsWith(suffix)))
  return match?.[0] ?? 'custom'
}

export function buildSmartApiKeyPayload(input: SmartApiKeyPayloadInput) {
  return {
    name: input.name.trim(),
    remain_quota: input.unlimitedQuota === false ? (input.remainQuota ?? 0) : 0,
    expired_time: input.expiration ?? -1,
    unlimited_quota: input.unlimitedQuota ?? true,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: input.allowIps?.trim() ?? '',
    group: 'auto',
    auto_groups: input.groups,
    cross_group_retry: true,
  }
}
