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
import { cn } from '@/lib/utils'

import { createApiKey, getTokenAutoGroups } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  buildSmartApiKeyPayload,
  resolveSmartStrategyGroups,
  type SmartRoutingStrategy,
} from '../lib/smart-routing-strategy'
import { useApiKeys } from './api-keys-provider'

type SmartApiKeyDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STRATEGIES: Array<{
  value: SmartRoutingStrategy
  label: string
  hint: string
}> = [
  {
    value: 'balanced',
    label: 'Balanced',
    hint: 'All Stable groups',
  },
  {
    value: 'stability',
    label: 'Stability first',
    hint: 'All Premium groups',
  },
  {
    value: 'low-price',
    label: 'Low price first',
    hint: 'All Award groups',
  },
]

export function SmartApiKeyDrawer({
  open,
  onOpenChange,
}: SmartApiKeyDrawerProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useApiKeys()
  const [name, setName] = useState('')
  const [strategy, setStrategy] = useState<SmartRoutingStrategy>('balanced')
  const [unlimitedQuota, setUnlimitedQuota] = useState(true)
  const [quotaDollars, setQuotaDollars] = useState(10)
  const [allowIps, setAllowIps] = useState('')
  const [expiration, setExpiration] = useState<number>(-1)
  const [expirationPreset, setExpirationPreset] = useState('never')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    enabled: open,
    staleTime: 0,
  })
  const { data: autoGroupsData } = useQuery({
    queryKey: ['token-auto-groups'],
    queryFn: getTokenAutoGroups,
    enabled: open,
    staleTime: 0,
  })

  const availableGroups = useMemo(
    () => Object.keys(groupsData?.data || {}),
    [groupsData]
  )
  const strategyGroups = useMemo(
    () => resolveSmartStrategyGroups(availableGroups, strategy),
    [availableGroups, strategy]
  )
  const maxGroups = autoGroupsData?.data?.max_count || 5
  const autoRoutingConfigured = autoGroupsData?.success === true
  const accountCanUseAuto = availableGroups.includes('auto')
  const groupLimitExceeded = strategyGroups.length > maxGroups

  const reset = () => {
    setName('')
    setStrategy('balanced')
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
    if (!name.trim()) {
      toast.error(t('Please enter a name'))
      return
    }
    if (!autoRoutingConfigured) {
      toast.error(t('Unable to load Auto routing configuration.'))
      return
    }
    if (!accountCanUseAuto) {
      toast.error(t('Auto routing is not enabled for this account.'))
      return
    }
    if (strategyGroups.length === 0) {
      toast.error(t('No groups match the selected routing strategy.'))
      return
    }
    if (groupLimitExceeded) {
      toast.error(
        t(
          'This strategy has {{count}} groups but the current limit is {{max}}.',
          {
            count: strategyGroups.length,
            max: maxGroups,
          }
        )
      )
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createApiKey(
        buildSmartApiKeyPayload({
          name,
          groups: availableGroups,
          strategy,
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
            {t(
              'All models available to your account are included automatically. Choose how requests should prioritize routes.'
            )}
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
              title={t('Routing Strategy')}
              description={t('Choose one strategy across every model provider')}
              icon={<Sparkles className='size-4' />}
              iconTone='warning'
            />
            <div className='grid gap-2 sm:grid-cols-3'>
              {STRATEGIES.map((item) => (
                <button
                  key={item.value}
                  type='button'
                  onClick={() => setStrategy(item.value)}
                  className={cn(
                    'min-h-20 rounded-md border p-3 text-start transition-colors',
                    strategy === item.value
                      ? 'border-foreground bg-muted ring-1 ring-foreground'
                      : 'hover:bg-muted/60'
                  )}
                >
                  <span className='block font-medium'>{t(item.label)}</span>
                  <span className='text-muted-foreground mt-1 block text-xs'>
                    {t(item.hint)}
                  </span>
                </button>
              ))}
            </div>
            <div className='bg-muted/45 rounded-md border p-3'>
              <div className='mb-2 flex items-center gap-2 text-sm font-medium'>
                <Route className='size-4' />
                {t('Included groups')} ({strategyGroups.length})
              </div>
              <div className='flex flex-wrap gap-2'>
                {groupsLoading ? (
                  <span className='text-muted-foreground text-xs'>
                    {t('Loading...')}
                  </span>
                ) : (
                  strategyGroups.map((group) => (
                    <span
                      key={group}
                      className='bg-background rounded-sm border px-2 py-1 font-mono text-xs'
                    >
                      {group}
                    </span>
                  ))
                )}
              </div>
              {groupLimitExceeded && (
                <p className='text-destructive mt-2 text-xs'>
                  {t(
                    'This strategy has {{count}} groups but the current limit is {{max}}.',
                    { count: strategyGroups.length, max: maxGroups }
                  )}
                </p>
              )}
              {autoRoutingConfigured && !accountCanUseAuto && (
                <p className='text-destructive mt-2 text-xs'>
                  {t(
                    'The groups are configured, but this account has not been granted access to the Auto routing group.'
                  )}
                </p>
              )}
            </div>
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
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              isSubmitting ||
              groupsLoading ||
              groupLimitExceeded ||
              !autoRoutingConfigured ||
              !accountCanUseAuto
            }
          >
            <Sparkles className='size-4' />
            {isSubmitting ? t('Creating...') : t('Create Smart API Key')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
