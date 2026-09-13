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
import { CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsSidebarModuleVisible } from '@/hooks/use-sidebar-config'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

export function ProfileHeader({ profile, loading }: ProfileHeaderProps) {
  const { t } = useTranslation()
  const walletVisible = useIsSidebarModuleVisible('/wallet')
  if (loading) {
    return (
      <div className='space-y-6' aria-busy='true'>
        <Card className='gap-5 p-5 sm:p-6' data-card-hover='false'>
          <div className='flex items-center gap-4'>
            <Skeleton className='size-16 rounded-xl' />
            <Skeleton className='h-8 w-48 max-w-full' />
          </div>
          <div className='grid grid-cols-2 gap-6'>
            <Skeleton className='h-20' />
            <Skeleton className='h-20' />
          </div>
        </Card>
        <Skeleton className='h-44 w-full rounded-xl' />
      </div>
    )
  }
  if (!profile) return null
  const displayName = getDisplayName(profile)
  const avatarName = profile.username || displayName
  const stats = [
    {
      label: t('Total Usage'),
      value: formatQuota(profile.used_quota),
      description: t('Total consumed quota'),
    },
    {
      label: t('API Requests'),
      value: formatCompactNumber(profile.request_count),
      description: t('Total requests made'),
    },
  ]
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <div className='flex flex-wrap items-center gap-4 p-4 sm:p-6'>
          <Avatar className='ring-muted size-14 rounded-xl ring-4 after:rounded-xl sm:size-16'>
            <AvatarFallback
              className='rounded-xl text-lg font-semibold text-white'
              style={getUserAvatarStyle(avatarName)}
            >
              {getUserAvatarFallback(avatarName)}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0 flex-1'>
            <h2 className='text-xl font-semibold tracking-tight break-words sm:text-2xl'>
              {displayName}
            </h2>
            <p className='text-muted-foreground mt-1 text-sm break-all'>
              {profile.email || `@${profile.username}`}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <StatusBadge
              label={getRoleLabel(profile.role)}
              variant='neutral'
              copyable={false}
            />
            <StatusBadge
              label={`${t('User ID')} ${profile.id}`}
              variant='neutral'
              copyText={String(profile.id)}
            />
          </div>
        </div>
        <div className='grid grid-cols-1 divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0'>
          {stats.map((item) => (
            <div key={item.label} className='min-w-0 px-4 py-4 sm:px-6'>
              <p className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {item.label}
              </p>
              <p className='mt-2 text-2xl font-semibold tracking-tight break-words tabular-nums'>
                {item.value}
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card data-card-hover='false' className='gap-4 p-4 sm:p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h3 className='text-base font-semibold'>
              {t('Credits and usage')}
            </h3>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('Monitor credits, usage, and request volume')}
            </p>
          </div>
          {walletVisible && (
            <Button size='sm' render={<Link to='/wallet' />}>
              <CreditCard data-icon='inline-start' />
              {t('Add credits')}
            </Button>
          )}
        </div>
        <div className='bg-muted/40 rounded-lg border p-4'>
          <p className='text-muted-foreground text-xs'>
            {t('Remaining credits')}
          </p>
          <p className='mt-2 text-3xl font-semibold tracking-tight break-words tabular-nums'>
            {formatQuota(profile.quota)}
          </p>
        </div>
      </Card>
    </div>
  )
}
