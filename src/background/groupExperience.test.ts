import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CUSTOM_ROLE_TEMPLATES } from '../group/defaultCustomRoleTemplates'
import type { GroupChat, GroupMessage, GroupRole, OpenTeamStore, OrchestrationFlow, RoleTemplate } from '../group/types'

const defaultCustomTemplateIds = DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => template.id)

type RuntimeMessage = { type: string; [key: string]: unknown }
type MessageSender = chrome.runtime.MessageSender

type BackgroundHarness = {
  stored: Record<string, unknown>
  storeKey: string
  tabsSendMessage: ReturnType<typeof vi.fn>
  runtimeSendMessage: ReturnType<typeof vi.fn>
  getStore: () => Promise<OpenTeamStore>
  invoke: (message: RuntimeMessage, sender?: MessageSender) => Promise<unknown>
}

async function setupBackground(initialStore?: OpenTeamStore): Promise<BackgroundHarness> {
  vi.resetModules()
  const { STORE_KEY, createDefaultStore, loadStore } = await import('../group/store')
  const stored: Record<string, unknown> = {
    [STORE_KEY]: structuredClone(initialStore ?? createDefaultStore()),
  }
  const listeners: Array<(message: RuntimeMessage, sender: MessageSender, sendResponse: (response: unknown) => void) => boolean> = []
  const tabsSendMessage = vi.fn().mockResolvedValue({ ok: true })
  const runtimeSendMessage = vi.fn().mockResolvedValue({ ok: true })

  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn(listener => listeners.push(listener)) },
      sendMessage: runtimeSendMessage,
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    storage: {
      local: {
        get: vi.fn(async (key?: string | string[] | null) => {
          if (key === null || typeof key === 'undefined') {
            return structuredClone(stored)
          }
          if (Array.isArray(key)) {
            return Object.fromEntries(key.map(item => [item, structuredClone(stored[item])]))
          }
          return { [key]: structuredClone(stored[key]) }
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(stored, structuredClone(items))
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete stored[key]
          }
        }),
      },
    },
    tabs: {
      sendMessage: tabsSendMessage,
      create: vi.fn().mockResolvedValue({}),
      onRemoved: { addListener: vi.fn() },
    },
    action: {
      onClicked: { addListener: vi.fn() },
    },
  })

  await import('./index')
  expect(listeners).toHaveLength(1)

  return {
    stored,
    storeKey: STORE_KEY,
    tabsSendMessage,
    runtimeSendMessage,
    getStore: loadStore,
    invoke: (message, sender = { tab: { id: 900 } as chrome.tabs.Tab, frameId: 0, url: 'https://gemini.google.com/app/test' }) =>
      new Promise(resolve => {
        listeners[0](message, sender, resolve)
      }),
  }
}

