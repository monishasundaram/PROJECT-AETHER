type Level = 'debug' | 'info' | 'warn' | 'error'

export function createLogger(scope: string) {
  const prefix = () => `[${new Date().toISOString().slice(11, 23)}] [${scope}]`
  const make =
    (level: Level) =>
    (...args: unknown[]) =>
      console[level](prefix(), ...args)

  return {
    debug: make('debug'),
    info: make('info'),
    warn: make('warn'),
    error: make('error'),
  }
}