import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ExternalModelConfig } from '../group/types'

export class ExternalModelError extends Error {
  constructor(public message: string, public status?: number, public code?: string) {
    super(message)
    this.name = 'ExternalModelError'
  }
}

export interface ExternalModelCompletionInput {
  model: ExternalModelConfig
  prompt: string
  abortSignal?: AbortSignal
}

export interface ExternalModelCompletionResult {
  content: string
}

export interface ExternalModelClient {
  stream?(input: ExternalModelCompletionInput): AsyncIterable<string>
  complete(input: ExternalModelCompletionInput): Promise<ExternalModelCompletionResult>
}

export function createExternalModelClient(fetchImpl: typeof fetch = fetch): ExternalModelClient {
  return {
    stream(input) {
      return streamExternalModel(input, fetchImpl)
    },
    async complete(input) {
      try {
        let content = ''
        for await (const chunk of streamExternalModel(input, fetchImpl)) content += chunk
        if (!content.trim()) throw new ExternalModelError('外部模型返回内容为空')
        return { content }
      } catch (error: any) {
        if (error instanceof ExternalModelError) throw error
        throw new ExternalModelError(error.message || '未知外部模型错误')
      }
    },
  }
}

async function* streamExternalModel(input: ExternalModelCompletionInput, fetchImpl: typeof fetch): AsyncIterable<string> {
  const maxRetries = 3
  let attempt = 0

  while (true) {
    try {
      const provider = input.model.format === 'anthropic'
        ? createAnthropic({
          apiKey: input.model.apiKey,
          baseURL: input.model.baseUrl,
          fetch: fetchImpl,
        })
        : createOpenAICompatible({
          name: `openteam-${input.model.id}`,
          apiKey: input.model.apiKey,
          baseURL: input.model.baseUrl,
          fetch: fetchImpl,
        })

      const result = await streamText({
        model: provider(input.model.modelName as never),
        prompt: input.prompt,
        abortSignal: input.abortSignal,
      })

      for await (const textPart of result.textStream) {
        if (textPart) yield textPart
      }
      return 
    } catch (error: any) {
      attempt++
      const status = error.status || error.response?.status
      const isRetryable = status === 429 || (status >= 500 && status <= 599) || error.message?.includes('timeout') || error.message?.includes('Network')

      if (!isRetryable || attempt >= maxRetries) {
        throw new ExternalModelError(
          error.message || '外部模型请求失败',
          status,
          error.code
        )
      }

      const delay = Math.pow(2, attempt) * 500
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