describe('background group chat experience handlers', () => {
  it('validates GROUP_ROLES_CREATE_BATCH as a whole batch and keeps temporary people out of the library', async () => {
    const store = makeStore()
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatOrder = ['chat-1']
    store.roleTemplatesById['template-1'] = makeTemplate('template-1', '工程师', '从工程角度分析')
    store.roleTemplateOrder = ['template-1']
    const harness = await setupBackground(store)

    const rejected = await harness.invoke({
      type: 'GROUP_ROLES_CREATE_BATCH',
      chatId: 'chat-1',
      items: [
        { source: 'library', roleTemplateId: 'template-1' },
        { source: 'temporary', name: '', systemPrompt: 'invalid' },
      ],
    }) as { ok: boolean; error: string }

    expect(rejected.ok).toBe(false)
    expect(rejected.error).toBe('人员名称不能为空')
    const rejectedStore = await harness.getStore()
    expect(rejectedStore.chatsById['chat-1'].roleIds).toEqual([])
    expect(rejectedStore.rolesById).toEqual({})

    const accepted = await harness.invoke({
      type: 'GROUP_ROLES_CREATE_BATCH',
      chatId: 'chat-1',
      items: [
        { source: 'library', roleTemplateId: 'template-1', chatSite: 'chatgpt' },
        { source: 'temporary', name: '法务', description: '关注合规', systemPrompt: '从法务角度分析', chatSite: 'gemini' },
      ],
    }) as { ok: boolean; roles: GroupRole[]; store: OpenTeamStore }

    expect(accepted.ok).toBe(true)
    expect(accepted.roles).toHaveLength(2)
    expect(accepted.roles[0]).toMatchObject({ templateId: 'template-1', name: '工程师', systemPrompt: '从工程角度分析', chatSite: 'chatgpt' })
    expect(accepted.roles[1]).toMatchObject({ name: '法务', description: '关注合规', systemPrompt: '从法务角度分析', chatSite: 'gemini' })
    expect(accepted.roles[1].templateId).toBeUndefined()
    expect(accepted.store.roleTemplateOrder).toEqual(['template-1'])
    expect(Object.keys(accepted.store.roleTemplatesById)).toEqual(['template-1'])
  })

  it('protects used role templates from deletion and deletes unused templates', async () => {
    const store = makeStore()
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.roleTemplatesById['template-used'] = makeTemplate('template-used', '工程师', '工程人设')
    store.roleTemplatesById['template-unused'] = makeTemplate('template-unused', '产品', '产品人设')
    store.roleTemplateOrder = ['template-used', 'template-unused']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { templateId: 'template-used' })
    const harness = await setupBackground(store)

    const denied = await harness.invoke({ type: 'ROLE_TEMPLATE_DELETE', templateId: 'template-used' }) as { ok: boolean; error: string }
    expect(denied.ok).toBe(false)
    expect(denied.error).toBe('该人员库人员已被群聊使用，不能删除')
    const deniedStore = await harness.getStore()
    expect(deniedStore.roleTemplatesById['template-used']).toBeDefined()

    const deleted = await harness.invoke({ type: 'ROLE_TEMPLATE_DELETE', templateId: 'template-unused' }) as { ok: boolean; store: OpenTeamStore }
    expect(deleted.ok).toBe(true)
    expect(deleted.store.roleTemplatesById['template-unused']).toBeUndefined()
    expect(deleted.store.roleTemplateOrder).toEqual(['template-used'])
  })

  it('protects built-in role templates from update and delete commands', async () => {
    const store = makeStore()
    const harness = await setupBackground(store)

    const updateDenied = await harness.invoke({
      type: 'ROLE_TEMPLATE_UPDATE',
      templateId: 'builtin-frankl',
      name: '意义顾问',
      systemPrompt: '改写',
    }) as { ok: boolean; error: string }
    const deleteDenied = await harness.invoke({ type: 'ROLE_TEMPLATE_DELETE', templateId: 'builtin-frankl' }) as { ok: boolean; error: string }

    expect(updateDenied.ok).toBe(false)
    expect(updateDenied.error).toBe('系统内置人员不能编辑')
    expect(deleteDenied.ok).toBe(false)
    expect(deleteDenied.error).toBe('系统内置人员不能删除')
  })

  it('creates chat roles from built-in templates through the background batch command', async () => {
    const store = makeStore()
    store.settings.language = 'zh-CN'
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatOrder = ['chat-1']
    const harness = await setupBackground(store)

    const accepted = await harness.invoke({
      type: 'GROUP_ROLES_CREATE_BATCH',
      chatId: 'chat-1',
      items: [
        { source: 'library', roleTemplateId: 'builtin-frankl', chatSite: 'claude' },
      ],
    }) as { ok: boolean; roles: GroupRole[]; store: OpenTeamStore }

    expect(accepted.ok).toBe(true)
    expect(accepted.roles[0]).toMatchObject({
      templateId: 'builtin-frankl',
      name: '弗兰克尔',
      chatSite: 'claude',
      systemPrompt: expect.stringContaining('弗兰克尔式意义顾问'),
    })
    expect(accepted.store.roleTemplateOrder).toEqual(defaultCustomTemplateIds)
    expect(accepted.store.roleTemplatesById).toEqual(Object.fromEntries(DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => [template.id, template])))
  })

  it('creates localized built-in chat roles when the store language is English', async () => {
    const store = makeStore()
    store.settings.language = 'en'
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatOrder = ['chat-1']
    const harness = await setupBackground(store)

    const accepted = await harness.invoke({
      type: 'GROUP_ROLES_CREATE_BATCH',
      chatId: 'chat-1',
      items: [
        { source: 'library', roleTemplateId: 'builtin-frankl', chatSite: 'claude' },
      ],
    }) as { ok: boolean; roles: GroupRole[] }

    expect(accepted.ok).toBe(true)
    expect(accepted.roles[0]).toMatchObject({
      templateId: 'builtin-frankl',
      name: 'ViktorFrankl',
      chatSite: 'claude',
      systemPrompt: expect.stringContaining('Respond in English'),
    })
    expect(accepted.roles[0]?.systemPrompt).not.toContain('弗兰克尔')
  })

  it('saves rich note documents for global and chat scopes', async () => {
    const store = makeStore()
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatOrder = ['chat-1']
    const harness = await setupBackground(store)
    const globalNote = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '随手记录' }] }] }
    const chatNote = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '群聊沉淀' }] }] }

    const globalSaved = await harness.invoke({ type: 'GROUP_NOTE_SAVE', scope: 'global', content: globalNote }) as { ok: boolean; store: OpenTeamStore }
    const chatSaved = await harness.invoke({ type: 'GROUP_NOTE_SAVE', scope: 'chat', chatId: 'chat-1', content: chatNote }) as { ok: boolean; store: OpenTeamStore }

    expect(globalSaved.ok).toBe(true)
    expect(globalSaved.store.globalNote).toEqual(globalNote)
    expect(chatSaved.ok).toBe(true)
    expect(chatSaved.store.chatNotesById?.['chat-1']).toEqual(chatNote)
  })

  it('stores message highlights without changing the original message content', async () => {
    const store = makeStore()
    const chat = makeChat('chat-1')
    chat.messageIds = ['msg-1']
    chat.nextMessageSeq = 2
    store.chatsById['chat-1'] = chat
    store.chatOrder = ['chat-1']
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      content: '这里有一段重点内容',
      createdAt: 1,
      status: 'received',
    }
    const harness = await setupBackground(store)

    const response = await harness.invoke({
      type: 'GROUP_MESSAGE_HIGHLIGHT_CREATE',
      chatId: 'chat-1',
      messageId: 'msg-1',
      text: '重点',
      startOffset: 5,
      endOffset: 7,
      color: '#7dd3fc',
    }) as { ok: boolean; store: OpenTeamStore }

    expect(response.ok).toBe(true)
    expect(response.store.messagesById['msg-1'].content).toBe('这里有一段重点内容')
    expect(response.store.messageHighlightsById?.['msg-1']).toEqual([
      expect.objectContaining({
        messageId: 'msg-1',
        text: '重点',
        startOffset: 5,
        endOffset: 7,
        color: '#7dd3fc',
      }),
    ])
  })

  it('includes persona from description for legacy roles without systemPrompt on the first user message', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '调查记者', {
      description: '调查记者',
      systemPrompt: undefined,
    })
    const harness = await setupBackground(store)

    await harness.invoke(
      { type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900, conversationId: '__default__', conversationUrl: 'https://gemini.google.com/' },
      { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/' },
    )
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 你好' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(true)
    expect(prompt.content).toContain('You are "调查记者".')
    expect(prompt.content).toContain('Your responsibility:\n调查记者')
    expect(prompt.content).toContain('User message:\n你好')
  })

  it('includes persona on the first user message even after the frame reports Gemini home', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', {
      systemPrompt: '第一次必须发送的人设',
    })
    const harness = await setupBackground(store)

    await harness.invoke(
      { type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900, conversationId: '__default__', conversationUrl: 'https://gemini.google.com/' },
      { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/' },
    )
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 请评估这个方案' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(true)
    expect(prompt.content).toContain('第一次必须发送的人设')
    const storedAfterFirstPrompt = await harness.getStore()
    expect(storedAfterFirstPrompt.rolesById['role-1'].geminiConversationUrl).toBeUndefined()
    expect(storedAfterFirstPrompt.rolesById['role-1'].geminiConversationId).toBeUndefined()
  })

  it('does not repeat persona after the first prompt is acknowledged', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', {
      systemPrompt: '只需要首轮发送的人设',
    })
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/' })
    const first = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 第一条' }) as { ok: boolean; message: { id: string } }
    await harness.invoke({ type: 'TEAM_SEND_ACK', chatId: 'chat-1', roleId: 'role-1', messageId: first.message.id })
    await harness.invoke({ type: 'TEAM_ROLE_REPLY', chatId: 'chat-1', roleId: 'role-1', messageId: first.message.id, content: '第一条回复' })
    const second = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 第二条' }) as { ok: boolean }

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(2)
    expect(promptCalls[0][1].includesPersona).toBe(true)
    expect(promptCalls[0][1].content).toContain('只需要首轮发送的人设')
    expect(promptCalls[1][1].includesPersona).toBe(false)
    expect(promptCalls[1][1].content).not.toContain('只需要首轮发送的人设')
  })

  it('includes persona on the first real user message after a template welcome message', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = {
      ...makeChat('chat-1', ['role-1']),
      messageIds: ['msg-welcome'],
      nextMessageSeq: 2,
    }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '需求产品经理', {
      systemPrompt: '模板人设：先澄清需求，再拆解可执行方案。',
    })
    store.messagesById['msg-welcome'] = {
      id: 'msg-welcome',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      roleId: 'role-1',
      roleName: '需求产品经理',
      content: '## 欢迎来到「产品评审群」\n\n你可以先问这些问题。',
      contentFormat: 'markdown',
      createdAt: 1,
      status: 'received',
    } satisfies GroupMessage
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 帮我评审这个需求' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(true)
    expect(prompt.content).toContain('模板人设：先澄清需求，再拆解可执行方案。')
    expect(prompt.content).toContain('帮我评审这个需求')
  })

  it('does not treat a locally inserted template opener as delivered persona history', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = {
      ...makeChat('chat-1', ['role-1']),
      messageIds: ['msg-template-opener'],
      nextMessageSeq: 2,
    }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '需求产品经理', {
      systemPrompt: '模板人设：负责澄清需求、拆解范围和识别交付风险。',
    })
    store.messagesById['msg-template-opener'] = {
      id: 'msg-template-opener',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '## 欢迎来到「产品评审群」\n\n你可以先问这些问题。',
      contentFormat: 'markdown',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'received',
    } satisfies GroupMessage
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@需求产品经理 继续评审这个需求' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(true)
    expect(prompt.content).toContain('模板人设：负责澄清需求、拆解范围和识别交付风险。')
    expect(prompt.content).toContain('继续评审这个需求')
  })

  it('includes persona on the first local user message even when the frame has an active Gemini conversation', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', {
      systemPrompt: '这是首次本地对话必须发送的人设。',
      geminiConversationUrl: 'https://gemini.google.com/app/existing-conversation',
      geminiConversationId: 'existing-conversation',
    })
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/existing-conversation' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 请评估这个方案' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(true)
    expect(prompt.content).toContain('这是首次本地对话必须发送的人设。')
    expect(prompt.content).toContain('请评估这个方案')
  })

  it('includes persona when the role cursor is stale but there is no local message history', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', {
      contextCursor: 3,
      systemPrompt: '没有本地历史时仍必须发送的人设。',
    })
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 你好' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(true)
    expect(prompt.content).toContain('没有本地历史时仍必须发送的人设。')
  })

  it('skips full persona in ordinary prompts after the role already has local history', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2 }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', {
      contextCursor: 1,
      systemPrompt: '这是一段很长的人设，普通消息不应重复发送。',
      geminiConversationUrl: 'https://gemini.google.com/app/existing-conversation',
      geminiConversationId: 'existing-conversation',
    })
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '历史消息',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'sent',
      deliveryStatus: { 'role-1': 'sent' },
    }
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/existing-conversation' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 请评估这个方案' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(false)
    expect(prompt.content).toContain('请评估这个方案')
    expect(prompt.content).not.toContain('这是一段很长的人设')
  })

  it('does not replay another role target message when a role receives its first direct prompt', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-eng', 'role-pm']), mode: 'collaborative' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-eng'] = makeRole('chat-1', 'role-eng', '工程师')
    store.rolesById['role-pm'] = makeRole('chat-1', 'role-pm', '产品经理')
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-eng', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test-eng' })
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-pm', hostTabId: 900 }, { tab: { id: 102 } as chrome.tabs.Tab, frameId: 8, url: 'https://gemini.google.com/app/test-pm' })
    await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@工程师 第一条只给工程师的问题' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@产品经理 第二条只给产品经理的问题' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(2)
    const productPrompt = promptCalls[1][1]
    expect(productPrompt.roleId).toBe('role-pm')
    expect(productPrompt.content).toContain('第二条只给产品经理的问题')
    expect(productPrompt.content).not.toContain('第一条只给工程师的问题')
  })

  it('waits for Deepseek replies before sending the next two prompts', async () => {
    const roleIds = ['role-1', 'role-2', 'role-3', 'role-4']
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', roleIds)
    store.chatOrder = ['chat-1']
    roleIds.forEach((roleId, index) => {
      store.rolesById[roleId] = makeRole('chat-1', roleId, `Deepseek ${index + 1}`, { chatSite: 'deepseek' })
    })
    const harness = await setupBackground(store)

    for (const [index, roleId] of roleIds.entries()) {
      await harness.invoke(
        { type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId, hostTabId: 900 },
        { tab: { id: 101 + index } as chrome.tabs.Tab, frameId: 7 + index, url: `https://chat.deepseek.com/a/chat/s/${roleId}` },
      )
    }

    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 请一起评估这个方案' }) as { ok: boolean; message: { id: string } }

    expect(response.ok).toBe(true)
    expect(promptRoleIds(harness)).toEqual(['role-1', 'role-2'])

    await harness.invoke({ type: 'TEAM_ROLE_REPLY', chatId: 'chat-1', roleId: 'role-1', messageId: response.message.id, content: '第一位回复' })
    expect(promptRoleIds(harness)).toEqual(['role-1', 'role-2', 'role-3'])

    await harness.invoke({ type: 'TEAM_ROLE_REPLY', chatId: 'chat-1', roleId: 'role-2', messageId: response.message.id, content: '第二位回复' })
    await waitForPromptCallCount(harness, 4)
    expect(promptRoleIds(harness)).toEqual(roleIds)
  })

  it('marks delivery error when a prompt response is explicitly rejected', async () => {
    vi.useFakeTimers()
    try {
      const store = makeStore()
      store.currentChatId = 'chat-1'
      store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
      store.chatOrder = ['chat-1']
      store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
      const harness = await setupBackground(store)
      harness.tabsSendMessage.mockImplementation((_tabId, message) => Promise.resolve(
        message?.type === 'TEAM_SEND_PROMPT' ? { ok: false, error: 'Gemini 输入框不可用' } : { ok: true },
      ))

      await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
      const responsePromise = harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 请评估这个方案' }) as Promise<{ ok: boolean; message: { id: string } }>
      await vi.advanceTimersByTimeAsync(31_000)
      const response = await responsePromise

      expect(response.ok).toBe(true)
      const stored = await harness.getStore()
      expect(stored.messagesById[response.message.id].status).toBe('error')
      expect(stored.messagesById[response.message.id].deliveryStatus?.['role-1']).toBe('error')
      expect(stored.rolesById['role-1'].status).toBe('error')
      expect(stored.chatsById['chat-1'].status).toBe('error')
    } finally {
      vi.useRealTimers()
    }
  })

  it('still sends to available people when another targeted person is unavailable', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1', 'role-2'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    store.rolesById['role-2'] = makeRole('chat-1', 'role-2', '产品经理')
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@all 请评估这个方案' }) as { ok: boolean; message: { id: string }; store: OpenTeamStore }

    expect(response.ok).toBe(true)
    expect(promptRoleIds(harness)).toEqual(['role-1'])
    expect(response.store.messagesById[response.message.id].deliveryStatus).toEqual({
      'role-1': 'pending',
      'role-2': 'error',
    })
    expect(response.store.rolesById['role-1'].status).toBe('thinking')
    expect(response.store.rolesById['role-2'].status).toBe('error')
    expect(response.store.chatsById['chat-1'].status).toBe('running')
  })

  it('advances context cursor only to the acknowledged prompt message', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1', 'msg-2'], nextMessageSeq: 3 }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '第一条',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'pending',
      deliveryStatus: { 'role-1': 'pending' },
    }
    store.messagesById['msg-2'] = {
      id: 'msg-2',
      chatId: 'chat-1',
      seq: 2,
      type: 'user',
      content: '后续消息',
      targetRoleIds: ['role-1'],
      createdAt: 2,
      status: 'pending',
      deliveryStatus: { 'role-1': 'pending' },
    }
    const harness = await setupBackground(store)

    const response = await harness.invoke({ type: 'TEAM_SEND_ACK', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(response.ok).toBe(true)
    expect(response.store.rolesById['role-1'].contextCursor).toBe(1)
    expect(response.store.messagesById['msg-1'].deliveryStatus?.['role-1']).toBe('sent')
  })

  it('stores explicit mentions for display while sending the cleaned message content', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@工程师 请评估这个方案' }) as { ok: boolean; store: OpenTeamStore }

    expect(response.ok).toBe(true)
    const messageId = response.store.chatsById['chat-1'].messageIds[0]
    expect(response.store.messagesById[messageId]).toMatchObject({
      type: 'user',
      content: '请评估这个方案',
      targetRoleIds: ['role-1'],
      mentionedRoleIds: ['role-1'],
    })
  })

  it('records no-mention ordinary chat messages without triggering AI', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    harness.tabsSendMessage.mockClear()
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '先记录这个背景' }) as { ok: boolean; store: OpenTeamStore }

    expect(response.ok).toBe(true)
    expect(response.store.chatsById['chat-1'].messageIds).toHaveLength(1)
    const messageId = response.store.chatsById['chat-1'].messageIds[0]
    expect(response.store.messagesById[messageId]).toMatchObject({
      type: 'user',
      content: '先记录这个背景',
      targetRoleIds: [],
      mentionedRoleIds: [],
      deliveryStatus: {},
      status: 'received',
    })
    expect(harness.tabsSendMessage.mock.calls.some(call => call[1]?.type === 'TEAM_SEND_PROMPT')).toBe(false)
    expect(response.store.rolesById['role-1'].status).not.toBe('thinking')
  })

  it('renames chats, marks background replies as new, and clears new-message state when read', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatsById['chat-2'] = { ...makeChat('chat-2', ['role-2']), messageIds: ['msg-user'], nextMessageSeq: 2, status: 'running' }
    store.chatOrder = ['chat-1', 'chat-2']
    store.rolesById['role-2'] = makeRole('chat-2', 'role-2', '产品经理', { status: 'thinking', lastPromptMessageId: 'msg-user' })
    store.messagesById['msg-user'] = {
      id: 'msg-user',
      chatId: 'chat-2',
      seq: 1,
      type: 'user',
      content: '后台问题',
      targetRoleIds: ['role-2'],
      createdAt: 1,
      status: 'sent',
      deliveryStatus: { 'role-2': 'sent' },
    }
    const harness = await setupBackground(store)

    const reply = await harness.invoke({ type: 'TEAM_ROLE_REPLY', chatId: 'chat-2', roleId: 'role-2', content: '后台回复', messageId: 'msg-user' }) as { ok: boolean; store: OpenTeamStore }
    expect(reply.ok).toBe(true)
    const chatTwoMessageId = reply.store.chatsById['chat-2'].messageIds[1]
    expect(reply.store.messagesById[chatTwoMessageId]).toMatchObject({ chatId: 'chat-2', type: 'assistant', content: '后台回复' })
    expect(reply.store.viewState?.chatHasNewMessageById?.['chat-2']).toBe(true)

    const renamed = await harness.invoke({ type: 'GROUP_CHAT_UPDATE', chatId: 'chat-2', patch: { name: '增长讨论', description: '新描述' } }) as { ok: boolean; chat: GroupChat }
    expect(renamed.ok).toBe(true)
    expect(renamed.chat).toMatchObject({ id: 'chat-2', name: '增长讨论', description: '新描述' })

    const markedRead = await harness.invoke({ type: 'GROUP_CHAT_MARK_READ', chatId: 'chat-2' }) as { ok: boolean; store: OpenTeamStore }
    expect(markedRead.ok).toBe(true)
    expect(markedRead.store.viewState?.chatReadSeqById?.['chat-2']).toBe(markedRead.store.chatsById['chat-2'].nextMessageSeq - 1)
    expect(markedRead.store.viewState?.chatHasNewMessageById?.['chat-2']).toBeUndefined()
  })

  it('stores copied ChatGPT replies as markdown-formatted assistant messages', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-user'], nextMessageSeq: 2, status: 'running' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '产品经理', { status: 'thinking', lastPromptMessageId: 'msg-user' })
    store.messagesById['msg-user'] = {
      id: 'msg-user',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '请给出方案',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'sent',
      deliveryStatus: { 'role-1': 'sent' },
    }
    const harness = await setupBackground(store)

    const reply = await harness.invoke({
      type: 'TEAM_ROLE_REPLY',
      chatId: 'chat-1',
      roleId: 'role-1',
      content: '**结论**\n\n- 可以做',
      contentFormat: 'markdown',
      messageId: 'msg-user',
    }) as { ok: boolean; store: OpenTeamStore }

    expect(reply.ok).toBe(true)
    const replyMessageId = reply.store.chatsById['chat-1'].messageIds[1]
    expect(reply.store.messagesById[replyMessageId]).toMatchObject({
      type: 'assistant',
      content: '**结论**\n\n- 可以做',
      contentFormat: 'markdown',
    })
  })

  it('duplicates a chat with copied roles but without messages or Gemini conversation bindings', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = {
      ...makeChat('chat-1', ['role-1', 'role-2']),
      name: '新闻调查组',
      description: '用于调查类讨论',
      mode: 'collaborative',
      messageIds: ['msg-1'],
      nextMessageSeq: 2,
      requireManualMention: true,
    }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '调查记者', {
      templateId: 'template-1',
      description: '查事实',
      avatarColor: '#123456',
      contextCursor: 3,
      geminiConversationId: 'conversation-1',
      geminiConversationUrl: 'https://gemini.google.com/app/conversation-1',
      lastPromptMessageId: 'msg-1',
      lastReplyAt: 20,
    })
    store.rolesById['role-2'] = makeRole('chat-1', 'role-2', '财务分析师')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '历史问题',
      createdAt: 1,
      status: 'sent',
    }
    const harness = await setupBackground(store)

    const duplicated = await harness.invoke({ type: 'GROUP_CHAT_DUPLICATE', chatId: 'chat-1' }) as { ok: boolean; chat: GroupChat; roles: GroupRole[]; store: OpenTeamStore }

    expect(duplicated.ok).toBe(true)
    expect(duplicated.chat).toMatchObject({
      name: '新闻调查组 副本',
      description: '用于调查类讨论',
      mode: 'collaborative',
      messageIds: [],
      nextMessageSeq: 1,
      status: 'initializing',
      requireManualMention: true,
    })
    expect(duplicated.chat.id).not.toBe('chat-1')
    expect(duplicated.store.currentChatId).toBe(duplicated.chat.id)
    expect(duplicated.store.chatOrder[0]).toBe(duplicated.chat.id)
    expect(duplicated.chat.roleIds).toHaveLength(2)
    expect(duplicated.roles.map(role => role.name)).toEqual(['调查记者', '财务分析师'])

    const copiedReporter = duplicated.roles[0]
    expect(copiedReporter).toMatchObject({
      chatId: duplicated.chat.id,
      templateId: 'template-1',
      name: '调查记者',
      description: '查事实',
      systemPrompt: '调查记者人设',
      avatarColor: '#123456',
      status: 'pending',
      contextCursor: 0,
    })
    expect(copiedReporter.id).not.toBe('role-1')
    expect(copiedReporter.geminiConversationId).toBeUndefined()
    expect(copiedReporter.geminiConversationUrl).toBeUndefined()
    expect(copiedReporter.lastPromptMessageId).toBeUndefined()
    expect(copiedReporter.lastReplyAt).toBeUndefined()
    expect(duplicated.store.messagesById['msg-1']).toBeDefined()
    expect(duplicated.store.chatsById['chat-1'].messageIds).toEqual(['msg-1'])
  })

  it('duplicates effective model bindings and remaps orchestration flows to copied roles', async () => {
    const store = makeStore()
    store.settings.defaultChatSite = 'gemini'
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = {
      ...makeChat('chat-1', ['role-1', 'role-2']),
      name: '编排写作组',
      mode: 'collaborative',
    }
    store.chatOrder = ['chat-1']
    store.roleTemplatesById['template-site'] = {
      ...makeTemplate('template-site', '站点模板', '站点模板人设'),
      defaultChatSite: 'chatgpt',
    }
    store.roleTemplatesById['template-external'] = {
      ...makeTemplate('template-external', 'API 模板', 'API 模板人设'),
      defaultModelSource: 'external',
      defaultExternalModelId: 'external-model-1',
    }
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '写手', { templateId: 'template-site' })
    store.rolesById['role-2'] = makeRole('chat-1', 'role-2', '审核', { templateId: 'template-external' })
    const flow: OrchestrationFlow = {
      id: 'flow-1',
      chatId: 'chat-1',
      name: '写作流程',
      stages: [
        { id: 'stage-1', kind: 'roles', name: '写初稿', roleIds: ['role-1'], position: { x: 10, y: 20 } },
        { id: 'stage-2', kind: 'review', name: '审核', roleIds: ['role-2'], review: { reviewerRoleIds: ['role-2'], instructions: '检查事实' } },
      ],
      graph: {
        stageNodes: [
          { id: 'stage-1', kind: 'roles', name: '写初稿', roleIds: ['role-1'], position: { x: 10, y: 20 } },
          { id: 'stage-2', kind: 'review', name: '审核', roleIds: ['role-2'], review: { reviewerRoleIds: ['role-2'], instructions: '检查事实' } },
        ],
        edges: [{ sourceStageId: 'stage-1', targetStageId: 'stage-2', vertices: [{ x: 30, y: 40 }] }],
      },
      autoPlanHistory: [{ id: 'history-1', role: 'user', content: '写一篇文章', createdAt: 2 }],
      maxRounds: 2,
      createdAt: 2,
      updatedAt: 3,
    }
    store.orchestrationFlowsById[flow.id] = flow
    store.orchestrationFlowOrderByChatId['chat-1'] = [flow.id]
    const harness = await setupBackground(store)

    const duplicated = await harness.invoke({ type: 'GROUP_CHAT_DUPLICATE', chatId: 'chat-1' }) as { ok: boolean; chat: GroupChat; roles: GroupRole[]; store: OpenTeamStore }

    const [copiedWriter, copiedReviewer] = duplicated.roles
    expect(copiedWriter).toMatchObject({ modelSource: 'site', chatSite: 'chatgpt' })
    expect(copiedWriter.externalModelId).toBeUndefined()
    expect(copiedReviewer).toMatchObject({ modelSource: 'external', externalModelId: 'external-model-1' })
    expect(copiedReviewer.chatSite).toBeUndefined()

    const copiedFlowIds = duplicated.store.orchestrationFlowOrderByChatId[duplicated.chat.id]
    expect(copiedFlowIds).toHaveLength(1)
    const copiedFlow = duplicated.store.orchestrationFlowsById[copiedFlowIds[0]]
    expect(copiedFlow).toMatchObject({
      chatId: duplicated.chat.id,
      name: '写作流程',
      maxRounds: 2,
    })
    expect(copiedFlow.id).not.toBe(flow.id)
    expect(copiedFlow.stages[0].roleIds).toEqual([copiedWriter.id])
    expect(copiedFlow.stages[1].roleIds).toEqual([copiedReviewer.id])
    expect(copiedFlow.stages[1].review?.reviewerRoleIds).toEqual([copiedReviewer.id])
    expect(copiedFlow.graph?.stageNodes[0].roleIds).toEqual([copiedWriter.id])
    expect(copiedFlow.graph?.stageNodes[1].roleIds).toEqual([copiedReviewer.id])
    expect(copiedFlow.graph?.stageNodes[1].review?.reviewerRoleIds).toEqual([copiedReviewer.id])
    expect(copiedFlow.graph?.edges).toEqual(flow.graph?.edges)
    expect(copiedFlow.autoPlanHistory).toEqual(flow.autoPlanHistory)
    expect(duplicated.store.orchestrationFlowsById[flow.id].stages[0].roleIds).toEqual(['role-1'])
  })

  it('deletes a chat with its roles, messages, read state, and runtime bindings', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2 }
    store.chatsById['chat-2'] = makeChat('chat-2')
    store.chatOrder = ['chat-1', 'chat-2']
    store.chatNotesById = { 'chat-1': { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '保留的笔记' }] }] } }
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '程序员')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      roleId: 'role-1',
      roleName: '程序员',
      content: '历史消息',
      createdAt: 1,
      status: 'received',
    }
    store.viewState = {
      chatReadSeqById: { 'chat-1': 1 },
      chatHasNewMessageById: { 'chat-1': true },
    }
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const deleted = await harness.invoke({ type: 'GROUP_CHAT_DELETE', chatId: 'chat-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(deleted.ok).toBe(true)
    expect(deleted.store.chatsById['chat-1']).toBeUndefined()
    expect(deleted.store.rolesById['role-1']).toBeUndefined()
    expect(deleted.store.messagesById['msg-1']).toBeUndefined()
    expect(deleted.store.chatOrder).toEqual(['chat-2'])
    expect(deleted.store.currentChatId).toBe('chat-2')
    expect(deleted.store.viewState?.chatReadSeqById?.['chat-1']).toBeUndefined()
    expect(deleted.store.viewState?.chatHasNewMessageById?.['chat-1']).toBeUndefined()
    expect(deleted.store.chatNotesById?.['chat-1']).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '保留的笔记' }] }] })
    const snapshot = await harness.invoke({ type: 'GROUP_STORE_GET' }) as { bindings: unknown[] }
    expect(snapshot.bindings).toEqual([])
  })

  it('returns stored role replies during frame ready so reloaded iframes can ignore restored DOM history', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1', 'role-2']), messageIds: ['msg-1', 'msg-2', 'msg-3'], nextMessageSeq: 4 }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '调查记者')
    store.rolesById['role-2'] = makeRole('chat-1', 'role-2', '产品经理')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      roleId: 'role-1',
      roleName: '调查记者',
      content: '初始化时的旧回复',
      createdAt: 1,
      status: 'received',
    }
    store.messagesById['msg-2'] = {
      id: 'msg-2',
      chatId: 'chat-1',
      seq: 2,
      type: 'assistant',
      roleId: 'role-2',
      roleName: '产品经理',
      content: '其他角色的回复',
      createdAt: 2,
      status: 'received',
    }
    store.messagesById['msg-3'] = {
      id: 'msg-3',
      chatId: 'chat-1',
      seq: 3,
      type: 'user',
      content: '用户问题',
      targetRoleIds: ['role-1'],
      createdAt: 3,
      status: 'sent',
    }
    const harness = await setupBackground(store)

    const ready = await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }) as { ok: boolean; replyHistory: string[] }

    expect(ready.ok).toBe(true)
    expect(ready.replyHistory).toEqual(['初始化时的旧回复'])
  })

  it('ignores stale role replies that do not match the current pending prompt', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-old', 'msg-current'], nextMessageSeq: 3, status: 'running' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { status: 'thinking', lastPromptMessageId: 'msg-current' })
    store.messagesById['msg-old'] = {
      id: 'msg-old',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '初始化问题',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'received',
      deliveryStatus: { 'role-1': 'received' },
    }
    store.messagesById['msg-current'] = {
      id: 'msg-current',
      chatId: 'chat-1',
      seq: 2,
      type: 'user',
      content: '新的问题',
      targetRoleIds: ['role-1'],
      createdAt: 2,
      status: 'sent',
      deliveryStatus: { 'role-1': 'sent' },
    }
    const harness = await setupBackground(store)

    const stale = await harness.invoke({ type: 'TEAM_ROLE_REPLY', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-old', content: '旧初始化回复' }) as { ok: boolean; ignored?: boolean; store: OpenTeamStore }

    expect(stale.ok).toBe(true)
    expect(stale.ignored).toBe(true)
    expect(stale.store.chatsById['chat-1'].messageIds).toEqual(['msg-old', 'msg-current'])
    expect(stale.store.messagesById['msg-current'].deliveryStatus?.['role-1']).toBe('sent')
    expect(stale.store.rolesById['role-1'].status).toBe('thinking')
    expect(stale.store.rolesById['role-1'].lastPromptMessageId).toBe('msg-current')
  })

  it('does not push the switched store back to the tab that already receives the command response', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatsById['chat-2'] = { ...makeChat('chat-2'), messageIds: ['msg-1'], nextMessageSeq: 2 }
    store.chatOrder = ['chat-1', 'chat-2']
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-2',
      seq: 1,
      type: 'assistant',
      roleName: '产品经理',
      content: '后台回复',
      createdAt: 1,
      status: 'sent',
    }
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'GROUP_STORE_GET' }, { tab: { id: 900 } as chrome.tabs.Tab, frameId: 0 })
    await harness.invoke({ type: 'GROUP_STORE_GET' }, { tab: { id: 901 } as chrome.tabs.Tab, frameId: 0 })
    harness.tabsSendMessage.mockClear()
    const switched = await harness.invoke({ type: 'GROUP_CHAT_SWITCH', chatId: 'chat-2' }, { tab: { id: 900 } as chrome.tabs.Tab, frameId: 0 }) as { ok: boolean; store: OpenTeamStore }

    expect(switched.ok).toBe(true)
    expect(switched.store.currentChatId).toBe('chat-2')
    expect(harness.tabsSendMessage).toHaveBeenCalledTimes(1)
    expect(harness.tabsSendMessage.mock.calls[0][0]).toBe(901)
  })

  it('marks timed-out personnel errors and delivery status through TEAM_ROLE_ERROR', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2, status: 'running' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { status: 'thinking', lastPromptMessageId: 'msg-1' })
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '请分析',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'pending',
      deliveryStatus: { 'role-1': 'pending' },
    }
    const harness = await setupBackground(store)

    const result = await harness.invoke({ type: 'TEAM_ROLE_ERROR', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-1', reason: '人员回复超时' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.rolesById['role-1'].status).toBe('error')
    expect(result.store.rolesById['role-1'].lastPromptMessageId).toBeUndefined()
    expect(result.store.messagesById['msg-1'].status).toBe('error')
    expect(result.store.messagesById['msg-1'].deliveryStatus?.['role-1']).toBe('error')
    expect(result.store.chatsById['chat-1'].status).toBe('error')
    expect(result.store.chatsById['chat-1'].messageIds).toHaveLength(2)
    const timeoutReplyId = result.store.chatsById['chat-1'].messageIds[1]
    expect(result.store.messagesById[timeoutReplyId]).toMatchObject({
      chatId: 'chat-1',
      seq: 2,
      type: 'assistant',
      roleId: 'role-1',
      roleName: '工程师',
      status: 'error',
      contentFormat: 'markdown',
    })
    expect(result.store.messagesById[timeoutReplyId].content).toContain('回复超时')
    expect(result.store.messagesById[timeoutReplyId].content).toContain('重新回复')
  })

  it('retries a visible timed-out site reply from its assistant message', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1', 'msg-timeout'], nextMessageSeq: 3, status: 'error' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { status: 'error' })
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '请分析',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'error',
      deliveryStatus: { 'role-1': 'error' },
    }
    store.messagesById['msg-timeout'] = {
      id: 'msg-timeout',
      chatId: 'chat-1',
      seq: 2,
      type: 'assistant',
      content: '回复超时了。\n\n可以点击下方的重新回复按钮再试一次。',
      contentFormat: 'markdown',
      roleId: 'role-1',
      roleName: '工程师',
      createdAt: 2,
      status: 'error',
    }
    const harness = await setupBackground(store)
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/abc' })

    const result = await harness.invoke({ type: 'GROUP_ROLE_RETRY_REPLY', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-timeout' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.messagesById['msg-timeout']).toBeUndefined()
    expect(result.store.chatsById['chat-1'].messageIds).toEqual(['msg-1'])
    expect(result.store.rolesById['role-1'].status).toBe('thinking')
    expect(result.store.rolesById['role-1'].lastPromptMessageId).toBe('msg-1')
    expect(result.store.messagesById['msg-1'].status).toBe('pending')
    expect(result.store.messagesById['msg-1'].deliveryStatus?.['role-1']).toBe('pending')
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0][1].messageId).toBe('msg-1')
    expect(promptCalls[0][1].content).toContain('请分析')
  })

  it('clears chat messages and unbinds role conversations without deleting roles', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2, status: 'ready' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', {
      contextCursor: 1,
      geminiConversationUrl: 'https://gemini.google.com/app/abc',
      geminiConversationId: 'abc',
    })
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      content: '旧回复',
      roleId: 'role-1',
      roleName: '工程师',
      createdAt: 1,
      status: 'received',
    }
    const harness = await setupBackground(store)
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/abc' })

    const result = await harness.invoke({ type: 'GROUP_CHAT_CLEAR_MESSAGES', chatId: 'chat-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.chatsById['chat-1'].messageIds).toEqual([])
    expect(result.store.chatsById['chat-1'].nextMessageSeq).toBe(1)
    expect(result.store.messagesById['msg-1']).toBeUndefined()
    expect(result.store.rolesById['role-1']).toMatchObject({ status: 'loading', contextCursor: 0 })
    expect(result.store.rolesById['role-1'].geminiConversationUrl).toBeUndefined()
    expect(result.store.rolesById['role-1'].geminiConversationId).toBeUndefined()
  })

  it('closes a chat by clearing runtime bindings while keeping the chat data', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2, status: 'ready' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '保留的消息',
      createdAt: 1,
      status: 'received',
    }
    const harness = await setupBackground(store)
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/abc' })

    const result = await harness.invoke({ type: 'GROUP_CHAT_CLOSE', chatId: 'chat-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.chatsById['chat-1'].messageIds).toEqual(['msg-1'])
    expect(result.store.rolesById['role-1'].status).toBe('loading')
    const snapshot = await harness.invoke({ type: 'GROUP_STORE_GET' }) as { bindings: unknown[] }
    expect(snapshot.bindings).toEqual([])
  })

  it('retries an interrupted role reply with a new attempt id for the pending user message', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2, status: 'running' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { status: 'thinking', lastPromptMessageId: 'msg-1', replyAttemptId: 'attempt-old' })
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '请分析',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'pending',
      deliveryStatus: { 'role-1': 'sent' },
    }
    const harness = await setupBackground(store)
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/abc' })

    const result = await harness.invoke({ type: 'GROUP_ROLE_RETRY_REPLY', chatId: 'chat-1', roleId: 'role-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.rolesById['role-1'].status).toBe('thinking')
    expect(result.store.rolesById['role-1'].lastPromptMessageId).toBe('msg-1')
    expect(result.store.rolesById['role-1'].replyAttemptId).toMatch(/^attempt-/)
    expect(result.store.rolesById['role-1'].replyAttemptId).not.toBe('attempt-old')
    expect(result.store.messagesById['msg-1'].deliveryStatus?.['role-1']).toBe('pending')
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0][1].messageId).toBe('msg-1')
    expect(promptCalls[0][1].replyAttemptId).toBe(result.store.rolesById['role-1'].replyAttemptId)
  })

  it('prefers the requested retry message over a stale role prompt pointer', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-first', 'msg-current'], nextMessageSeq: 3, status: 'running' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { status: 'thinking', lastPromptMessageId: 'msg-first', replyAttemptId: 'attempt-stale' })
    store.messagesById['msg-first'] = {
      id: 'msg-first',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '第一条消息',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'received',
      deliveryStatus: { 'role-1': 'received' },
    }
    store.messagesById['msg-current'] = {
      id: 'msg-current',
      chatId: 'chat-1',
      seq: 2,
      type: 'user',
      content: '现在真正要回复的问题',
      targetRoleIds: ['role-1'],
      createdAt: 2,
      status: 'sent',
      deliveryStatus: { 'role-1': 'sent' },
    }
    const harness = await setupBackground(store)
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/abc' })

    const result = await harness.invoke({ type: 'GROUP_ROLE_RETRY_REPLY', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-current' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.rolesById['role-1'].lastPromptMessageId).toBe('msg-current')
    expect(result.store.rolesById['role-1'].replyAttemptId).toMatch(/^attempt-/)
    expect(result.store.rolesById['role-1'].replyAttemptId).not.toBe('attempt-stale')
    expect(result.store.messagesById['msg-current'].deliveryStatus?.['role-1']).toBe('pending')
    expect(result.store.messagesById['msg-first'].deliveryStatus?.['role-1']).toBe('received')
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0][1].messageId).toBe('msg-current')
    expect(promptCalls[0][1].content).toContain('现在真正要回复的问题')
    expect(promptCalls[0][1].content).not.toContain('用户最新消息：\n第一条消息')
  })

  it('asks the role frame to resync the selected assistant reply and returns the updated store', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2 }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      roleId: 'role-1',
      roleName: '工程师',
      content: '漏了一半',
      createdAt: 1,
      status: 'received',
    }
    const harness = await setupBackground(store)
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://chatgpt.com/c/abc' })
    const updatedStore = structuredClone(store)
    updatedStore.messagesById['msg-1'].content = '完整回复'
    harness.tabsSendMessage.mockResolvedValueOnce({ ok: true, store: updatedStore, message: updatedStore.messagesById['msg-1'] })

    const result = await harness.invoke({ type: 'GROUP_MESSAGE_RESYNC_REPLY', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.messagesById['msg-1'].content).toBe('完整回复')
    const resyncCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_RESYNC_REPLY')
    expect(resyncCalls).toHaveLength(1)
    expect(resyncCalls[0][1]).toMatchObject({ type: 'TEAM_RESYNC_REPLY', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-1', currentContent: '漏了一半' })
    expect(harness.tabsSendMessage.mock.calls.some(call => call[1]?.type === 'TEAM_SEND_PROMPT')).toBe(false)
  })

  it('replaces the selected assistant message when the role frame returns the complete reply', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2 }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      roleId: 'role-1',
      roleName: '工程师',
      content: '漏了一半',
      createdAt: 1,
      status: 'received',
    }
    const harness = await setupBackground(store)

    const result = await harness.invoke(
      {
        type: 'TEAM_ROLE_REPLY_RESYNC',
        chatId: 'chat-1',
        roleId: 'role-1',
        messageId: 'msg-1',
        content: '完整回复\n\n- 第一段\n- 第二段',
        contentFormat: 'markdown',
        conversationUrl: 'https://chatgpt.com/c/abc',
      },
      { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://chatgpt.com/c/abc' },
    ) as { ok: boolean; message: { id: string; content: string; contentFormat?: string }; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.message.id).toBe('msg-1')
    expect(result.message.content).toBe('完整回复\n\n- 第一段\n- 第二段')
    expect(result.message.contentFormat).toBe('markdown')
    expect(result.store.messagesById['msg-1'].content).toBe('完整回复\n\n- 第一段\n- 第二段')
    expect(result.store.messagesById['msg-1'].createdAt).toBe(1)
    expect(result.store.chatsById['chat-1'].messageIds).toEqual(['msg-1'])
    expect(result.store.chatsById['chat-1'].nextMessageSeq).toBe(2)
  })
})

