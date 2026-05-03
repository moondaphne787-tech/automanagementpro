import { describe, it, expect } from 'vitest'
import { collectTeacherHoursUpdates } from './classRecordService'

describe('collectTeacherHoursUpdates', () => {
  it('应该按助教姓名汇总课时', () => {
    const records = [
      { teacher_name: '张三', duration_hours: 1.5 },
      { teacher_name: '李四', duration_hours: 2 },
      { teacher_name: '张三', duration_hours: 1 },
    ]

    const result = collectTeacherHoursUpdates(records)

    expect(result.get('张三')).toBe(2.5)
    expect(result.get('李四')).toBe(2)
    expect(result.size).toBe(2)
  })

  it('应该忽略没有助教名称的记录', () => {
    const records = [
      { teacher_name: undefined, duration_hours: 1.5 },
      { teacher_name: '张三', duration_hours: 2 },
    ]

    const result = collectTeacherHoursUpdates(records)

    expect(result.size).toBe(1)
    expect(result.get('张三')).toBe(2)
  })

  it('应该忽略没有课时的记录', () => {
    const records = [
      { teacher_name: '张三', duration_hours: undefined },
      { teacher_name: '张三', duration_hours: 0 },
      { teacher_name: '张三', duration_hours: 1 },
    ]

    const result = collectTeacherHoursUpdates(records)

    expect(result.size).toBe(1)
    expect(result.get('张三')).toBe(1)
  })

  it('空记录应该返回空 Map', () => {
    const result = collectTeacherHoursUpdates([])
    expect(result.size).toBe(0)
  })

  it('应该正确处理小数课时', () => {
    const records = [
      { teacher_name: '张三', duration_hours: 0.5 },
      { teacher_name: '张三', duration_hours: 0.75 },
      { teacher_name: '张三', duration_hours: 1.25 },
    ]

    const result = collectTeacherHoursUpdates(records)

    expect(result.get('张三')).toBe(2.5)
  })
})
