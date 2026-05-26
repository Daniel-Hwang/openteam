import { createGroupRole } from '../group/roleTemplates'
import type { GroupChat, GroupMessage, GroupRole, OpenTeamStore, OrchestrationFlow, OrchestrationStage, RoomMode } from '../group/types'
import type { BackgroundMessageRoute } from './messageRouter'
import { messageTabId, type RuntimeMessage } from './runtimeClient'
import type { RuntimeFrameRegistry } from './runtimeFrames'
import { mutateStore, requireChat } from './storeAccess'

export const CHAT_ROUTE_TYPES = [
  'GROUP_CHAT_CREATE',
  'GROUP_CHAT_DUPLICATE',
  'GROUP_CHAT_SWITCH',
  'GROUP_CHAT_UPDATE',
  'GROUP_CHAT_DELETE',
  'GROUP_CHAT_CLEAR_MESSAGES',
  'GROUP_CHAT_CLOSE',
  'GROUP_CHAT_MARK_READ',
] as const

export interface ChatHandlersDependencies {
  broadcastStoreUpdated(store: OpenTeamStore, excludeTabId?: number): Promise<void> | void
  getChatStatusFromRoles(store: OpenTeamStore, chat: GroupChat): GroupChat['status']
  log: {
    info(event: string, details?: Record<string, unknown>): void
    warn(event: string, details?: Record<string, unknown>): void
  }
  newId(prefix: string): string
  now(): number
  runtimeFrames: Pick<RuntimeFrameRegistry, 'removeRole'>
}

