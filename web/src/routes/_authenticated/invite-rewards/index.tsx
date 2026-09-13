/* Copyright (C) 2023-2026 QuantumNous */
import { createFileRoute } from '@tanstack/react-router'

import { InviteRewards } from '@/features/invite-rewards'

export const Route = createFileRoute('/_authenticated/invite-rewards/')({
  component: InviteRewards,
})
