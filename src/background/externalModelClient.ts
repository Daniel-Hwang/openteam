import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ExternalModelConfig, ExternalModelFormat } from '../group/types'

export class ExternalModelError extends Error {
  constructor(public message: string, public status?: number, public code?: string) {
    super(message)
    this.name = 'ExternalModelError'
  }

  get friendlyMessage(): string {
    if (this.status === 401 || this.status === 403) return 'API Key 无效或权限不足，请检查配置'
    if (this.status === 429) return '请求过于频繁，请稍后再试 (Rate Limit)'
    if (this.status === 404) return '模型名称不正确或端点路径错误'
    if (this.status && this.status >= 500) return '模型服务器出现内部错误，请稍后重试'
    if (this.message.includes('timeout') || this.message.includes('Network')) return '网络连接超时，请检查 BaseURL 和网络设置'
    return this.message
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

function normalizeBaseUrl(url: string, format: ExternalModelFormat): string {
  let normalized = url.trim().replace(/\/+$/, '')
  if (format === 'openai') {
    if (!normalized.endsWith('/v1')) {
      normalized += '/v1'
    }
  }
  return normalized
}

export function createExternalModelClient(fetchImpl: typeof fetch = fetch): ExternalModelClient {
  let lastResponseMetadata: Record<string, unknown> = {}

  const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetchImpl(input, init)
    lastResponseMetadata = {
      url: input instanceof Request ? input.url : String(input),
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    }
    return response
  }

  return {
    stream(input) {
      return streamExternalModel(input, wrappedFetch)
    },
    async complete(input) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        let content = ''
        const normalizedUrl = normalizeBaseUrl(input.model.baseUrl, input.model.format)
        const stream = streamExternalModel({ ...input, abortSignal: controller.signal }, wrappedFetch)
        for await (const chunk of stream) content += chunk
        if (!content.trim()) {
          throw new ExternalModelError(
            `外部模型返回内容为空 (URL: ${normalizedUrl}, Model: ${input.model.modelName}, Response: ${JSON.stringify(lastResponseMetadata)})`
          )
        }
        return { content }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new ExternalModelError('请求超时，模型响应时间过长', 408)
        }
        if (error instanceof ExternalModelError) throw error
        throw new ExternalModelError(error.message || '未知外部模型错误')
      } finally {
        clearTimeout(timeoutId)
      }
    },
  }
}

async function* streamExternalModel(input: ExternalModelCompletionInput, fetchImpl: typeof fetch): AsyncIterable<string> {
  const maxRetries = 3
  let attempt = 0

  while (true) {
    try {
      const normalizedUrl = normalizeBaseUrl(input.model.baseUrl, input.model.format)
      const provider = input.model.format === 'anthropic'
        ? createAnthropic({
          apiKey: input.model.apiKey,
          baseURL: normalizedUrl,
          fetch: fetchImpl,
        })
        : createOpenAICompatible({
          name: `openteam-${input.model.id}`,
          apiKey: input.model.apiKey,
          baseURL: normalizedUrl,
          fetch: fetchImpl,
        })

      const result = streamText({
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
