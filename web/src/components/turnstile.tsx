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
import { useEffect, useEffectEvent, useRef } from 'react'

import { cn } from '@/lib/utils'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>
      ) => string | undefined
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  className?: string
}

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  className,
}: TurnstileProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const verify = useEffectEvent((token: string) => onVerify(token))
  const expire = useEffectEvent(() => onExpire?.())

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let widgetId: string | undefined
    let size: 'compact' | 'flexible'
    const render = () => {
      if (!element.isConnected || !window.turnstile) return
      const width = element.getBoundingClientRect().width
      if (width <= 0) return
      const nextSize = width < 300 ? 'compact' : 'flexible'
      if (widgetId !== undefined && nextSize === size) return
      if (widgetId !== undefined) {
        window.turnstile.remove(widgetId)
        widgetId = undefined
        expire()
      }
      try {
        widgetId = window.turnstile.render(element, {
          sitekey: siteKey,
          size: nextSize,
          callback: (token: string) => verify(token),
          'error-callback': () => expire(),
          'expired-callback': () => expire(),
        })
        size = nextSize
      } catch {
        expire()
      }
    }

    const observer = new ResizeObserver(render)
    observer.observe(element)
    let script = document.querySelector<HTMLScriptElement>('#cf-turnstile')
    if (!script && !window.turnstile) {
      script = document.createElement('script')
      script.id = 'cf-turnstile'
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
    script?.addEventListener('load', render)
    render()
    return () => {
      observer.disconnect()
      script?.removeEventListener('load', render)
      if (widgetId !== undefined) window.turnstile?.remove(widgetId)
    }
  }, [siteKey])

  return (
    <div
      ref={ref}
      className={cn('flex w-full min-w-0 justify-center', className)}
    />
  )
}
