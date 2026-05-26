import { describe, expect, it } from 'vitest'
import { parseGroupMentions } from './mentionParser'
import type { GroupRole } from './types'

describe('parseGroupMentions', () => {
  it('does not target anyone when defaultTarget is none and the message has no mentions', () => {
    expect(parseGroupMentions('记录一个背景', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '记录一个背景',
      targetRoleIds: [],
      mentionedRoleIds: [],
    })
  })

  it('targets all roles for @all and @所有人 without marking explicit role mentions', () => {
    expect(parseGroupMentions('@all 请一起看', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '请一起看',
      targetRoleIds: ['role-eng', 'role-pm'],
      mentionedRoleIds: [],
      mentionsAll: true,
    })
    expect(parseGroupMentions('@所有人 请一起看', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '请一起看',
      targetRoleIds: ['role-eng', 'role-pm'],
      mentionedRoleIds: [],
      mentionsAll: true,
    })
  })

  it('targets default orchestration when @编排 is used', () => {
    expect(parseGroupMentions('@编排 帮我写个方案', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '帮我写个方案',
      targetRoleIds: [],
      mentionedRoleIds: [],
      orchestrationTarget: 'default',
    })
  })

  it('targets default orchestration when @orchestration is used', () => {
    expect(parseGroupMentions('@orchestration plan this', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: 'plan this',
      targetRoleIds: [],
      mentionedRoleIds: [],
      orchestrationTarget: 'default',
    })
  })

  it('targets named orchestration when @编排:name is used', () => {
    expect(parseGroupMentions('@编排:代码评审 帮我看看', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '帮我看看',
      targetRoleIds: [],
      mentionedRoleIds: [],
      orchestrationTarget: { name: '代码评审' },
    })
  })

  it('targets one or more mentioned roles and strips mention labels from content', () => {
    expect(parseGroupMentions('@工程师 @产品经理 请评估', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '请评估',
      targetRoleIds: ['role-eng', 'role-pm'],
      mentionedRoleIds: ['role-eng', 'role-pm'],
    })
  })

  it('correctly handles mixed mentions and orchestration', () => {
    expect(parseGroupMentions('@工程师 @编排:总结 请总结', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '请总结',
      targetRoleIds: ['role-eng'],
      mentionedRoleIds: ['role-eng'],
      orchestrationTarget: { name: '总结' },
    })
  })

  it('treats @编排 followed by invalid character as normal text', () => {
    // If it's @编排X (no space, no colon), it should not trigger
    expect(parseGroupMentions('@编排X 帮我', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '@编排X 帮我',
      targetRoleIds: [],
      mentionedRoleIds: [],
    })
  })
})

const roles: GroupRole[] = [
  makeRole('role-eng', '工程师'),
  makeRole('role-pm', '产品经理'),
]

function makeRole(id: string, name: string): GroupRole {
  return {
    id,
    chatId: 'chat-1',
    name,
    systemPrompt: `${name}人设`,
    status: 'ready',
    contextCursor: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}
