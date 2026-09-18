/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { expect, it } from 'vitest'

import { resources } from '@/i18n/config'

import { LegalConsent } from '../legal-consent'
import { TermsFooter } from '../terms-footer'

const loginCopy = {
  en: 'By signing in, you agree to the User Agreement and Privacy Policy of 94API.',
  vi: 'Bằng việc đăng nhập, bạn được xem là đã đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư của 94API.',
  fr: 'En vous connectant, vous acceptez les Conditions d’utilisation et la Politique de confidentialité de 94API.',
  ru: 'Входя в систему, вы соглашаетесь с Пользовательским соглашением и Политикой конфиденциальности 94API.',
  ja: 'ログインすることで、94APIの利用規約およびプライバシーポリシーに同意したものとみなされます。',
  zhCN: '登录即表示您同意94API的用户协议和隐私政策。',
  zhTW: '登入即表示您同意94API的用戶協議和私隱政策。',
}

it.each(Object.entries(loginCopy))(
  'shows the complete login notice and document links in %s',
  async (lng, expected) => {
    const i18n = createInstance()
    await i18n.init({
      lng,
      resources,
      fallbackLng: false,
      keySeparator: false,
      nsSeparator: false,
    })
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TermsFooter
          status={{
            user_agreement_enabled: true,
            privacy_policy_enabled: true,
            system_name: '94API',
          }}
        />
      </I18nextProvider>
    )
    expect(container.textContent).toBe(expected)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    ).toEqual(['/user-agreement', '/privacy-policy'])
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  }
)

it.each(Object.keys(loginCopy))(
  'translates signup text and keeps its explicit checkbox in %s',
  async (lng) => {
    const i18n = createInstance()
    await i18n.init({
      lng,
      resources,
      fallbackLng: false,
      keySeparator: false,
      nsSeparator: false,
    })
    const status = {
      user_agreement_enabled: true,
      privacy_policy_enabled: true,
      system_name: '94API',
    }
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TermsFooter variant='sign-up' status={status} />
        <LegalConsent
          status={status}
          checked={false}
          onCheckedChange={() => {}}
        />
      </I18nextProvider>
    )
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(container.textContent).not.toMatch(/<agreement>|<privacy>|\{\{/)
    if (lng !== 'en') {
      expect(container.textContent).not.toContain('By creating an account')
    }
    expect(container.textContent).not.toContain(' and the ')
  }
)

it.each(['sign-in', 'sign-up'] as const)(
  'only links enabled documents for %s and hides an empty notice',
  async (variant) => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'vi',
      resources,
      fallbackLng: false,
      keySeparator: false,
      nsSeparator: false,
    })
    const renderNotice = (agreement: boolean, privacy: boolean) => (
      <I18nextProvider i18n={i18n}>
        <TermsFooter
          variant={variant}
          status={{
            user_agreement_enabled: agreement,
            privacy_policy_enabled: privacy,
            system_name: '94API',
          }}
        />
      </I18nextProvider>
    )
    const view = render(renderNotice(true, false))
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/user-agreement')
    expect(view.container.textContent).not.toMatch(
      /\{\{|<agreement>|<privacy>|By /
    )
    view.rerender(renderNotice(false, true))
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/privacy-policy')
    expect(view.container.textContent).not.toMatch(
      /\{\{|<agreement>|<privacy>|By /
    )
    view.rerender(renderNotice(false, false))
    expect(view.container).toBeEmptyDOMElement()
  }
)
