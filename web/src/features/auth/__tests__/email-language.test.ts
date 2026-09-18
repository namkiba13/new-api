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
import { afterEach, describe, expect, test } from 'vitest'

import { sendEmailVerification as sendProfileVerification } from '@/features/profile/api'
import i18n from '@/i18n/config'
import { api } from '@/lib/api'

import { sendEmailVerification, sendPasswordResetEmail } from '../api'

const originalAdapter = api.defaults.adapter
afterEach(async () => {
  api.defaults.adapter = originalAdapter
  await i18n.changeLanguage('en')
})

describe('email request language', () => {
  test.each([
    ['en', 'en'],
    ['vi', 'vi'],
    ['fr', 'fr'],
    ['ru', 'ru'],
    ['ja', 'ja'],
    ['zhCN', 'zh-CN'],
    ['zhTW', 'zh-TW'],
  ])(
    'uses selected %s on registration, reset and profile requests',
    async (selected, header) => {
      await i18n.changeLanguage(selected)
      const requests: string[] = []
      api.defaults.adapter = async (config) => {
        expect(config.headers.get('Accept-Language')).toBe(header)
        expect(config.disableDuplicate).toBe(true)
        requests.push(config.url || '')
        return {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }
      }
      await sendEmailVerification('lab@example.test', 'captcha')
      await sendPasswordResetEmail('lab@example.test', 'captcha')
      await sendProfileVerification('lab@example.test', 'captcha')
      expect(requests).toHaveLength(3)
    }
  )

  test('reads a newly selected language for the next send', async () => {
    const languages: unknown[] = []
    api.defaults.adapter = async (config) => {
      languages.push(config.headers.get('Accept-Language'))
      return {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    await i18n.changeLanguage('vi')
    await sendEmailVerification('first@example.test')
    await i18n.changeLanguage('ja')
    await sendEmailVerification('second@example.test')
    expect(languages).toEqual(['vi', 'ja'])
  })
})
