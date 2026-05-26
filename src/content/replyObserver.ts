import type { RoleToBackgroundMessage } from '../group/runtimeProtocol'
import { findLatestCompensationCandidate, findLatestCompensationReply } from './replyCompensation'
import { createReplyTimeout } from './replyTimeout'
import { createReplyTracker } from './replyTracker'
import { resolveReportableReplyText, type ReportableReplyText } from './reportableReply'
import { keepDeepestResponseContainers } from './responseContainers'
import type { ContentLogger } from './runtimeClient'
import type { RoleSession } from './roleSession'
import type { ChatSiteAdapter } from './sites/types'

type ReplySource = 'observer' | 'timeout-compensation' | 'polling-compensation'

const RESPONSE_DEBOUNCE_MS = 2500
const RESPONSE_FINAL_SETTLE_MS = 1500
const REPLY_POLL_INTERVAL_MS = 2000
const REPLY_TIMEOUT_MS = 120000
const SHORT_REPLY_MAX_CHARS = 50
const SHORT_REPLY_STABLE_SETTLE_MS = 5000

export interface ReplyObserverController {
  capturePromptReplyBaseline(messageId: string | undefined): void
  clearPromptReplyBaseline(): void
  clearReplyPolling(): void
  startReplyPolling(messageId: string, replyAttemptId: string | undefined): void
  startReplyReporting(): void
  seedStoredRoleReplies(replies: string[] | undefined): void
  resetForAssignedRole(): void
}

