export const APP_PORTS = {
  tasks: 443,
  discover: 8445,
  money: 8447,
  food: 8448,
  memo: 8450,
} as const

export type AppName = keyof typeof APP_PORTS

export function appUrl(app: AppName, path = '/') {
  const port = APP_PORTS[app]
  return `${location.protocol}//${location.hostname}${port === 443 ? '' : ':' + port}${path}`
}