export function createChatHandlers(deps: ChatHandlersDependencies): BackgroundMessageRoute[] {
  const handleChatCreate = async (message: RuntimeMessage) => {
    const { store, result } = await mutateStore(store => createChat(store, message, deps))
    await deps.broadcastStoreUpdated(store)
    return { ok: true, chat: result, store }
  }

  const handleChatDuplicate = async (message: RuntimeMessage) => {
    const { store, result } = await mutateStore(store => duplicateChat(store, message.chatId, deps))
    deps.log.info('chat-duplicate:stored', { sourceChatId: message.chatId, chatId: result.chat.id, roleCount: result.roles.length })
    await deps.broadcastStoreUpdated(store)
    return { ok: true, chat: result.chat, roles: result.roles, store }
  }

  const handleChatSwitch = async (message: RuntimeMessage, sender: chrome.runtime.MessageSender) => {
    const { store } = await mutateStore(store => {
      const chat = requireChat(store, message.chatId)
      store.currentChatId = chat.id
      markChatRead(store, chat)
      chat.updatedAt = deps.now()
    })
    await deps.broadcastStoreUpdated(store, messageTabId(message, sender))
    return { ok: true, store }
  }

  const handleChatUpdate = async (message: RuntimeMessage) => {
    const patch = isRecord(message.patch) ? message.patch : message
    const timestamp = deps.now()
    const { store, result } = await mutateStore(store => {
      const chat = requireChat(store, message.chatId)
      const patchKeys: string[] = []

      if (patch.name !== undefined) {
        const name = requireString(patch.name, '群聊名称不能为空')
        chat.name = name
        patchKeys.push('name')
      }

      if (patch.description !== undefined) {
        const description = readOptionalString(patch.description)
        if (description) {
          chat.description = description
        } else {
          delete chat.description
        }
        patchKeys.push('description')
      }

      if (patch.requireManualMention !== undefined) {
        chat.requireManualMention = !!patch.requireManualMention
        patchKeys.push('requireManualMention')
      }

      chat.updatedAt = timestamp
      return { chat, patchKeys }
    })
    deps.log.info('chat-update:stored', { chatId: result.chat.id, patchKeys: result.patchKeys })
    await deps.broadcastStoreUpdated(store)
    return { ok: true, chat: result.chat, store }
  }

  const handleChatDelete = async (message: RuntimeMessage) => {
    const chatId = requireString(message.chatId, '缺少群聊 ID')
    const { store, result } = await mutateStore(store => {
      const chat = requireChat(store, chatId)
      const roleIds = [...chat.roleIds]
      const messageIds = [...chat.messageIds]

      for (const roleId of roleIds) {
        delete store.rolesById[roleId]
        deps.runtimeFrames.removeRole(chat.id, roleId)
      }
      for (const messageId of messageIds) delete store.messagesById[messageId]

      store.chatOrder = store.chatOrder.filter(id => id !== chat.id)
      delete store.chatsById[chat.id]
      if (store.currentChatId === chat.id) store.currentChatId = store.chatOrder[0]
      if (store.viewState?.chatReadSeqById) delete store.viewState.chatReadSeqById[chat.id]
      if (store.viewState?.chatHasNewMessageById) delete store.viewState.chatHasNewMessageById[chat.id]

      return { chatId: chat.id, roleIds, messageIds }
    })
    deps.log.info('chat-delete:stored', { chatId: result.chatId, roleCount: result.roleIds.length, messageCount: result.messageIds.length })
    await deps.broadcastStoreUpdated(store)
    return { ok: true, chatId: result.chatId, store }
  }

  const handleChatClearMessages = async (message: RuntimeMessage) => {
    const chatId = requireString(message.chatId, '缺少群聊 ID')
    const timestamp = deps.now()
    const { store, result } = await mutateStore(store => {
      const chat = requireChat(store, chatId)
      const roleIds = [...chat.roleIds]
      const messageIds = [...chat.messageIds]

      for (const messageId of messageIds) delete store.messagesById[messageId]
      chat.messageIds = []
      chat.nextMessageSeq = 1
      chat.updatedAt = timestamp

      for (const roleId of roleIds) {
        const role = store.rolesById[roleId]
        if (!role) continue
        deps.runtimeFrames.removeRole(chat.id, role.id)
        role.status = 'loading'
        role.contextCursor = 0
        role.updatedAt = timestamp
        delete role.geminiConversationId
        delete role.geminiConversationUrl
        delete role.lastPromptMessageId
        delete role.replyAttemptId
      }

      chat.status = roleIds.length > 0 ? 'initializing' : 'draft'
      markChatRead(store, chat)
      return { chatId: chat.id, roleIds, messageIds }
    })
    deps.log.info('chat-clear-messages:stored', { chatId: result.chatId, roleCount: result.roleIds.length, messageCount: result.messageIds.length })
    await deps.broadcastStoreUpdated(store)
    return { ok: true, chatId: result.chatId, store }
  }

  const handleChatClose = async (message: RuntimeMessage) => {
    const chatId = requireString(message.chatId, '缺少群聊 ID')
    const timestamp = deps.now()
    const { store, result } = await mutateStore(store => {
      const chat = requireChat(store, chatId)
      const roleIds = [...chat.roleIds]

      for (const roleId of roleIds) {
        const role = store.rolesById[roleId]
        if (!role) continue
        deps.runtimeFrames.removeRole(chat.id, role.id)
        if (role.status !== 'thinking') role.status = 'loading'
        role.updatedAt = timestamp
      }
      chat.status = deps.getChatStatusFromRoles(store, chat)
      chat.updatedAt = timestamp
      return { chatId: chat.id, roleIds }
    })
    deps.log.info('chat-close:stored', { chatId: result.chatId, roleCount: result.roleIds.length })
    await deps.broadcastStoreUpdated(store)
    return { ok: true, chatId: result.chatId, store }
  }

  const handleChatMarkRead = async (message: RuntimeMessage) => {
    const { store } = await mutateStore(store => {
      const chat = requireChat(store, message.chatId)
      markChatRead(store, chat)
    })
    await deps.broadcastStoreUpdated(store)
    return { ok: true, store }
  }

  return [
    { type: 'GROUP_CHAT_CREATE', handler: handleChatCreate },
    { type: 'GROUP_CHAT_DUPLICATE', handler: handleChatDuplicate },
    { type: 'GROUP_CHAT_SWITCH', handler: handleChatSwitch },
    { type: 'GROUP_CHAT_UPDATE', handler: handleChatUpdate },
    { type: 'GROUP_CHAT_DELETE', handler: handleChatDelete },
    { type: 'GROUP_CHAT_CLEAR_MESSAGES', handler: handleChatClearMessages },
    { type: 'GROUP_CHAT_CLOSE', handler: handleChatClose },
    { type: 'GROUP_CHAT_MARK_READ', handler: handleChatMarkRead },
  ]
}

