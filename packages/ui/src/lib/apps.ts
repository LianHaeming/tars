export const APP_PORTS = {
  tasks: 443,
  burmese: 8444,
} as const

export type AppName = keyof typeof APP_PORTS

export function appUrl(app: AppName, path = '/') {
  const port = APP_PORTS[app]
  return `${location.protocol}//${location.hostname}${port === 443 ? '' : ':' + port}${path}`
}
