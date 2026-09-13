/* Copyright (C) 2023-2026 QuantumNous */
import { useAuthStore, type AuthUser } from '../src/stores/auth-store'

// The real credential remains exclusively in the local Node process.
async function start() {
  const response = await fetch('/api/user/self')
  const result = (await response.json()) as { success: boolean; data: AuthUser }
  if (!response.ok || !result.success) {
    throw new Error('Could not authenticate the read-only preview')
  }
  const now = Math.floor(Date.now() / 1000)
  useAuthStore.getState().auth.setBundle({
    access_token: 'local-read-only-preview',
    token_type: 'Bearer',
    access_expires_at: now + 86400,
    user: result.data,
    session: {
      sid: 'local-preview',
      current: true,
      login_method: 'preview',
      ip: '',
      user_agent: '',
      created_at: now,
      last_active_at: now,
      expires_at: now + 86400,
    },
  })
  await import('../src/main')
}
void start().catch(() => {
  const root = document.querySelector('#root')
  if (root) {
    root.textContent =
      'Unable to load 94API data. Check the local token and restart the preview.'
  }
})