function makeStore(): OpenTeamStore {
  return {
    version: 1,
    chatOrder: [],
    chatsById: {},
    rolesById: {},
    messagesById: {},
    roleTemplateOrder: [],
    roleTemplatesById: {},
    orchestrationFlowsById: {},
    orchestrationFlowOrderByChatId: {},
    orchestrationRunsById: {},
    activeOrchestrationRunIdByChatId: {},
    globalNote: undefined,
    chatNotesById: {},
    messageHighlightsById: {},
    settings: { defaultMode: 'independent', maxContextChars: 6000, defaultChatSite: 'gemini', externalModelOrder: [], externalModelsById: {}, agentControlEnabled: false, agentControlPort: 19305, language: 'en' },
    viewState: { chatReadSeqById: {}, chatHasNewMessageById: {} },
  }
}

function makeChat(id: string, roleIds: string[] = []): GroupChat {
  return {
    id,
    name: id,
    mode: 'independent',
    roleIds,
    messageIds: [],
    nextMessageSeq: 1,
    status: roleIds.length > 0 ? 'ready' : 'draft',
    createdAt: 1,
    updatedAt: 1,
  }
}

function makeTemplate(id: string, name: string, systemPrompt: string): RoleTemplate {
  return {
    id,
    type: 'custom',
    name,
    systemPrompt,
    createdAt: 1,
    updatedAt: 1,
  }
}

function makeRole(chatId: string, id: string, name: string, overrides: Partial<GroupRole> = {}): GroupRole {
  return {
    id,
    chatId,
    name,
    status: 'ready',
    contextCursor: 0,
    systemPrompt: `${name}人设`,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function promptRoleIds(harness: BackgroundHarness): string[] {
  return harness.tabsSendMessage.mock.calls
    .filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    .map(call => call[1].roleId)
}

async function waitForPromptCallCount(harness: BackgroundHarness, count: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (promptRoleIds(harness).length === count) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  expect(promptRoleIds(harness)).toHaveLength(count)
}
