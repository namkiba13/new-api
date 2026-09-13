/* Copyright (C) 2023-2026 QuantumNous */

export function iframeSandbox(
  src: string | undefined,
  parentUrl: string
): string {
  const permissions =
    'allow-scripts allow-forms allow-popups allow-presentation'
  try {
    const target = new URL(src ?? '', parentUrl)
    const parent = new URL(parentUrl)
    // External integrations need their own cookies/storage. Same-origin or
    // inline content must not combine scripts with access to the parent origin.
    if (
      ['https:', 'http:'].includes(target.protocol) &&
      target.origin !== parent.origin
    ) {
      return `${permissions} allow-same-origin`
    }
  } catch {
    // Invalid URLs keep the restrictive sandbox.
  }
  return permissions
}
