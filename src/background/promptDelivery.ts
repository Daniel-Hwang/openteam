import type { SendPromptMessage } from '../group/runtimeProtocol'
import type { ChatSite } from '../group/types'

export interface PromptDelivery {
  roleId: string
  chatSite?: ChatSite
  tabId: number
  frameId: number
  message: SendPromptMessage
}

export type PromptSender = (delivery: PromptDelivery, isTest?: boolean) => Promise<void>

export interface PromptSenderDependencies {
  log: {
    info(event: string, details?: Record<string, unknown>): void
    warn(event: string, details?: Record<string, unknown>): void
  }
}

export function createPromptSender({ log }: PromptSenderDependencies): PromptSender {
  return async (delivery, isTest = false) => {
    if (isTest) {
      log.info('prompt:send:test-mode', {
        chatId: delivery.message.chatId,
        roleId: delivery.roleId,
        messageId: delivery.message.messageId,
      })
      // In test mode, we do not send the prompt to the iframe.
      // The actual mock response is handled by the orchestration runtime 
      // which manually injects a dummy message and advances the run.
      return
    }

    log.info('prompt:send:start', {
      chatId: delivery.message.chatId,
      roleId: delivery.roleId,
      messageId: delivery.message.messageId,
      tabId: delivery.tabId,
      frameId: delivery.frameId,
      contentLength: delivery.message.content.length,
      includesPersona: delivery.message.includesPersona ?? false,
    })

    try {
      const response = await chrome.tabs.sendMessage(delivery.tabId, delivery.message, { frameId: delivery.frameId })
      if (isRecord(response) && response.ok === false) {
        throw new Error(readOptionalString(response.error) ?? readOptionalString(response.message) ?? 'Gemini prompt delivery failed')
      }
      log.info('prompt:send:response', {
        chatId: delivery.message.chatId,
        roleId: delivery.roleId,
        messageId: delivery.message.messageId,
        tabId: delivery.tabId,
        frameId: delivery.frameId,
        response,
      })
    } catch (error) {
      const reason = (error instanceof Error && error.message.includes('Could not establish connection')) ? 'SEND_FAILED' : 'UNKNOWN'
      log.warn('prompt:send:failed', {
        chatId: delivery.message.chatId,
        roleId: delivery.roleId,
        messageId: delivery.message.messageId,
        tabId: delivery.tabId,
        frameId: delivery.frameId,
        error: error instanceof Error ? error.message : String(error),
        reason,
      })
      throw error
    }
  }
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
