import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createExternalModelClient, ExternalModelError } from './externalModelClient'
import type { ExternalModelConfig } from '../group/types'
import { streamText } from 'ai'

vi.mock('ai', () => ({
  streamText: vi.fn(),
}))

describe('ExternalModelClient Stability Baseline', () => {
  const mockConfig: ExternalModelConfig = {
    id: 'test-model',
    name: 'Test Model',
    format: 'openai',
    baseUrl: 'https://api.example.com/v1',
    apiKey: '***',
    modelName: 'gpt-4',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  let mockFetch: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
  })

  // Helper to create a mock streamText result
  async function createMockStreamResult(texts: string[]) {
    return {
      textStream: {
        async *[Symbol.asyncIterator]() {
          for (const text of texts) {
            yield text
          }
        },
      },
    }
  }

  it('should succeed when the API returns a valid stream', async () => {
    vi.mocked(streamText).mockResolvedValue(await createMockStreamResult(['Hello', ' World']))

    const client = createExternalModelClient(mockFetch)
    const result = await client.complete({ model: mockConfig, prompt: 'Hi' })
    
    expect(result.content).toBe('Hello World')
  })

  it('should retry on 429 and eventually succeed', async () => {
    let callCount = 0
    vi.mocked(streamText).mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        const error: any = new Error('Too Many Requests')
        error.status = 429
        throw error
      }
      return await createMockStreamResult(['Success after retry'])
    })

    const client = createExternalModelClient(mockFetch)
    const result = await client.complete({ model: mockConfig, prompt: 'Hi' })
    
    expect(callCount).toBe(2)
    expect(result.content).toBe('Success after retry')
  }, 10000)

  it('should fail after max retries on persistent 500 error', async () => {
    let callCount = 0
    vi.mocked(streamText).mockImplementation(async () => {
      callCount++
      const error: any = new Error('Internal Server Error')
      error.status = 500
      throw error
    })

    const client = createExternalModelClient(mockFetch)
    
    await expect(client.complete({ model: mockConfig, prompt: 'Hi' }))
      .rejects.toThrow(ExternalModelError)
    
    expect(callCount).toBe(3) // maxRetries = 3
  }, 10000)

  it('should fail immediately on non-retryable error (e.g. 400)', async () => {
    vi.mocked(streamText).mockImplementation(async () => {
      const error: any = new Error('Bad Request')
      error.status = 400
      throw error
    })

    const client = createExternalModelClient(mockFetch)
    
    await expect(client.complete({ model: mockConfig, prompt: 'Hi' }))
      .rejects.toThrow(ExternalModelError)
    
    expect(vi.mocked(streamText)).toHaveBeenCalledTimes(1)
  })
})
