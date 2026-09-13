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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
  variant?: 'default' | 'card'
}

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, logoWordmark, loading } = useSystemConfig()
  const isCard = props.variant === 'card'

  return (
    <div
      className={cn(
        'relative grid max-w-none',
        isCard ? 'auth-login min-h-svh grid-cols-1 p-4 sm:p-6 md:p-10' : 'h-svh'
      )}
    >
      <div
        className={
          isCard
            ? 'm-auto flex w-full max-w-sm min-w-0 flex-col gap-6'
            : 'contents'
        }
      >
        <Link
          to='/'
          className={cn(
            'flex items-center gap-2 transition-opacity hover:opacity-80',
            isCard
              ? 'max-w-full self-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
              : 'absolute top-4 left-4 z-10 sm:top-8 sm:left-8'
          )}
        >
          <div
            className={cn(
              'relative shrink-0',
              logoWordmark ? 'h-9 w-[116px]' : 'h-8 w-8'
            )}
          >
            {loading ? (
              <Skeleton className='absolute inset-0 rounded-full' />
            ) : (
              <img
                src={logoWordmark || logo}
                alt={t('Logo')}
                className={
                  logoWordmark
                    ? 'size-full object-contain'
                    : 'h-8 w-8 rounded-full object-cover'
                }
              />
            )}
          </div>
          {loading ? (
            <Skeleton className='h-6 w-24' />
          ) : (
            <h1
              className={cn(
                'min-w-0 text-xl font-medium break-words',
                logoWordmark && 'sr-only'
              )}
            >
              {systemName}
            </h1>
          )}
        </Link>
        <div
          className={
            isCard ? 'contents' : 'container flex items-center pt-16 sm:pt-0'
          }
        >
          <div
            className={
              isCard
                ? 'contents'
                : 'mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8'
            }
          >
            {props.children}
          </div>
        </div>
      </div>
    </div>
  )
}
