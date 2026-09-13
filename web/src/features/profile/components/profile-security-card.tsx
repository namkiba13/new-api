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
import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { useDialogs } from '@/hooks/use-dialog'

import type { UserProfile } from '../types'
import { ChangePasswordDialog } from './dialogs/change-password-dialog'
import { TwoFACard } from './two-fa-card'

interface ProfileSecurityCardProps {
  profile: UserProfile | null
  loading: boolean
}

export function ProfileSecurityCard({
  profile,
  loading,
}: ProfileSecurityCardProps) {
  const { t } = useTranslation()
  const dialogs = useDialogs<'password'>()
  if (!loading && !profile) return null
  return (
    <>
      <TitledCard
        titleClassName='text-base sm:text-base'
        title={t('Security')}
        description={t('Manage your security settings and account access')}
        icon={<Shield className='size-4' />}
        iconTone='neutral'
        disableHoverEffect
      >
        {loading ? (
          <div className='grid grid-cols-1 items-stretch gap-3 md:grid-cols-2'>
            <Skeleton className='h-40 w-full rounded-sm' />
            <Skeleton className='h-40 w-full rounded-sm' />
          </div>
        ) : (
          <section
            aria-label={t('Security')}
            className='grid grid-cols-1 items-stretch gap-3 md:grid-cols-2'
          >
            <button
              type='button'
              onClick={() => dialogs.open('password')}
              className='hover:bg-muted/40 focus-visible:ring-ring flex min-h-40 min-w-0 flex-col items-center justify-start gap-3 rounded-sm border p-4 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none'
            >
              <IconBadge tone='neutral' size='md' className='rounded-sm'>
                <Shield />
              </IconBadge>
              <div className='space-y-1'>
                <p className='text-sm font-medium'>{t('Change Password')}</p>
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  {t('Update your password to keep your account secure')}
                </p>
              </div>
            </button>
            <TwoFACard loading={loading} />
          </section>
        )}
      </TitledCard>
      {profile && (
        <ChangePasswordDialog
          open={dialogs.isOpen('password')}
          onOpenChange={(open) =>
            open ? dialogs.open('password') : dialogs.close('password')
          }
          username={profile.username}
        />
      )}
    </>
  )
}
