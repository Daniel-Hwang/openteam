import type { ChatSiteAdapter, ConversationSnapshot, SiteStatusInfo } from './types'
import { keepDeepestResponseContainers } from '../responseContainers'
import { findClickableCopyButton, readResponseTextFromCopyAction } from './clipboardCopy'
import { readEditorText, setContentEditableText } from './contentEditable'
import { extractMarkdownFromDom } from './domMarkdown'
import { buttonLabelMatches, describeElement, extractCleanTextFromDom, findClosestMatchingAncestor } from './domText'
import { isClickableButton, waitForClickableButton, waitForElement } from './waitForElement'

const CLAUDE_HOSTS = new Set(['claude.ai'])
const DEFAULT_INPUT_TIMEOUT_MS = 9000
const DEFAULT_CLIPBOARD_TIMEOUT_MS = 900
const DEFAULT_CLIPBOARD_POLL_MS = 40

const CLAUDE_SELECTORS = {
  editor: '[data-testid="chat-input"][contenteditable="true"], div[contenteditable="true"][aria-label*="Claude"]',
  sendButton:
    'button[aria-label*="Send"], button[aria-label*="发送"], button[aria-label*="Submit"], button[aria-label*="发送消息"]',
  response: '.font-claude-response',
  copyButton:
    'button[data-testid="action-bar-copy"], [role="group"][aria-label="Message actions"] button[aria-label="Copy"], button[aria-label="Copy"], button[aria-label="复制"]',
  blocker: '[role="dialog"], .cookie-banner, [aria-label*="Cookie"], [aria-label*="Consent"]',
  loginOverlay: 'div[role="dialog"] button[aria-label*="Sign in"], div[role="dialog"] button[aria-label*="登录"]',
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'TEXTAREA', 'SVG'])

interface ClaudeAdapterOptions {
  href?: string
  inputTimeoutMs?: number
  clipboardTimeoutMs?: number
  clipboardPollMs?: number
}

export function createClaudeAdapter(options: ClaudeAdapterOptions = {}): ChatSiteAdapter {
  const inputTimeoutMs = options.inputTimeoutMs ?? DEFAULT_INPUT_TIMEOUT_MS
  const clipboardTimeoutMs = options.clipboardTimeoutMs ?? DEFAULT_CLIPBOARD_TIMEOUT_MS
  const clipboardPollMs = options.clipboardPollMs ?? DEFAULT_CLIPBOARD_POLL_MS

  function currentHref(): string {
    return options.href ?? location.href
  }

  function getConversationSnapshot(): ConversationSnapshot {
    return getClaudeConversationLocation(currentHref())
  }

  function getConversationId(): string {
    return getConversationSnapshot().conversationId || '__default__'
  }

  function getResponseContainers(): Element[] {
    return [...document.querySelectorAll(CLAUDE_SELECTORS.response)]
  }

  function getAllAssistantReplies(): string[] {
    return keepDeepestResponseContainers(getResponseContainers()).map(container => extractCleanText(container)).filter(Boolean)
  }

  async function fillAndSend(content: string, autoSend = true): Promise<void> {
    const editor = await waitForElement(CLAUDE_SELECTORS.editor, inputTimeoutMs)

    setContentEditableText(editor, content)
    if (readEditorText(editor, { normalizeNbsp: true }) !== content.trim()) {
      throw new Error('Claude editor did not accept the prompt text')
    }

    if (!autoSend) return

    const sendButton = await waitForClickableButton(CLAUDE_SELECTORS.sendButton, inputTimeoutMs, 'Claude 发送按钮暂不可用，请稍后重试')
    sendButton.click()
  }

  return {
    id: 'claude',
    getConversationSnapshot,
    getConversationId,
    getResponseContainers,
    getAllAssistantReplies,
    readResponseText: extractCleanText,
    readResponseTextFromCopy: node => readResponseTextFromCopy(node, clipboardTimeoutMs, clipboardPollMs),
    readResponseMarkdown: extractMarkdownFromDom,
    findResponseContainer,
    isGenerating: isClaudeGenerating,
    checkStatus: checkClaudeStatus,
    stopGenerating: stopClaudeGenerating,
    fillAndSend,
    collectPromptDiagnostics,
  }
}

export function getClaudeConversationLocation(href: string): ConversationSnapshot {
  const url = parseSafeClaudeUrl(href)
  if (!url) return {}

  return {
    conversationId: extractConversationId(url),
    conversationUrl: url.href,
  }
}

function parseSafeClaudeUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value)
    return url.protocol === 'https:' && CLAUDE_HOSTS.has(url.hostname) ? url : undefined
  } catch {
    return undefined
  }
}

function extractConversationId(url: URL): string | undefined {
  if (!url.pathname.startsWith('/chat/')) return undefined

  const conversationId = url.pathname.slice('/chat/'.length).split('/')[0]
  return conversationId ? decodeURIComponent(conversationId) : undefined
}

function collectPromptDiagnostics(): Record<string, unknown> {
  return {
    href: location.href,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    title: document.title,
    editorMatches: [...document.querySelectorAll(CLAUDE_SELECTORS.editor)].slice(0, 5).map(describeElement),
    sendButtonMatches: [...document.querySelectorAll(CLAUDE_SELECTORS.sendButton)].slice(0, 5).map(describeElement),
    visibleButtonSamples: [...document.querySelectorAll('button')].slice(0, 12).map(describeElement),
  }
}

function extractCleanText(node: Node): string {
  return extractCleanTextFromDom(node, { skipTags: SKIP_TAGS })
}

function findResponseContainer(element: Element | null): Element | null {
  return findClosestMatchingAncestor(element, CLAUDE_SELECTORS.response)
}

async function readResponseTextFromCopy(node: Node, timeoutMs: number, pollMs: number): Promise<string | undefined> {
  return readResponseTextFromCopyAction({ node, timeoutMs, pollMs, findCopyButton })
}

function findCopyButton(response: Element): HTMLButtonElement | undefined {
  let scope: Element | null = response
  while (scope && scope !== document.body) {
    const copyButton = findClickableCopyButton(scope, CLAUDE_SELECTORS.copyButton)
    if (copyButton) return copyButton
    scope = scope.parentElement
  }

  return findClickableCopyButton(document.body, CLAUDE_SELECTORS.copyButton)
}

function isClaudeGenerating(): boolean {
  return Boolean(findClaudeStopButton())
}

async function stopClaudeGenerating(): Promise<boolean> {
  const button = findClaudeStopButton()
  if (!button) return false
  button.click()
  return true
}

function findClaudeStopButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => buttonLabelMatches(button, /stop|stopping|停止|中止/) && isClickableButton(button))
}

function checkClaudeStatus(): SiteStatusInfo {
  const timestamp = Date.now()

  if (location.pathname.includes('/login') || location.pathname.includes('/auth')) {
    return { status: 'unauthorized', detail: 'Session expired, please login', timestamp }
  }

  const editorExists = !!document.querySelector(CLAUDE_SELECTORS.editor)
  const blockerExists = !!document.querySelector(CLAUDE_SELECTORS.blocker)

  if (!editorExists && blockerExists) {
    return { status: 'blocked', detail: 'Cookie banner or overlay blocking access', timestamp }
  }

  if (document.querySelector(CLAUDE_SELECTORS.loginOverlay)) {
    return { status: 'unauthorized', detail: 'Login required', timestamp }
  }

  if (isClaudeGenerating()) {
    return { status: 'generating', detail: 'Claude is thinking...', timestamp }
  }

  return { status: 'ready', timestamp }
}