function createChat(store: OpenTeamStore, message: RuntimeMessage, deps: ChatHandlersDependencies): GroupChat {
  const timestamp = deps.now()
  const name = typeof message.name === 'string' && message.name.trim() ? message.name.trim() : '新群聊'
  const description = readOptionalString(message.description)
  const chat: GroupChat = {
    id: deps.newId('chat'),
    name,
    ...(description ? { description } : {}),
    mode: readRoomMode(message.mode, store.settings.defaultMode),
    roleIds: [],
    messageIds: [],
    nextMessageSeq: 1,
    status: 'initializing',
    requireManualMention: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  store.chatsById[chat.id] = chat
  store.chatOrder.unshift(chat.id)
  store.currentChatId = chat.id

  const createdRoles: GroupRole[] = []
  const roles = Array.isArray(message.roles) ? message.roles : []
  for (const input of roles) {
    if (!isRecord(input)) continue
    const role = createGroupRole(store, {
      chatId: chat.id,
      templateId: readOptionalString(input.roleTemplateId) ?? readOptionalString(input.templateId),
      name: readOptionalString(input.name),
      description: readOptionalString(input.description),
      systemPrompt: readOptionalString(input.systemPrompt),
    }, deps.newId('role'), timestamp)
    createdRoles.push(role)
  }

  appendWelcomeMessage(store, chat, createdRoles[0], readOptionalString(message.welcomeMessage), deps, timestamp)
  chat.status = chat.roleIds.length > 0 ? 'initializing' : 'draft'
  return chat
}

function appendWelcomeMessage(
  store: OpenTeamStore,
  chat: GroupChat,
  role: GroupRole | undefined,
  content: string | undefined,
  deps: ChatHandlersDependencies,
  timestamp: number,
): void {
  if (!content) return
  const welcome: GroupMessage = {
    id: deps.newId('msg'),
    chatId: chat.id,
    seq: chat.nextMessageSeq,
    type: role ? 'assistant' : 'system',
    content,
    contentFormat: 'markdown',
    ...(role ? { roleId: role.id, roleName: role.name } : {}),
    createdAt: timestamp,
    status: 'received',
  }
  store.messagesById[welcome.id] = welcome
  chat.messageIds.push(welcome.id)
  chat.nextMessageSeq += 1
  markChatRead(store, chat)
}

export function duplicateChat(store: OpenTeamStore, sourceChatId: unknown, deps: ChatHandlersDependencies): { chat: GroupChat; roles: GroupRole[] } {
  const timestamp = deps.now()
  const sourceChat = requireChat(store, sourceChatId)
  const chat: GroupChat = {
    id: deps.newId('chat'),
    name: duplicatedChatName(store, sourceChat.name),
    ...(sourceChat.description ? { description: sourceChat.description } : {}),
    mode: sourceChat.mode,
    roleIds: [],
    messageIds: [],
    nextMessageSeq: 1,
    status: sourceChat.roleIds.length > 0 ? 'initializing' : 'draft',
    requireManualMention: sourceChat.requireManualMention,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const roles: GroupRole[] = []
  const roleIdMap = new Map<string, string>()

  store.chatsById[chat.id] = chat
  store.chatOrder.unshift(chat.id)
  store.currentChatId = chat.id

  for (const sourceRoleId of sourceChat.roleIds) {
    const sourceRole = store.rolesById[sourceRoleId]
    if (!sourceRole) continue

    const template = sourceRole.templateId ? store.roleTemplatesById[sourceRole.templateId] : undefined
    const effectiveModelSource = sourceRole.modelSource ?? template?.defaultModelSource ?? 'site'
    const effectiveChatSite = effectiveModelSource === 'external'
      ? undefined
      : (sourceRole.chatSite ?? template?.defaultChatSite ?? store.settings.defaultChatSite)
    const effectiveExternalModelId = effectiveModelSource === 'external'
      ? (sourceRole.externalModelId ?? template?.defaultExternalModelId)
      : undefined

    const role: GroupRole = {
      id: deps.newId('role'),
      chatId: chat.id,
      ...(sourceRole.templateId ? { templateId: sourceRole.templateId } : {}),
      name: sourceRole.name,
      ...(sourceRole.description ? { description: sourceRole.description } : {}),
      ...(sourceRole.systemPrompt ? { systemPrompt: sourceRole.systemPrompt } : {}),
      ...(sourceRole.avatarColor ? { avatarColor: sourceRole.avatarColor } : {}),
      modelSource: effectiveModelSource,
      ...(effectiveChatSite ? { chatSite: effectiveChatSite } : {}),
      ...(effectiveExternalModelId ? { externalModelId: effectiveExternalModelId } : {}),
      status: 'pending',
      contextCursor: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    store.rolesById[role.id] = role
    chat.roleIds.push(role.id)
    roles.push(role)
    roleIdMap.set(sourceRole.id, role.id)
  }

  const sourceFlowIds = store.orchestrationFlowOrderByChatId[sourceChat.id] ?? []
  if (sourceFlowIds.length > 0) {
    const newFlowIds: string[] = []
    for (const sourceFlowId of sourceFlowIds) {
      const sourceFlow = store.orchestrationFlowsById[sourceFlowId]
      if (!sourceFlow) continue

      const newFlowId = deps.newId('flow')
      const newFlow = duplicateOrchestrationFlow(sourceFlow, newFlowId, chat.id, roleIdMap, timestamp)
      store.orchestrationFlowsById[newFlowId] = newFlow
      newFlowIds.push(newFlowId)
    }
    store.orchestrationFlowOrderByChatId[chat.id] = newFlowIds
  }

  return { chat, roles }
}

function duplicateOrchestrationFlow(
  sourceFlow: OrchestrationFlow,
  flowId: string,
  chatId: string,
  roleIdMap: Map<string, string>,
  timestamp: number,
): OrchestrationFlow {
  return {
    ...sourceFlow,
    id: flowId,
    chatId,
    stages: sourceFlow.stages.map(stage => duplicateOrchestrationStage(stage, roleIdMap)),
    ...(sourceFlow.graph ? {
      graph: {
        stageNodes: sourceFlow.graph.stageNodes.map(stage => duplicateOrchestrationStage(stage, roleIdMap)),
        edges: sourceFlow.graph.edges.map(edge => ({
          ...edge,
          ...(edge.vertices ? { vertices: edge.vertices.map(vertex => ({ ...vertex })) } : {}),
        })),
      },
    } : {}),
    ...(sourceFlow.autoPlanHistory ? { autoPlanHistory: sourceFlow.autoPlanHistory.map(entry => ({ ...entry })) } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function duplicateOrchestrationStage(stage: OrchestrationStage, roleIdMap: Map<string, string>): OrchestrationStage {
  return {
    ...stage,
    ...(stage.position ? { position: { ...stage.position } } : {}),
    roleIds: stage.roleIds.map(roleId => roleIdMap.get(roleId) ?? roleId),
    ...(stage.review ? {
      review: {
        ...stage.review,
        reviewerRoleIds: stage.review.reviewerRoleIds.map(roleId => roleIdMap.get(roleId) ?? roleId),
      },
    } : {}),
  }
}

function duplicatedChatName(store: OpenTeamStore, sourceName: string): string {
  const baseName = `${sourceName} 副本`
  const existingNames = new Set(store.chatOrder.map(chatId => store.chatsById[chatId]?.name).filter(Boolean))
  if (!existingNames.has(baseName)) return baseName

  let index = 2
  while (existingNames.has(`${baseName} ${index}`)) index += 1
  return `${baseName} ${index}`
}

function markChatRead(store: OpenTeamStore, chat: GroupChat): void {
  store.viewState ??= { chatReadSeqById: {}, chatHasNewMessageById: {} }
  store.viewState.chatReadSeqById ??= {}
  store.viewState.chatHasNewMessageById ??= {}
  store.viewState.chatReadSeqById[chat.id] = chat.nextMessageSeq - 1
  delete store.viewState.chatHasNewMessageById[chat.id]
}

function readRoomMode(value: unknown, fallback: RoomMode): RoomMode {
  return value === 'collaborative' || value === 'independent' ? value : fallback
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function requireString(value: unknown, error: string): string {
  const result = readOptionalString(value)
  if (!result) throw new Error(error)
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
