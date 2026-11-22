export function getDatabaseErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

export function getDatabaseErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown database error'
}
