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

import { BadgeCell, TruncatedCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { detectSmartRoutingStrategy } from '../lib/smart-routing-strategy'
import {
  // AutoGroupBadge,
  GroupRatioBadge,
  type GroupRatio,
} from './auto-group-visuals'

type ApiKeyGroupCellProps = {
  autoGroups?: string[] | null
  crossGroupRetry: boolean
  group: string
  ratio?: GroupRatio
  shouldReduceMotion: boolean
}

export function ApiKeyGroupCell(props: ApiKeyGroupCellProps) {
  const { t } = useTranslation()

  if (props.group !== 'auto') {
    const ratio = typeof props.ratio === 'number' ? props.ratio : undefined
    return (
      <TruncatedCell
        className='-ml-1.5'
        tooltipContent={props.group || '-'}
        tooltipClassName='break-all'
      >
        <GroupBadge group={props.group} ratio={ratio} />
      </TruncatedCell>
    )
  }

  const strategy = detectSmartRoutingStrategy(props.autoGroups)
  const strategyLabel = {
    balanced: t('Balanced'),
    stability: t('Stability first'),
    'low-price': t('Low price first'),
    custom: t('Custom routing'),
  }[strategy]

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <BadgeCell
            data-api-key-group-cell='auto'
            className='gap-1.5 overflow-visible text-xs'
          />
        }
      >
        <StatusBadge label={strategyLabel} variant='info' copyable={false} />
        {/*<AutoGroupBadge shouldReduceMotion={props.shouldReduceMotion} />*/}
        <GroupRatioBadge
          ratio={props.ratio}
          isAuto
          shouldReduceMotion={props.shouldReduceMotion}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span className='text-xs'>
          {props.autoGroups?.length
            ? props.autoGroups.join(' → ')
            : t('Automatically selects available groups in configured order')}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
