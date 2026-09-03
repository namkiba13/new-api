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
import { Settings, Zap, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Configure'),
      desc: t(
        'Add your API keys, set up channels and configure access permissions'
      ),
      icon: <Settings className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Connect'),
      desc: t(
        'Connect through OpenAI, Claude, Gemini, and other compatible API routes'
      ),
      icon: <Zap className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Monitor'),
      desc: t('Track usage, costs and performance with real-time analytics'),
      icon: <BarChart3 className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='relative z-10 px-4 py-20 sm:px-6 md:py-28 lg:px-10 xl:px-14'>
      <div className='mx-auto max-w-[1680px] border-t pt-20 md:pt-28'>
        <AnimateInView className='mb-14 max-w-3xl text-start md:mb-16'>
          <p className='home-kicker mb-4 flex items-center gap-3 font-mono text-xs font-semibold tracking-[0.14em] uppercase'>
            <span className='size-2 bg-[var(--pricing-accent)]' />
            {t('How It Works')}
          </p>
          <h2 className='text-4xl font-semibold tracking-[-0.045em] md:text-6xl'>
            {t('Three steps to get started')}
          </h2>
        </AnimateInView>

        <div className='grid border md:grid-cols-3'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 150}
              animation='fade-up'
              className='relative flex min-h-64 flex-col items-start border-b p-7 text-start last:border-b-0 md:border-e md:border-b-0 md:last:border-e-0'
            >
              <div className='relative mb-6'>
                <div className='text-muted-foreground bg-muted/30 flex size-14 items-center justify-center rounded-sm border transition-colors'>
                  {step.icon}
                </div>
                <div className='absolute -top-2 -right-2 flex size-6 items-center justify-center bg-[var(--pricing-accent)] font-mono text-xs font-bold text-black'>
                  {step.num}
                </div>
              </div>
              <h3 className='mb-2 text-base font-semibold'>{step.title}</h3>
              <p className='text-muted-foreground max-w-sm text-sm leading-relaxed'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
