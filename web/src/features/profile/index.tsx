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
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { LoginSessionsCard } from './components/login-sessions-card'
import { ProfileHeader } from './components/profile-header'
import { ProfileSecurityCard } from './components/profile-security-card'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { SidebarModulesCard } from './components/sidebar-modules-card'
import { useProfile } from './hooks'

export function Profile() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile, fetchProfile } = useProfile()
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''
  const canConfigureSidebar = permissions?.sidebar_settings === true

  return (
    <Main>
      <div className='profile-page min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-10'>
        <CardStaggerContainer className='mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            {t('Profile')}
          </h1>
          {!loading && !profile ? (
            <ErrorState
              title={t('Failed to load profile')}
              onRetry={() => void fetchProfile()}
            />
          ) : (
            <>
              <CardStaggerItem>
                <ProfileHeader profile={profile} loading={loading} />
              </CardStaggerItem>

              <CardStaggerItem>
                <ProfileSettingsCard
                  section='bindings'
                  profile={profile}
                  loading={loading}
                  onProfileUpdate={refreshProfile}
                />
              </CardStaggerItem>
              <CardStaggerItem>
                <LanguagePreferencesCard
                  profile={profile}
                  onProfileUpdate={refreshProfile}
                />
              </CardStaggerItem>
              <CardStaggerItem>
                <ProfileSettingsCard
                  section='notifications'
                  profile={profile}
                  loading={loading}
                  onProfileUpdate={refreshProfile}
                />
              </CardStaggerItem>
              <CardStaggerItem>
                <ProfileSecurityCard profile={profile} loading={loading} />
              </CardStaggerItem>
              <CardStaggerItem>
                <LoginSessionsCard />
              </CardStaggerItem>
              {checkinEnabled && (
                <CardStaggerItem>
                  <CheckinCalendarCard
                    checkinEnabled={checkinEnabled}
                    turnstileEnabled={turnstileEnabled}
                    turnstileSiteKey={turnstileSiteKey}
                  />
                </CardStaggerItem>
              )}
              {canConfigureSidebar && (
                <CardStaggerItem>
                  <SidebarModulesCard />
                </CardStaggerItem>
              )}
            </>
          )}
        </CardStaggerContainer>
      </div>
    </Main>
  )
}
