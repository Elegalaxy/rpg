type DebugTag = '[ui]' | '[loop]' | '[save]'

export function debugLog(tag: DebugTag, ...data: unknown[]): void {
  if (import.meta.env.DEV) {
    console.debug(tag, ...data)
  }
}
