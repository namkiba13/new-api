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
import { Shield, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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
          <div className='space-y-3'>
            <Skeleton className='h-20 w-full rounded-lg' />
            <Skeleton className='h-20 w-full rounded-lg' />
          </div>
        ) : (
          <section aria-label={t('Security')} className='space-y-3'>
            <div className='flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex min-w-0 items-start gap-3'>
                <IconBadge tone='neutral' size='md'>
                  <KeyRound />
                </IconBadge>
                <div className='space-y-1'>
                  <p className='text-sm font-medium'>{t('Change Password')}</p>
                  <p className='text-muted-foreground text-xs leading-relaxed'>
                    {t('Update your password to keep your account secure')}
                  </p>
                </div>
              </div>
              <Button
                variant='outline'
                size='sm'
                className='w-full shrink-0 sm:w-auto'
                onClick={() => dialogs.open('password')}
              >
                {t('Change Password')}
              </Button>
            </div>
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
