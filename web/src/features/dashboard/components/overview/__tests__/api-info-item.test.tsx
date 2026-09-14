/* Copyright (C) 2023-2026 QuantumNous */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { getDefaultPingStatus } from '@/features/dashboard/lib/api-info'

import { ApiInfoItemComponent } from '../api-info-item'

const item = {
  route: '94API Main Route',
  description:
    'Recommended for everyday use, with support for longer non-streaming requests.',
  url: 'https://94api.dev/v1',
  color: 'green',
}

it('shows the complete route description with only latency and copy actions', () => {
  render(
    <ApiInfoItemComponent
      item={item}
      status={getDefaultPingStatus()}
      onTest={vi.fn()}
    />
  )
  expect(screen.getByText(item.description)).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Test Latency' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Copy URL' })).toBeEnabled()
  expect(screen.queryByTitle('External Speed Test')).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('supports keyboard latency checks and prevents repeat clicks while testing', async () => {
  const user = userEvent.setup()
  const onTest = vi.fn()
  const { rerender } = render(
    <ApiInfoItemComponent
      item={item}
      status={getDefaultPingStatus()}
      onTest={onTest}
    />
  )
  screen.getByRole('button', { name: 'Test Latency' }).focus()
  await user.keyboard('{Enter}')
  expect(onTest).toHaveBeenCalledWith(item.url)
  rerender(
    <ApiInfoItemComponent
      item={item}
      status={{ latency: null, testing: true, error: false }}
      onTest={onTest}
    />
  )
  expect(screen.getByText('Testing...')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Test Latency' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Test Latency' }))
  expect(onTest).toHaveBeenCalledTimes(1)
  rerender(
    <ApiInfoItemComponent
      item={item}
      status={{ latency: 123, testing: false, error: false }}
      onTest={onTest}
    />
  )
  expect(screen.getByText('123ms')).toBeVisible()
  rerender(
    <ApiInfoItemComponent
      item={item}
      status={{ latency: null, testing: false, error: true }}
      onTest={onTest}
    />
  )
  expect(screen.getByText('N/A')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Test Latency' })).toBeEnabled()
})

it('copies the exact endpoint and shows copied feedback', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  render(
    <ApiInfoItemComponent
      item={item}
      status={getDefaultPingStatus()}
      onTest={vi.fn()}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Copy URL' }))
  expect(write).toHaveBeenCalledWith('https://94api.dev/v1')
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible()
})
