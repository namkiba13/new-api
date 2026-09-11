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
import { Link, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { useStatus } from '@/hooks/use-status'

import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useTranslation()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { status } = useStatus()

  return (
    <AuthLayout variant='card'>
      <Card
        role='region'
        aria-labelledby='sign-in-title'
        className='gap-6 overflow-visible py-6 shadow-sm [--background:var(--card)]'
      >
        <CardHeader className='gap-2 px-6 text-center'>
          <h2
            id='sign-in-title'
            className='text-xl font-semibold tracking-tight'
          >
            {t('Welcome back!')}
          </h2>
          <CardDescription>{t('Sign in')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6 px-6'>
          <UserAuthForm
            redirectTo={redirect}
            className='gap-5 [&_button[type=submit]]:h-11 [&_input]:h-11'
          />

          {!status?.self_use_mode_enabled &&
            status?.register_enabled !== false && (
              <p className='text-muted-foreground text-center text-sm'>
                {t("Don't have an account?")}{' '}
                <Link
                  to='/sign-up'
                  className='text-foreground font-medium underline underline-offset-4 hover:opacity-80'
                >
                  {t('Sign up')}
                </Link>
              </p>
            )}
        </CardContent>
      </Card>

      <TermsFooter
        variant='sign-in'
        status={status}
        className='px-4 text-center leading-relaxed'
      />
    </AuthLayout>
  )
}