export function createReplyObserver(options: {
  siteAdapter: ChatSiteAdapter
  roleSession: RoleSession
  log: ContentLogger
  sendRuntimeMessage<T>(message: RoleToBackgroundMessage): Promise<T>
  reportRoleError(messageId: string | undefined, reason: string, chatId?: string, roleId?: string, replyAttemptId?: string): void
}): ReplyObserverController {
  const { siteAdapter, roleSession, log } = options
  let promptBaselineContainers = new Set<Element>()
  let promptBaselineReplies = new Set<string>()
  let replyPollingTimer: number | null = null
  let replyPollingInFlight = false
  const replyTracker = createReplyTracker()
  const replyTimeout = createReplyTimeout(REPLY_TIMEOUT_MS, (messageId, failureReason) => {
    const assignedRole = roleSession.getAssignedRole()
    log.warn('reply-timeout', { messageId, roleId: assignedRole?.roleId, roleName: assignedRole?.roleName, reason: failureReason })

    const replyAttemptId = roleSession.getActiveReplyAttemptId()
    const activePrompt = roleSession.getActivePrompt()
    if (activePrompt?.messageId === messageId && siteAdapter.isGenerating()) {
      log.warn('reply-timeout:extended-generating', { messageId, roleId: assignedRole?.roleId, roleName: assignedRole?.roleName })
      options
        .sendRuntimeMessage({
          type: 'TEAM_ROLE_STATUS',
          status: 'generating',
          ...statusIdentityPayload(),
        })
        .catch(error => log.warn('reply-timeout:heartbeat-failed', { messageId, error: error instanceof Error ? error.message : String(error) }))
      replyTimeout.arm(messageId)
      return
    }
    if (!siteAdapter.isGenerating() && tryReportLatestReply(messageId, 'timeout-compensation')) return

    roleSession.clearActivePrompt(messageId)
    const statusIdentity = statusIdentityPayload()
    options
      .sendRuntimeMessage({
        type: 'TEAM_ROLE_STATUS',
        status: 'error',
        ...statusIdentity,
        error: failureReason,
      })
      .catch(error => log.warn('reply-timeout:status-failed', { error: error instanceof Error ? error.message : String(error) }))
    options.reportRoleError(messageId, failureReason, undefined, undefined, replyAttemptId)
    clearReplyPolling()
  })

  function getConversationId(): string {
    return siteAdapter.getConversationId()
  }

  function capturePromptReplyBaseline(messageId: string | undefined): void {
    const containers = siteAdapter.getResponseContainers()
    const replies = containers.map(container => siteAdapter.readResponseText(container)).filter(Boolean)
    promptBaselineContainers = new Set(containers)
    promptBaselineReplies = new Set(replies.map(reply => reply.trim()).filter(Boolean))
    replyTracker.seed(getConversationId(), replies)
    log.debug('reply-baseline:captured', {
      messageId,
      conversationId: getConversationId(),
      containerCount: promptBaselineContainers.size,
      replyCount: promptBaselineReplies.size,
    })
  }

  function clearPromptReplyBaseline(): void {
    promptBaselineContainers.clear()
    promptBaselineReplies.clear()
  }

  function seedStoredRoleReplies(replies: string[] | undefined): void {
    const validReplies = (replies ?? []).map(reply => reply.trim()).filter(Boolean)
    if (validReplies.length === 0) return
    replyTracker.seedGlobal(validReplies)
    log.debug('reply-history:seeded', { count: validReplies.length, conversationId: getConversationId() })
  }

  function isPromptBaselineReply(text: string, element: Element): boolean {
    const trimmed = text.trim()
    if (!trimmed) return true
    if (promptBaselineReplies.has(trimmed)) return true

    for (const container of promptBaselineContainers) {
      if (container === element || container.contains(element) || element.contains(container)) return true
    }

    return false
  }

  function findCompensationReply(messageId: string): { text: string; element: Element } | undefined {
    return findLatestCompensationReply({
      containers: siteAdapter.getResponseContainers(),
      readText: siteAdapter.readResponseText,
      isBaseline: isPromptBaselineReply,
      consume: text => replyTracker.consumeIfNewForMessage(getConversationId(), text, messageId),
    })
  }

  function findCompensationCandidate(): { text: string; element: Element } | undefined {
    return findLatestCompensationCandidate({
      containers: siteAdapter.getResponseContainers(),
      readText: siteAdapter.readResponseText,
      isBaseline: isPromptBaselineReply,
    })
  }

  function clearReplyPolling(): void {
    if (replyPollingTimer) {
      window.clearTimeout(replyPollingTimer)
      replyPollingTimer = null
    }
    replyPollingInFlight = false
  }

  function normalizedReplyLength(text: string): number {
    return text.replace(/\s+/g, '').length
  }

  function isVeryShortReply(text: string): boolean {
    const length = normalizedReplyLength(text)
    return length > 0 && length <= SHORT_REPLY_MAX_CHARS
  }

  function startReplyPolling(messageId: string, replyAttemptId: string | undefined): void {
    clearReplyPolling()
    replyTimeout.arm(messageId)

    let stableElement: Element | undefined
    let stableText = ''
    let stableSince = 0

    const schedule = () => {
      replyPollingTimer = window.setTimeout(tick, REPLY_POLL_INTERVAL_MS)
    }

    const resetStableCandidate = () => {
      stableElement = undefined
      stableText = ''
      stableSince = 0
    }

    const tick = () => {
      replyPollingTimer = null

      const activePrompt = roleSession.getActivePrompt()
      if (activePrompt?.messageId !== messageId || activePrompt.replyAttemptId !== replyAttemptId) {
        clearReplyPolling()
        return
      }

      if (replyPollingInFlight) {
        schedule()
        return
      }

      const candidate = findCompensationCandidate()
      if (!candidate) {
        resetStableCandidate()
        schedule()
        return
      }

      const timestamp = Date.now()
      const generating = siteAdapter.isGenerating()
      if (candidate.element !== stableElement || candidate.text !== stableText) {
        stableElement = candidate.element
        stableText = candidate.text
        stableSince = timestamp
        log.debug('reply-poll:candidate', { messageId, textLength: candidate.text.length })
        schedule()
        return
      }

      const stableDuration = timestamp - stableSince
      if (stableDuration < RESPONSE_FINAL_SETTLE_MS) {
        schedule()
        return
      }
      if (generating) {
        log.debug('reply-poll:defer-generating', { messageId, stableDuration, textLength: candidate.text.length })
        schedule()
        return
      }
      if (isVeryShortReply(candidate.text) && stableDuration < SHORT_REPLY_STABLE_SETTLE_MS) {
        log.debug('reply-poll:defer-short', {
          messageId,
          stableDuration,
          textLength: candidate.text.length,
          normalizedLength: normalizedReplyLength(candidate.text),
        })
        schedule()
        return
      }

      replyPollingInFlight = true
      resolveReportableReplyText(siteAdapter, candidate.element, candidate.text, log)
        .then(reply => {
          const active = roleSession.getActivePrompt()
          const assignedRole = roleSession.getAssignedRole()
          if (active?.messageId !== messageId || active.replyAttemptId !== replyAttemptId) return
          if (!replyTracker.consumeIfNewForMessage(getConversationId(), reply.text, messageId)) {
            log.debug('reply-poll:skipped', { messageId, textLength: reply.text.length, roleId: assignedRole?.roleId })
            schedule()
            return
          }
          log.warn('reply-poll:compensated', { messageId, textLength: reply.text.length, roleId: assignedRole?.roleId })
          reportAcceptedReply(messageId, reply, 'polling-compensation')
        })
        .catch(error => {
          log.warn('reply-poll:resolve-failed', { messageId, error: error instanceof Error ? error.message : String(error) })
          const active = roleSession.getActivePrompt()
          if (active?.messageId === messageId && active.replyAttemptId === replyAttemptId) schedule()
        })
        .finally(() => {
          replyPollingInFlight = false
        })
    }

    schedule()
  }

  function reportAcceptedReply(messageId: string, reply: ReportableReplyText, source: ReplySource): void {
    const assignedRole = roleSession.getAssignedRole()
    if (!assignedRole) return

    const replyAttemptId = roleSession.clearActivePrompt(messageId)
    clearPromptReplyBaseline()
    replyTimeout.clear()
    clearReplyPolling()
    const text = reply.text
    log.info('reply:accepted', { messageId, textLength: text.length, roleId: assignedRole.roleId, roleName: assignedRole.roleName, source })

    const snapshot = siteAdapter.getConversationSnapshot()
    options
      .sendRuntimeMessage({
        type: 'TEAM_ROLE_REPLY',
        chatId: roleSession.getAssignedChatId(assignedRole),
        roleId: assignedRole.roleId,
        messageId,
        replyAttemptId,
        content: text,
        contentFormat: reply.contentFormat,
        conversationId: snapshot.conversationId,
        conversationUrl: snapshot.conversationUrl,
      })
      .then(() => {
        const activePrompt = roleSession.getActivePrompt()
        if (activePrompt) {
          log.info('reply:skip-idle-active-prompt', { completedMessageId: messageId, activeMessageId: activePrompt.messageId })
          return undefined
        }
        return options.sendRuntimeMessage({ type: 'TEAM_ROLE_STATUS', status: 'idle', ...statusIdentityPayload() })
      })
      .catch(error => log.warn('reply:report-failed', { error: error instanceof Error ? error.message : String(error) }))
  }

  function statusIdentityPayload(): { chatId?: string; roleId?: string } {
    const assignedRole = roleSession.getAssignedRole()
    const chatId = roleSession.getAssignedChatId(assignedRole)
    const roleId = assignedRole?.roleId
    return {
      ...(chatId ? { chatId } : {}),
      ...(roleId ? { roleId } : {}),
    }
  }

  function tryReportLatestReply(messageId: string, source: 'timeout-compensation'): boolean {
    const assignedRole = roleSession.getAssignedRole()
    if (!assignedRole) return false
    const reply = findCompensationReply(messageId)
    if (!reply) return false

    log.warn('reply:compensated', { messageId, textLength: reply.text.length, roleId: assignedRole.roleId, source })
    reportAcceptedReply(messageId, { text: reply.text }, source)
    return true
  }

  function observeResponseContainers(onStableText: (text: string, element: Element) => void): void {
    let debounceTimer: number | null = null
    const pendingContainers = new Set<Element>()
    const shortReplyCandidates = new WeakMap<Element, { text: string; since: number }>()

    function trackShortReplyCandidate(container: Element): void {
      const text = siteAdapter.readResponseText(container)
      if (!isVeryShortReply(text)) {
        shortReplyCandidates.delete(container)
        return
      }

      const current = shortReplyCandidates.get(container)
      if (current?.text === text) return
      shortReplyCandidates.set(container, { text, since: Date.now() })
    }

    function shouldDeferShortReply(container: Element, text: string): boolean {
      if (!isVeryShortReply(text)) {
        shortReplyCandidates.delete(container)
        return false
      }

      const current = shortReplyCandidates.get(container)
      if (!current || current.text !== text) {
        shortReplyCandidates.set(container, { text, since: Date.now() })
        return true
      }

      const stableDuration = Date.now() - current.since
      if (stableDuration >= SHORT_REPLY_STABLE_SETTLE_MS) {
        shortReplyCandidates.delete(container)
        return false
      }

      log.debug('observer:defer-short', {
        stableDuration,
        textLength: text.length,
        normalizedLength: normalizedReplyLength(text),
      })
      return true
    }

    function flush(): void {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
        debounceTimer = null
      }

      const pendingCount = pendingContainers.size
      const containers = keepDeepestResponseContainers([...pendingContainers])
      const snapshots = containers.map(container => ({ container, text: siteAdapter.readResponseText(container) })).filter(snapshot => Boolean(snapshot.text))
      log.debug('observer:flush', { pending: pendingCount, kept: containers.length, snapshots: snapshots.length })
      pendingContainers.clear()

      window.setTimeout(() => {
        const generating = siteAdapter.isGenerating()
        for (const snapshot of snapshots) {
          if (!snapshot.container.isConnected) continue

          const text = siteAdapter.readResponseText(snapshot.container)
          if (!text) continue

          if (generating || text !== snapshot.text) {
            log.debug('observer:defer-unstable', {
              generating,
              previousLength: snapshot.text.length,
              currentLength: text.length,
            })
            schedule(snapshot.container)
            continue
          }

          if (shouldDeferShortReply(snapshot.container, text)) {
            schedule(snapshot.container)
            continue
          }

          log.debug('observer:stable', { textLength: text.length })
          onStableText(text, snapshot.container)
        }
      }, RESPONSE_FINAL_SETTLE_MS)
    }

    function schedule(container: Element): void {
      trackShortReplyCandidate(container)
      pendingContainers.add(container)

      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(flush, RESPONSE_DEBOUNCE_MS)
    }

    function inspectNode(node: Node): void {
      if (node.nodeType === Node.TEXT_NODE) {
        const container = siteAdapter.findResponseContainer((node as Text).parentElement)
        if (container) schedule(container)
        return
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return

      const element = node as Element
      const container = siteAdapter.findResponseContainer(element)
      if (container) {
        schedule(container)
        return
      }

      for (const responseContainer of siteAdapter.getResponseContainers()) {
        if (element.contains(responseContainer)) schedule(responseContainer)
      }
    }

    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          inspectNode(mutation.target)
          continue
        }

        mutation.addedNodes.forEach(inspectNode)
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true })

    requestAnimationFrame(() => {
      siteAdapter.getResponseContainers().forEach(schedule)
    })
  }

  function startReplyReporting(): void {
    observeResponseContainers((text, element) => {
      const assignedRole = roleSession.getAssignedRole()
      if (!assignedRole) return

      const messageId = roleSession.getActiveMessageId()
      if (!messageId) {
        log.debug('reply:skipped-no-active-message', { textLength: text.length, roleId: assignedRole.roleId })
        return
      }
      if (messageId && isPromptBaselineReply(text, element)) {
        log.debug('reply:skipped-baseline', { messageId, textLength: text.length, roleId: assignedRole.roleId })
        return
      }

      resolveReportableReplyText(siteAdapter, element, text, log)
        .then(reply => {
          const currentRole = roleSession.getAssignedRole()
          if (!currentRole) return
          if (!replyTracker.consumeIfNewForMessage(getConversationId(), reply.text, messageId)) {
            log.debug('reply:skipped', { messageId, textLength: reply.text.length, roleId: currentRole.roleId })
            return
          }
          reportAcceptedReply(messageId, reply, 'observer')
        })
        .catch(() => {
          const currentRole = roleSession.getAssignedRole()
          if (!currentRole) return
          if (!replyTracker.consumeIfNewForMessage(getConversationId(), text, messageId)) {
            log.debug('reply:skipped', { messageId, textLength: text.length, roleId: currentRole.roleId })
            return
          }
          reportAcceptedReply(messageId, { text }, 'observer')
        })
    })
  }

  function resetForAssignedRole(): void {
    clearPromptReplyBaseline()
    replyTimeout.clear()
    clearReplyPolling()
    replyTracker.seed(getConversationId(), siteAdapter.getAllAssistantReplies())
  }

  return {
    capturePromptReplyBaseline,
    clearPromptReplyBaseline,
    clearReplyPolling,
    startReplyPolling,
    startReplyReporting,
    seedStoredRoleReplies,
    resetForAssignedRole,
  }
}
