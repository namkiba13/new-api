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
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Route, Shield, Sparkles, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  SideDrawerSectionHeader,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getUserGroups } from '@/lib/api'
import { parseQuotaFromDollars } from '@/lib/format'

import { createApiKey, getTokenAutoGroups } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { buildSmartApiKeyPayload } from '../lib/smart-routing-strategy'
import type { ApiKeyGroupOption } from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'
import { AutoGroupOrderEditor } from './auto-group-order-editor'

type SmartApiKeyDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SmartApiKeyDrawer({
  open,
  onOpenChange,
}: SmartApiKeyDrawerProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useApiKeys()
  const [name, setName] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [groupsMode, setGroupsMode] = useState<'custom' | 'inherit'>('custom')
  const [unlimitedQuota, setUnlimitedQuota] = useState(true)
  const [quotaDollars, setQuotaDollars] = useState(10)
  const [allowIps, setAllowIps] = useState('')
  const [expiration, setExpiration] = useState<number>(-1)
  const [expirationPreset, setExpirationPreset] = useState('never')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    data: groupsData,
    isFetching: groupsLoading,
    isError: groupsError,
  } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    enabled: open,
    staleTime: 0,
  })
  const {
    data: autoGroupsData,
    isFetching: autoGroupsLoading,
    isError: autoGroupsError,
  } = useQuery({
    queryKey: ['token-auto-groups'],
    queryFn: getTokenAutoGroups,
    enabled: open,
    staleTime: 0,
  })

  const groupOptions = useMemo<ApiKeyGroupOption[]>(
    () =>
      Object.entries(groupsData?.data || {})
        .filter(([group]) => group !== 'auto')
        .map(([group, info]) => ({
          value: group,
          label: group,
          desc: info.desc || group,
          ratio: info.ratio,
        })),
    [groupsData]
  )
  const globalOptions = useMemo(
    () =>
      (autoGroupsData?.data?.groups || []).flatMap((group) => {
        const option = groupOptions.find((item) => item.value === group)
        return option ? [option] : []
      }),
    [autoGroupsData, groupOptions]
  )
  const maxGroups =
    Number.isInteger(autoGroupsData?.data?.max_count) &&
    Number(autoGroupsData?.data?.max_count) > 0
      ? Number(autoGroupsData?.data?.max_count)
      : 5
  const loading = groupsLoading || autoGroupsLoading
  const accountCanUseAuto = Object.hasOwn(groupsData?.data || {}, 'auto')
  let routingError = ''
  if (
    groupsError ||
    autoGroupsError ||
    groupsData?.success !== true ||
    autoGroupsData?.success !== true
  ) {
    routingError = t('Unable to load Auto routing configuration.')
  } else if (!accountCanUseAuto) {
    routingError = t(
      'The groups are configured, but this account has not been granted access to the Auto routing group.'
    )
  } else if (groupsMode === 'inherit') {
    if (globalOptions.length === 0) {
      routingError = t('No available groups in the global Auto order.')
    }
  } else if (
    selectedGroups.some(
      (group) => !groupOptions.some((option) => option.value === group)
    )
  ) {
    routingError = t(
      'Some selected groups are no longer available. Remove them or restore global Auto.'
    )
  } else if (selectedGroups.length > maxGroups) {
    routingError = t('Select at most {{max}} Auto groups', { max: maxGroups })
  } else if (selectedGroups.length === 0) {
    routingError = t('Select at least one Auto group or restore global Auto.')
  }

  const reset = () => {
    setName('')
    setSelectedGroups([])
    setGroupsMode('custom')
    setUnlimitedQuota(true)
    setQuotaDollars(10)
    setAllowIps('')
    setExpiration(-1)
    setExpirationPreset('never')
  }

  const setExpirationFromNow = (preset: string, seconds: number) => {
    setExpirationPreset(preset)
    setExpiration(seconds < 0 ? -1 : Math.floor(Date.now() / 1000) + seconds)
  }

  const handleCreate = async () => {
    if (isSubmitting || loading) return
    if (!name.trim()) {
      toast.error(t('Please enter a name'))
      return
    }
    if (routingError) {
      toast.error(routingError)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createApiKey(
        buildSmartApiKeyPayload({
          name,
          groups: groupsMode === 'inherit' ? null : selectedGroups,
          expiration,
          unlimitedQuota,
          remainQuota: parseQuotaFromDollars(quotaDollars),
          allowIps,
        })
      )
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.CREATE_FAILED))
        return
      }
      toast.success(t(SUCCESS_MESSAGES.API_KEY_CREATED))
      triggerRefresh()
      onOpenChange(false)
      reset()
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <SheetContent
        className={sideDrawerContentClassName('max-w-none sm:!max-w-[700px]')}
      >
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Create Smart API Key')}</SheetTitle>
          <SheetDescription>
            {t('Choose and order the groups this API key will try.')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5'>
          <SideDrawerSection>
            <SideDrawerSectionHeader
              title={t('Basic Information')}
              description={t('Set API key basic information')}
              icon={<KeyRound className='size-4' />}
              iconTone='info'
            />
            <label className='grid gap-2 text-sm font-medium'>
              {t('Name')}
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('API Key Name')}
                autoFocus
              />
            </label>
          </SideDrawerSection>

          <SideDrawerSection>
            <SideDrawerSectionHeader
              title={t('Auto group order')}
              description={t(
                'When a token uses the auto group, the system tries groups from top to bottom until it finds an available group.'
              )}
              icon={<Route className='size-4' />}
              iconTone='warning'
            />
            <fieldset
              disabled={isSubmitting || loading || !accountCanUseAuto}
              className='min-w-0'
            >
              <AutoGroupOrderEditor
                value={selectedGroups}
                mode={groupsMode}
                options={groupOptions}
                globalOptions={globalOptions}
                maxCount={maxGroups}
                aria-invalid={Boolean(routingError)}
                aria-describedby='smart-key-routing-message'
                onChange={({ groups, mode }) => {
                  setSelectedGroups(groups)
                  setGroupsMode(mode)
                }}
              />
            </fieldset>
            <p
              id='smart-key-routing-message'
              role='status'
              className='text-destructive text-xs'
            >
              {loading ? t('Loading...') : routingError}
            </p>
          </SideDrawerSection>

          <SideDrawerSection>
            <SideDrawerSectionHeader
              title={t('Usage controls')}
              description={t('Set key validity period and quota')}
              icon={<WalletCards className='size-4' />}
              iconTone='success'
            />
            <div className='grid grid-cols-4 gap-2'>
              {[
                ['never', t('Never'), -1],
                ['month', t('1 Month'), 30 * 24 * 60 * 60],
                ['day', t('1 Day'), 24 * 60 * 60],
                ['hour', t('1 Hour'), 60 * 60],
              ].map(([preset, label, seconds]) => (
                <Button
                  key={String(label)}
                  type='button'
                  variant={
                    expirationPreset === preset ? 'secondary' : 'outline'
                  }
                  onClick={() =>
                    setExpirationFromNow(String(preset), Number(seconds))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className='flex items-center justify-between gap-4 rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>{t('Unlimited Quota')}</p>
                <p className='text-muted-foreground text-xs'>
                  {t('Enable unlimited quota for this API key')}
                </p>
              </div>
              <Switch
                checked={unlimitedQuota}
                onCheckedChange={setUnlimitedQuota}
              />
            </div>
            {!unlimitedQuota && (
              <label className='grid gap-2 text-sm font-medium'>
                {t('Quota (USD)')}
                <Input
                  type='number'
                  min={0}
                  step='0.01'
                  value={quotaDollars}
                  onChange={(event) =>
                    setQuotaDollars(Math.max(0, Number(event.target.value)))
                  }
                />
              </label>
            )}
          </SideDrawerSection>

          <SideDrawerSection>
            <SideDrawerSectionHeader
              title={t('Access Restrictions')}
              description={t('Set API key access restrictions')}
              icon={<Shield className='size-4' />}
              iconTone='neutral'
            />
            <label className='grid gap-2 text-sm font-medium'>
              {t('IP Whitelist (supports CIDR)')}
              <Textarea
                value={allowIps}
                onChange={(event) => setAllowIps(event.target.value)}
                placeholder={t('One IP per line (empty for no restriction)')}
                rows={4}
              />
            </label>
          </SideDrawerSection>
        </div>

        <SheetFooter className={sideDrawerFooterClassName()}>
          <Button
            variant='outline'
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
          >
            {t('Close')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isSubmitting || loading || Boolean(routingError)}
          >
            <Sparkles className='size-4' />
            {isSubmitting ? t('Creating...') : t('Create Smart API Key')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
