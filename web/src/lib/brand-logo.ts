// The configured upload stays intact; each placement gets the matching asset.
export function resolveBrandLogo(src: string) {
  const bundled =
    src === '/94api-logo-transparent.png' ||
    src === 'https://94api.dev/94api-logo-transparent.png'
  return {
    icon: bundled ? '/94api-logo-mark-v1.png' : src,
    wordmarkLight: bundled ? '/94api-logo-wordmark-light-v1.png' : undefined,
    wordmarkDark: bundled ? '/94api-logo-wordmark-dark-v1.png' : undefined,
  }
}
