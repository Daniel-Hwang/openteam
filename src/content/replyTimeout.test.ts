import { describe, expect, it, vi } from 'vitest'
import { createReplyTimeout } from './replyTimeout'

describe('createReplyTimeout', () => {
  it('calls timeout handler when a reply is not observed in time', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const timeout = createReplyTimeout(1000, onTimeout)

    timeout.arm('msg-1')
    vi.advanceTimersByTime(1000)

    expect(onTimeout).toHaveBeenCalledWith('msg-1', 'RESPONSE_NOT_FOUND')
    vi.useRealTimers()
  })

  it('does not call timeout handler after clear', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const timeout = createReplyTimeout(1000, onTimeout)

    timeout.arm('msg-1')
    timeout.clear()
    vi.advanceTimersByTime(1000)

    expect(onTimeout).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
