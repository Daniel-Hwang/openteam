import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CURRENT_STORE_VERSION,
  MESSAGE_CHUNK_SIZE,
  META_STORE_KEY,
  STORE_KEY,
  chatStorageKey,
  createDefaultStore,
  loadStore,
  messageChunkStorageKey,
  saveStore,
  updateStoreQueued,
} from './store'
import { duplicateChat } from '../background/chatHandlers'
import { BUILTIN_ROLE_TEMPLATES } from './builtinRoleTemplates'
import { DEFAULT_CUSTOM_ROLE_TEMPLATES } from './defaultCustomRoleTemplates'
import { defaultLanguageForEnvironment } from '../shared/i18n'
import type { GroupMessage, GroupRole, OpenTeamStore, RoomMode } from './types'

describe('group store', () => {
  let stored: Record<string, unknown>

  beforeEach(() => {
    stored = {}
    vi.stubGlobal('chrome', {
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
            await Promise.resolve()
            stored = { ...stored, ...structuredClone(items) }
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const next = { ...stored }
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              delete next[key]
            }
            stored = next
          }),
        },
      },
    })
  })

  it('creates the default store shape', () => {
    expect(createDefaultStore()).toEqual({
      version: CURRENT_STORE_VERSION,
      chatOrder: [],
      chatsById: {},
      rolesById: {},
      messagesById: {},
      roleTemplateOrder: DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => template.id),
      roleTemplatesById: Object.fromEntries(DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => [template.id, template])),
      orchestrationFlowsById: {},
      orchestrationFlowOrderByChatId: {},
      orchestrationRunsById: {},
      activeOrchestrationRunIdByChatId: {},
      globalNote: undefined,
      chatNotesById: {},
      messageHighlightsById: {},
      externalRoleMemoriesById: {},
      externalChatMemoriesById: {},
      settings: {
        defaultMode: 'independent',
        maxContextChars: 6000,
        defaultChatSite: 'deepseek',
        externalModelOrder: [],
        externalModelsById: {},
        agentControlEnabled: false,
        agentControlPort: 19305,
        language: defaultLanguageForEnvironment(),
      },
      viewState: {
        chatReadSeqById: {},
        chatHasNewMessageById: {},
      },
    })
  })

  it('loads a default store when storage is empty', async () => {
    await expect(loadStore()).resolves.toEqual(createDefaultStore())
  })

  it('seeds default custom role templates on DeepSeek', () => {
    expect(DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => template.defaultChatSite)).toEqual(['deepseek', 'deepseek', 'deepseek'])
  })

  it('uses DeepSeek as the default site for built-in role templates', () => {
    expect(new Set(BUILTIN_ROLE_TEMPLATES.map(template => template.defaultChatSite))).toEqual(new Set(['deepseek']))
  })

  it('merges missing keys with defaults when loading stored data', async () => {
    stored[STORE_KEY] = {
      currentChatId: 'chat-1',
      chatOrder: ['chat-1'],
      chatsById: {
        'chat-1': {
          id: 'chat-1',
          name: 'Planning',
          mode: 'collaborative',
          roleIds: [],
          messageIds: [],
          nextMessageSeq: 1,
          status: 'ready',
          createdAt: 1,
          updatedAt: 1,
        },
      },
      settings: {
        defaultMode: 'collaborative',
        defaultChatSite: 'deepseek',
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      version: CURRENT_STORE_VERSION,
      currentChatId: 'chat-1',
      chatOrder: ['chat-1'],
      rolesById: {},
      messagesById: {},
      roleTemplateOrder: DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => template.id),
      roleTemplatesById: Object.fromEntries(DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => [template.id, template])),
      settings: {
        defaultMode: 'collaborative',
        maxContextChars: 6000,
        defaultChatSite: 'deepseek',
        externalModelOrder: [],
        externalModelsById: {},
        agentControlEnabled: false,
        agentControlPort: 19305,
        language: defaultLanguageForEnvironment(),
      },
    })
  })

  it('migrates the previous local control default port to the current default', async () => {
    stored[META_STORE_KEY] = {
      version: 6,
      chatOrder: [],
      roleTemplateOrder: [],
      roleTemplatesById: {},
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'deepseek',
        agentControlPort: 19826,
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      version: CURRENT_STORE_VERSION,
      settings: {
        agentControlPort: 19305,
      },
    })
  })

  it('preserves custom local control ports when migrating old stores', async () => {
    stored[META_STORE_KEY] = {
      version: 6,
      chatOrder: [],
      roleTemplateOrder: [],
      roleTemplatesById: {},
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'deepseek',
        agentControlPort: 19999,
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      settings: {
        agentControlPort: 19999,
      },
    })
  })

  it('normalizes the saved interface language', async () => {
    stored[STORE_KEY] = {
      settings: {
        language: 'zh-CN',
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      settings: {
        language: 'zh-CN',
      },
    })

    stored = {
      [STORE_KEY]: {
        settings: {
          language: 'fr',
        },
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      settings: {
        language: 'en',
      },
    })
  })

  it('uses the browser language as the default for stores without a saved language', async () => {
    const originalNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language: 'zh-CN', languages: ['zh-CN', 'en-US'] },
    })

    try {
      await expect(loadStore()).resolves.toMatchObject({
        settings: {
          language: 'zh-CN',
        },
      })
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      })
    }
  })

  it('seeds existing empty stores with default custom role templates once', async () => {
    stored[META_STORE_KEY] = {
      version: CURRENT_STORE_VERSION - 1,
      chatOrder: [],
      roleTemplateOrder: [],
      roleTemplatesById: {},
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'gemini',
      },
    }

    const store = await loadStore()

    expect(store.roleTemplateOrder).toEqual(DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => template.id))
    expect(Object.values(store.roleTemplatesById)).toEqual(DEFAULT_CUSTOM_ROLE_TEMPLATES)
    await saveStore(store)
    expect(stored[META_STORE_KEY]).toMatchObject({
      version: CURRENT_STORE_VERSION,
      roleTemplateOrder: DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => template.id),
    })
  })

  it('does not restore default custom role templates after a current store has removed them', async () => {
    stored[META_STORE_KEY] = {
      version: CURRENT_STORE_VERSION,
      chatOrder: [],
      roleTemplateOrder: [],
      roleTemplatesById: {},
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'gemini',
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      roleTemplateOrder: [],
      roleTemplatesById: {},
    })
  })

  it('preserves an explicitly saved Gemini default site on current stores', async () => {
    stored[META_STORE_KEY] = {
      version: CURRENT_STORE_VERSION,
      chatOrder: [],
      roleTemplateOrder: [],
      roleTemplatesById: {},
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'gemini',
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      settings: {
        defaultChatSite: 'gemini',
      },
    })
  })

  it('migrates legacy default custom role template sites to DeepSeek', async () => {
    stored[META_STORE_KEY] = {
      version: 5,
      chatOrder: [],
      roleTemplateOrder: DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => template.id),
      roleTemplatesById: Object.fromEntries(DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => [template.id, { ...template, defaultChatSite: 'gemini' }])),
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'gemini',
      },
    }

    const store = await loadStore()

    expect(store.settings.defaultChatSite).toBe('deepseek')
    expect(DEFAULT_CUSTOM_ROLE_TEMPLATES.map(template => store.roleTemplatesById[template.id]?.defaultChatSite)).toEqual(['deepseek', 'deepseek', 'deepseek'])
  })

  it('normalizes external model settings and drops incomplete configs', async () => {
    stored[STORE_KEY] = {
      settings: {
        externalModelOrder: ['model-1', 'missing', 'model-bad'],
        externalModelsById: {
          'model-1': {
            id: 'model-1',
            name: '本地模型',
            format: 'openai',
            baseUrl: ' https://api.example.test/v1 ',
            apiKey: 'sk-test',
            modelName: 'local-chat-model',
            createdAt: 1,
            updatedAt: 2,
          },
          'model-bad': {
            id: 'model-bad',
            name: '',
            format: 'openai',
            baseUrl: 'https://api.example.test/v1',
            apiKey: 'sk-test',
            modelName: 'local-chat-model',
          },
        },
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      settings: {
        externalModelOrder: ['model-1'],
        externalModelsById: {
          'model-1': {
            id: 'model-1',
            name: '本地模型',
            format: 'openai',
            baseUrl: 'https://api.example.test/v1',
            apiKey: 'sk-test',
            modelName: 'local-chat-model',
            createdAt: 1,
            updatedAt: 2,
          },
        },
      },
    })
  })

  it('normalizes legacy role templates as custom templates when loading stored data', async () => {
    stored[STORE_KEY] = {
      roleTemplateOrder: ['template-legacy'],
      roleTemplatesById: {
        'template-legacy': {
          id: 'template-legacy',
          name: '观察员',
          systemPrompt: '观察讨论',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      roleTemplatesById: {
        'template-legacy': {
          type: 'custom',
          name: '观察员',
        },
      },
    })
  })

  it('does not persist built-in role templates into metadata storage', async () => {
    const store = createDefaultStore()
    const builtinTemplate = BUILTIN_ROLE_TEMPLATES[0]
    store.roleTemplateOrder = [builtinTemplate.id, 'template-custom']
    store.roleTemplatesById[builtinTemplate.id] = builtinTemplate
    store.roleTemplatesById['template-custom'] = {
      id: 'template-custom',
      type: 'custom',
      name: '观察员',
      systemPrompt: '观察讨论',
      createdAt: 1,
      updatedAt: 1,
    }

    await saveStore(store)

    expect(stored[META_STORE_KEY]).toMatchObject({
      roleTemplateOrder: ['template-custom'],
      roleTemplatesById: {
        'template-custom': expect.objectContaining({ type: 'custom' }),
      },
    })
    const meta = stored[META_STORE_KEY] as { roleTemplatesById: Record<string, unknown> }
    expect(meta.roleTemplatesById[builtinTemplate.id]).toBeUndefined()
  })

  it('keeps Claude as a valid default chat site when loading stored data', async () => {
    stored[STORE_KEY] = {
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'claude',
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      settings: {
        defaultChatSite: 'claude',
      },
    })
  })

  it('migrates the legacy single-key store into split storage', async () => {
    stored[STORE_KEY] = {
      version: 1,
      currentChatId: 'chat-1',
      chatOrder: ['chat-1'],
      chatsById: {
        'chat-1': {
          id: 'chat-1',
          name: 'Planning',
          mode: 'collaborative',
          roleIds: ['role-1'],
          messageIds: ['msg-1'],
          nextMessageSeq: 2,
          status: 'ready',
          createdAt: 1,
          updatedAt: 1,
        },
      },
      rolesById: {
        'role-1': {
          id: 'role-1',
          chatId: 'chat-1',
          name: '工程师',
          status: 'ready',
          contextCursor: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      messagesById: {
        'msg-1': makeMessage('chat-1', 'msg-1', 1),
      },
      settings: {
        defaultMode: 'collaborative',
      },
    }

    const store = await loadStore()

    expect(store).toMatchObject({
      version: CURRENT_STORE_VERSION,
      currentChatId: 'chat-1',
      chatOrder: ['chat-1'],
      chatsById: {
        'chat-1': {
          messageIds: ['msg-1'],
        },
      },
      rolesById: {
        'role-1': {
          name: '工程师',
        },
      },
      messagesById: {
        'msg-1': {
          content: 'message-1',
        },
      },
    })
    expect(stored[STORE_KEY]).toBeUndefined()
    expect(stored[META_STORE_KEY]).toBeDefined()
    expect(stored[chatStorageKey('chat-1')]).toBeDefined()
    expect(stored[messageChunkStorageKey('chat-1', '000001')]).toBeDefined()
  })

  it('saves chat messages in chunks instead of the legacy whole-store key', async () => {
    const store = createDefaultStore()
    const messages = Array.from({ length: MESSAGE_CHUNK_SIZE + 5 }, (_, index) => makeMessage('chat-1', `msg-${index + 1}`, index + 1))
    store.currentChatId = 'chat-1'
    store.chatOrder = ['chat-1']
    store.chatsById['chat-1'] = {
      id: 'chat-1',
      name: 'Planning',
      mode: 'independent',
      roleIds: [],
      messageIds: messages.map(message => message.id),
      nextMessageSeq: messages.length + 1,
      status: 'ready',
      createdAt: 1,
      updatedAt: 1,
    }
    store.messagesById = Object.fromEntries(messages.map(message => [message.id, message]))

    await saveStore(store)

    const chatDocument = stored[chatStorageKey('chat-1')] as { messageChunkIds: string[]; messageCount: number }
    const firstChunk = stored[messageChunkStorageKey('chat-1', '000001')] as { messages: GroupMessage[] }
    const secondChunk = stored[messageChunkStorageKey('chat-1', '000002')] as { messages: GroupMessage[] }

    expect(stored[STORE_KEY]).toBeUndefined()
    expect(chatDocument.messageCount).toBe(MESSAGE_CHUNK_SIZE + 5)
    expect(chatDocument.messageChunkIds).toEqual(['000001', '000002'])
    expect(firstChunk.messages).toHaveLength(MESSAGE_CHUNK_SIZE)
    expect(secondChunk.messages).toHaveLength(5)
    await expect(loadStore()).resolves.toMatchObject({
      chatOrder: ['chat-1'],
      chatsById: {
        'chat-1': {
          messageIds: messages.map(message => message.id),
        },
      },
    })
  })

  it('persists global notes, chat notes, and message highlights in split storage metadata', async () => {
    const store = createDefaultStore()
    store.globalNote = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '全局想法' }] }] }
    store.chatNotesById!['chat-1'] = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '群聊笔记' }] }] }
    store.messageHighlightsById!['msg-1'] = [
      {
        id: 'highlight-1',
        messageId: 'msg-1',
        text: '重点内容',
        startOffset: 2,
        endOffset: 6,
        createdAt: 3,
      },
    ]

    await saveStore(store)

    expect(stored[META_STORE_KEY]).toMatchObject({
      globalNote: store.globalNote,
      chatNotesById: store.chatNotesById,
      messageHighlightsById: store.messageHighlightsById,
    })
    await expect(loadStore()).resolves.toMatchObject({
      globalNote: store.globalNote,
      chatNotesById: store.chatNotesById,
      messageHighlightsById: store.messageHighlightsById,
    })
  })

  it('normalizes missing orchestration records on older stores', async () => {
    stored[STORE_KEY] = {
      version: 4,
      chatOrder: [],
      settings: {
        defaultMode: 'independent',
        defaultChatSite: 'gemini',
      },
    }

    await expect(loadStore()).resolves.toMatchObject({
      version: CURRENT_STORE_VERSION,
      orchestrationFlowsById: {},
      orchestrationFlowOrderByChatId: {},
      orchestrationRunsById: {},
      activeOrchestrationRunIdByChatId: {},
    })
  })

  it('persists orchestration flows, runs, and active run metadata', async () => {
    const store = createDefaultStore()
    store.orchestrationFlowsById['flow-1'] = {
      id: 'flow-1',
      chatId: 'chat-1',
      name: 'Launch review',
      stages: [
        { id: 'stage-1', kind: 'roles', name: 'Draft', roleIds: ['role-1', 'role-2'] },
        { id: 'stage-2', kind: 'review', name: 'Review', roleIds: ['role-reviewer'], review: { reviewerRoleIds: ['role-reviewer'] } },
      ],
      graph: {
        stageNodes: [
          { id: 'stage-node-1', kind: 'roles', name: 'Draft node', roleIds: ['role-1', 'role-2'], position: { x: 56, y: 96 } },
          { id: 'stage-node-2', kind: 'review', name: 'Review node', roleIds: ['role-reviewer'], review: { reviewerRoleIds: ['role-reviewer'] } },
        ],
        edges: [{ sourceStageId: 'stage-node-1', targetStageId: 'stage-node-2', vertices: [{ x: 120, y: 64 }, { x: 180, y: 96 }] }],
      },
      maxRounds: 99,
      createdAt: 1,
      updatedAt: 2,
    }
    store.orchestrationFlowOrderByChatId['chat-1'] = ['flow-1']
    store.orchestrationRunsById['run-1'] = {
      id: 'run-1',
      chatId: 'chat-1',
      flowId: 'flow-1',
      status: 'running',
      currentRound: 1,
      maxRounds: 99,
      stageRuns: [
        {
          stageId: 'stage-1',
          stageIndex: 0,
          kind: 'roles',
          round: 1,
          status: 'completed',
          roleRuns: {
            'role-1': { roleId: 'role-1', status: 'completed', messageId: 'msg-1' },
          },
          reviewResults: [
            {
              round: 1,
              stageRunId: 'stage-run-1',
              reviewerRoleId: 'role-reviewer',
              messageId: 'msg-review-1',
              decision: 'fail',
              reason: 'Needs another draft pass',
              failedCriteria: ['specificity'],
              nextRoundInstruction: 'Add launch risks',
              rawJson: '{"decision":"fail"}',
              createdAt: 5,
            },
          ],
        },
      ],
      createdAt: 3,
      updatedAt: 4,
    }
    store.activeOrchestrationRunIdByChatId['chat-1'] = 'run-1'

    await saveStore(store)

    expect(stored[META_STORE_KEY]).toMatchObject({
      orchestrationFlowOrderByChatId: { 'chat-1': ['flow-1'] },
      activeOrchestrationRunIdByChatId: { 'chat-1': 'run-1' },
    })
    await expect(loadStore()).resolves.toMatchObject({
      orchestrationFlowsById: {
        'flow-1': {
          stages: [
            { id: 'stage-1', kind: 'roles', roleIds: ['role-1', 'role-2'] },
            { id: 'stage-2', kind: 'review', roleIds: ['role-reviewer'] },
          ],
          graph: {
            stageNodes: [
              { id: 'stage-node-1', kind: 'roles', roleIds: ['role-1', 'role-2'], position: { x: 56, y: 96 } },
              { id: 'stage-node-2', kind: 'review', roleIds: ['role-reviewer'] },
            ],
            edges: [{ sourceStageId: 'stage-node-1', targetStageId: 'stage-node-2', vertices: [{ x: 120, y: 64 }, { x: 180, y: 96 }] }],
          },
          maxRounds: 50,
        },
      },
      orchestrationFlowOrderByChatId: { 'chat-1': ['flow-1'] },
      orchestrationRunsById: {
        'run-1': {
          status: 'running',
          maxRounds: 50,
          stageRuns: [
            {
              stageId: 'stage-1',
              kind: 'roles',
              roleRuns: {
                'role-1': { roleId: 'role-1', status: 'completed', messageId: 'msg-1' },
              },
              reviewResults: [
                {
                  round: 1,
                  stageRunId: 'stage-run-1',
                  reviewerRoleId: 'role-reviewer',
                  messageId: 'msg-review-1',
                  decision: 'fail',
                  reason: 'Needs another draft pass',
                  failedCriteria: ['specificity'],
                  nextRoundInstruction: 'Add launch risks',
                  rawJson: '{"decision":"fail"}',
                  createdAt: 5,
                },
              ],
            },
          ],
        },
      },
      activeOrchestrationRunIdByChatId: { 'chat-1': 'run-1' },
    })
  })

  it('persists executable orchestration stages without a graph snapshot', async () => {
    const store = createDefaultStore()
    store.orchestrationFlowsById['flow-no-graph'] = {
      id: 'flow-no-graph',
      chatId: 'chat-1',
      name: 'Stage-only flow',
      stages: [
        { id: 'stage-1', kind: 'roles', name: 'Draft', roleIds: ['role-1'] },
        { id: 'stage-2', kind: 'review', name: 'Review', roleIds: ['role-reviewer'], review: { reviewerRoleIds: ['role-reviewer'] } },
      ],
      maxRounds: 1,
      createdAt: 1,
      updatedAt: 2,
    }
    store.orchestrationFlowOrderByChatId['chat-1'] = ['flow-no-graph']

    await saveStore(store)

    const loaded = await loadStore()
    expect(loaded.orchestrationFlowsById['flow-no-graph']).toMatchObject({
      id: 'flow-no-graph',
      chatId: 'chat-1',
      stages: [
        { id: 'stage-1', kind: 'roles', roleIds: ['role-1'] },
        { id: 'stage-2', kind: 'review', roleIds: ['role-reviewer'] },
      ],
      maxRounds: 1,
    })
    expect(loaded.orchestrationFlowsById['flow-no-graph'].graph).toBeUndefined()
    expect(loaded.orchestrationFlowOrderByChatId['chat-1']).toEqual(['flow-no-graph'])
  })

  it('removes stale split-storage keys after a chat is deleted', async () => {
    const store = createDefaultStore()
    store.chatOrder = ['chat-1', 'chat-2']
    store.chatsById['chat-1'] = makeChat('chat-1', ['msg-1'])
    store.chatsById['chat-2'] = makeChat('chat-2', ['msg-2'])
    store.messagesById['msg-1'] = makeMessage('chat-1', 'msg-1', 1)
    store.messagesById['msg-2'] = makeMessage('chat-2', 'msg-2', 1)
    await saveStore(store)

    delete store.chatsById['chat-1']
    delete store.messagesById['msg-1']
    store.chatOrder = ['chat-2']
    await saveStore(store)

    expect(stored[chatStorageKey('chat-1')]).toBeUndefined()
    expect(stored[messageChunkStorageKey('chat-1', '000001')]).toBeUndefined()
    expect(stored[chatStorageKey('chat-2')]).toBeDefined()
  })

  it('serializes queued updates so concurrent writes are preserved', async () => {
    const addChat = (id: string) =>
      updateStoreQueued((draft: OpenTeamStore) => {
        draft.chatOrder.push(id)
        draft.chatsById[id] = {
          id,
          name: id,
          mode: 'independent',
          roleIds: [],
          messageIds: [],
          nextMessageSeq: 1,
          status: 'draft',
          createdAt: 1,
          updatedAt: 1,
        }
      })

    await Promise.all([addChat('chat-1'), addChat('chat-2'), addChat('chat-3')])

    const store = await loadStore()
    expect(store.chatOrder).toEqual(['chat-1', 'chat-2', 'chat-3'])
    expect(Object.keys(store.chatsById)).toEqual(['chat-1', 'chat-2', 'chat-3'])
  })

  describe('chat duplication', () => {
    it('preserves the full data contract (name, mode, role metadata, and model bindings) when duplicating a chat', () => {
      const store = createDefaultStore()
      const deps = {
        newId: (prefix: string) => `${prefix}-${Math.random()}`,
        now: () => Date.now(),
        broadcastStoreUpdated: vi.fn(),
        getChatStatusFromRoles: vi.fn(),
        log: {
          info: vi.fn(),
          warn: vi.fn(),
        },
        runtimeFrames: {
          removeRole: vi.fn(),
        },
      } as any

      const sourceChatId = 'source-chat'
      const sourceChatName = '核心专家组'
      const sourceMode: RoomMode = 'collaborative'

      store.chatsById[sourceChatId] = {
        id: sourceChatId,
        name: sourceChatName,
        description: '这是一个测试副本的描述',
        mode: sourceMode,
        roleIds: ['role-1'],
        messageIds: [],
        nextMessageSeq: 1,
        status: 'ready',
        createdAt: 1,
        updatedAt: 1,
      }
      store.chatOrder = [sourceChatId]

      const sourceRole: GroupRole = {
        id: 'role-1',
        chatId: sourceChatId,
        name: '首席架构师',
        description: '负责系统设计',
        systemPrompt: '你是一个架构师...',
        avatarColor: '#FF0000',
        modelSource: 'external',
        chatSite: 'deepseek',
        externalModelId: 'ext-model-123',
        status: 'ready',
        contextCursor: 0,
        createdAt: 1,
        updatedAt: 1,
      }
      store.rolesById['role-1'] = sourceRole

      const { chat: newChat } = duplicateChat(store, sourceChatId, deps)

      // 1. 验证群聊主体合约
      expect(newChat.name).toContain(sourceChatName)
      expect(newChat.mode).toBe(sourceMode)
      expect(newChat.description).toBe('这是一个测试副本的描述')

      // 2. 验证角色合约
      const newRoleId = newChat.roleIds[0]
      const newRole = store.rolesById[newRoleId]

      expect(newRole).toBeDefined()
      expect(newRole.name).toBe(sourceRole.name)
      expect(newRole.description).toBe(sourceRole.description)
      expect(newRole.systemPrompt).toBe(sourceRole.systemPrompt)
      expect(newRole.avatarColor).toBe(sourceRole.avatarColor)
      expect(newRole.modelSource).toBe(sourceRole.modelSource)
      expect(newRole.chatSite).toBeUndefined()
      expect(newRole.externalModelId).toBe(sourceRole.externalModelId)
      expect(newRole.chatId).toBe(newChat.id)
    })
  })
})

function makeChat(id: string, messageIds: string[] = []): OpenTeamStore['chatsById'][string] {
  return {
    id,
    name: id,
    mode: 'independent',
    roleIds: [],
    messageIds,
    nextMessageSeq: messageIds.length + 1,
    status: 'ready',
    createdAt: 1,
    updatedAt: 1,
  }
}

function makeMessage(chatId: string, id: string, seq: number): GroupMessage {
  return {
    id,
    chatId,
    seq,
    type: 'user',
    content: `message-${seq}`,
    createdAt: seq,
    status: 'sent',
  }
}
