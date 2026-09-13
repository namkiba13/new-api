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
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
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
    return <Skeleton className='h-40 w-full rounded-sm' />
  }

  return (
    <>
      <div className='flex min-h-40 min-w-0 flex-col gap-4 rounded-sm border p-4 text-center'>
        {/* Status Section */}
        <div className='flex flex-1 flex-col gap-4'>
          <div className='flex min-w-0 flex-col items-center gap-3'>
            <IconBadge
              tone={status.enabled ? 'success' : 'neutral'}
              size='md'
              className='rounded-sm'
            >
              <Shield />
            </IconBadge>
            <div className='space-y-1'>
              <div className='flex flex-wrap items-center justify-center gap-2'>
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
              className='mt-auto w-full shrink-0 !rounded-sm'
              onClick={() => dialogs.open('setup')}
            >
              {t('Enable')}
            </Button>
          )}
        </div>

        {/* Actions Section - Only show when enabled */}
        {status.enabled && (
          <div className='flex flex-wrap justify-center gap-3 border-t pt-4'>
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
