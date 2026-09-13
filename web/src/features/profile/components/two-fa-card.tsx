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
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { useDialogs } from '@/hooks/use-dialog'

import { useTwoFA } from '../hooks'
import { TwoFABackupDialog } from './dialogs/two-fa-backup-dialog'
import { TwoFADisableDialog } from './dialogs/two-fa-disable-dialog'
import { TwoFASetupDialog } from './dialogs/two-fa-setup-dialog'

// ============================================================================
// Two-Factor Authentication Card Component
// ============================================================================

interface TwoFACardProps {
  loading: boolean
}

type DialogKey = 'setup' | 'disable' | 'backup'

export function TwoFACard({ loading: pageLoading }: TwoFACardProps) {
  const { t } = useTranslation()
  const { status, loading, refetch } = useTwoFA(!pageLoading)
  const dialogs = useDialogs<DialogKey>()

  if (pageLoading || loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='p-3 sm:p-5'>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='mt-2 h-4 w-64' />
        </CardHeader>
        <CardContent className='p-3 sm:p-5'>
          <Skeleton className='h-20 w-full' />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <TitledCard
        title={t('Two-Factor Authentication')}
        description={t('Add an extra layer of security to your account')}
        icon={<Shield className='size-4' />}
        iconTone='neutral'
        titleClassName='text-base sm:text-base'
        disableHoverEffect
      >
        <div className='space-y-4'>
          {/* Status Section */}
          <div className='bg-muted/20 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex min-w-0 items-start gap-3'>
              <IconBadge
                tone={status.enabled ? 'success' : 'neutral'}
                size='md'
              >
                <Shield />
              </IconBadge>
              <div className='space-y-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-sm font-medium'>
                    {t('Two-Step Verification')}
                  </p>
                  {status.enabled ? (
                    <StatusBadge
                      label={t('Enabled')}
                      variant='success'
                      showDot
                      copyable={false}
                    />
                  ) : (
                    <StatusBadge
                      label={t('Disabled')}
                      variant='neutral'
                      showDot
                      copyable={false}
                    />
                  )}
                  {status.locked && (
                    <StatusBadge
                      label={t('Locked')}
                      variant='danger'
                      showDot
                      copyable={false}
                    />
                  )}
                </div>
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  {status.enabled
                    ? t('Backup codes remaining: {{count}}', {
                        count: status.backup_codes_remaining,
                      })
                    : t('Add an extra layer of security to your account')}
                </p>
              </div>
            </div>

            {!status.enabled && (
              <Button
                size='sm'
                className='w-full shrink-0 sm:w-auto'
                onClick={() => dialogs.open('setup')}
              >
                {t('Enable')}
              </Button>
            )}
          </div>

          {/* Actions Section - Only show when enabled */}
          {status.enabled && (
            <div className='flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end'>
              <Button
                variant='outline'
                size='sm'
                className='w-full sm:w-auto'
                onClick={() => dialogs.open('backup')}
              >
                <RefreshCw className='mr-2 h-4 w-4' />
                {t('Regenerate Backup Codes')}
              </Button>
              <Button
                variant='destructive'
                size='sm'
                className='w-full sm:w-auto'
                onClick={() => dialogs.open('disable')}
              >
                <AlertTriangle className='mr-2 h-4 w-4' />
                {t('Disable 2FA')}
              </Button>
            </div>
          )}
        </div>
      </TitledCard>

      {/* Dialogs */}
      <TwoFASetupDialog
        open={dialogs.isOpen('setup')}
        onOpenChange={(open) =>
          open ? dialogs.open('setup') : dialogs.close('setup')
        }
        onSuccess={refetch}
      />

      <TwoFADisableDialog
        open={dialogs.isOpen('disable')}
        onOpenChange={(open) =>
          open ? dialogs.open('disable') : dialogs.close('disable')
        }
        onSuccess={refetch}
      />

      <TwoFABackupDialog
        open={dialogs.isOpen('backup')}
        onOpenChange={(open) =>
          open ? dialogs.open('backup') : dialogs.close('backup')
        }
        onSuccess={refetch}
      />
    </>
  )
}
