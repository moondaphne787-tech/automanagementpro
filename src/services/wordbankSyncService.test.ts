import { describe, it, expect } from 'vitest'
import { collectWordbankProgressUpdates } from './wordbankSyncService'
import type { Wordbank, StudentWordbankProgress, TaskBlock } from '@/types'

// 测试辅助：创建词库
function makeWordbank(overrides: Partial<Wordbank> = {}): Wordbank {
  return {
    id: 'wb-1',
    name: '新概念1',
    total_levels: 50,
    nine_grid_interval: 10,
    category: 'textbook',
    sort_order: 1,
    notes: null,
    ...overrides,
  }
}

// 测试辅助：创建进度
function makeProgress(overrides: Partial<StudentWordbankProgress> = {}): StudentWordbankProgress {
  return {
    id: 'prog-1',
    student_id: 's1',
    wordbank_id: 'wb-1',
    wordbank_label: '新概念1',
    current_level: 5,
    total_levels_override: null,
    last_nine_grid_level: 0,
    status: 'active',
    started_date: null,
    completed_date: null,
    source: 'manual',
    notes: null,
    ...overrides,
  }
}

describe('collectWordbankProgressUpdates', () => {
  it('应该为 vocab_new 任务生成进度更新（level 高于当前）', () => {
    const wb = makeWordbank()
    const wordbankMap = new Map([['新概念1', wb]])
    const progressMap = new Map([['s1', [makeProgress({ current_level: 5 })]]])

    const tasks: TaskBlock[] = [
      { type: 'vocab_new', wordbank_label: '新概念1', level_from: 5, level_to: 8 }
    ]

    const { updates, alerts } = collectWordbankProgressUpdates(
      [{ student_id: 's1', tasks }],
      wordbankMap,
      progressMap
    )

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({
      student_id: 's1',
      wordbank_id: 'wb-1',
      current_level: 8,
    })
    expect(alerts).toHaveLength(0)
  })

  it('不应该为 level 低于当前的任务生成更新', () => {
    const wb = makeWordbank()
    const wordbankMap = new Map([['新概念1', wb]])
    const progressMap = new Map([['s1', [makeProgress({ current_level: 10 })]]])

    const tasks: TaskBlock[] = [
      { type: 'vocab_new', wordbank_label: '新概念1', level_from: 5, level_to: 8 }
    ]

    const { updates } = collectWordbankProgressUpdates(
      [{ student_id: 's1', tasks }],
      wordbankMap,
      progressMap
    )

    expect(updates).toHaveLength(0)
  })

  it('应该在达到九宫格间隔时生成 alert', () => {
    const wb = makeWordbank({ nine_grid_interval: 10 })
    const wordbankMap = new Map([['新概念1', wb]])
    const progressMap = new Map([['s1', [makeProgress({ current_level: 5, last_nine_grid_level: 0 })]]])

    const tasks: TaskBlock[] = [
      { type: 'vocab_new', wordbank_label: '新概念1', level_from: 5, level_to: 12 }
    ]

    const { updates, alerts } = collectWordbankProgressUpdates(
      [{ student_id: 's1', tasks }],
      wordbankMap,
      progressMap
    )

    expect(updates).toHaveLength(1)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toEqual({
      wordbankLabel: '新概念1',
      interval: 10,
      level: 12,
    })
  })

  it('应该为 nine_grid 任务生成 last_nine_grid_level 更新', () => {
    const wb = makeWordbank()
    const wordbankMap = new Map([['新概念1', wb]])
    const progressMap = new Map([['s1', [makeProgress({ current_level: 15 })]]])

    const tasks: TaskBlock[] = [
      { type: 'nine_grid', wordbank_label: '新概念1' }
    ]

    const { updates } = collectWordbankProgressUpdates(
      [{ student_id: 's1', tasks }],
      wordbankMap,
      progressMap
    )

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({
      student_id: 's1',
      wordbank_id: 'wb-1',
      current_level: 15,
      last_nine_grid_level: 15,
    })
  })

  it('应该为没有现有进度的新学员生成更新', () => {
    const wb = makeWordbank()
    const wordbankMap = new Map([['新概念1', wb]])
    const progressMap = new Map<string, StudentWordbankProgress[]>()

    const tasks: TaskBlock[] = [
      { type: 'vocab_new', wordbank_label: '新概念1', level_from: 1, level_to: 5 }
    ]

    const { updates } = collectWordbankProgressUpdates(
      [{ student_id: 's1', tasks }],
      wordbankMap,
      progressMap
    )

    expect(updates).toHaveLength(1)
    expect(updates[0].current_level).toBe(5)
  })

  it('应该忽略不在词库中的任务', () => {
    const wordbankMap = new Map<string, Wordbank>()
    const progressMap = new Map<string, StudentWordbankProgress[]>()

    const tasks: TaskBlock[] = [
      { type: 'vocab_new', wordbank_label: '不存在的词库', level_from: 1, level_to: 5 }
    ]

    const { updates } = collectWordbankProgressUpdates(
      [{ student_id: 's1', tasks }],
      wordbankMap,
      progressMap
    )

    expect(updates).toHaveLength(0)
  })

  it('应该优先使用 level_reached 而非 level_to', () => {
    const wb = makeWordbank()
    const wordbankMap = new Map([['新概念1', wb]])
    const progressMap = new Map<string, StudentWordbankProgress[]>()

    const tasks: TaskBlock[] = [
      { type: 'vocab_new', wordbank_label: '新概念1', level_from: 1, level_to: 10, level_reached: 7 }
    ]

    const { updates } = collectWordbankProgressUpdates(
      [{ student_id: 's1', tasks }],
      wordbankMap,
      progressMap
    )

    expect(updates).toHaveLength(1)
    expect(updates[0].current_level).toBe(7)
  })

  it('应该处理多条记录多个学员', () => {
    const wb = makeWordbank()
    const wordbankMap = new Map([['新概念1', wb]])
    const progressMap = new Map<string, StudentWordbankProgress[]>()

    const records = [
      { student_id: 's1', tasks: [{ type: 'vocab_new' as const, wordbank_label: '新概念1', level_to: 5 }] },
      { student_id: 's2', tasks: [{ type: 'vocab_new' as const, wordbank_label: '新概念1', level_to: 3 }] },
    ]

    const { updates } = collectWordbankProgressUpdates(records, wordbankMap, progressMap)

    expect(updates).toHaveLength(2)
    expect(updates.map(u => u.student_id)).toEqual(['s1', 's2'])
  })
})
