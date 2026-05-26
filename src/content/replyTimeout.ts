import type { ReplyFailureReason } from '../group/types'

export function createReplyTimeout(timeoutMs: number, onTimeout: (messageId: string, reason: ReplyFailureReason) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let activeMessageId: string | undefined

  return {
    arm(messageId: string): void {
      this.clear()
      activeMessageId = messageId
      timer = setTimeout(() => {
        const timedOutMessageId = activeMessageId
        activeMessageId = undefined
        timer = undefined
        if (timedOutMessageId) onTimeout(timedOutMessageId, 'RESPONSE_NOT_FOUND')
      }, timeoutMs)
    },

    clear(): void {
      if (timer) clearTimeout(timer)
      timer = undefined
      activeMessageId = undefined
    },
  }
}
