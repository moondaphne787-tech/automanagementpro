import { describe, it, expect } from 'vitest'
import { matchTeacherByName, formatDateCN } from './utils'
import type { Teacher } from '@/types'

// 创建模拟助教数据
const createMockTeacher = (id: string, name: string, training_stage: 'probation' | 'intern' | 'formal', total_teaching_hours: number): Teacher => ({
  id,
  name,
  phone: null,
  university: null,
  major: null,
  enroll_date: null,
  status: 'active',
  vocab_level: null,
  oral_level: 'intermediate',
  teaching_style: null,
  suitable_grades: null,
  suitable_levels: null,
  training_stage,
  teacher_types: ['regular'],
  total_teaching_hours,
  notes: null,
  created_at: '2024-01-01'
})

const mockTeachers: Teacher[] = [
  createMockTeacher('1', '张三', 'formal', 10),
  createMockTeacher('2', '张小明', 'intern', 5),
  createMockTeacher('3', '李四', 'probation', 0),
  createMockTeacher('4', '王五', 'formal', 20)
]

describe('matchTeacherByName', () => {
  it('精确匹配：完全匹配助教姓名', () => {
    const result = matchTeacherByName('张三', mockTeachers)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('张三')
    expect(result?.id).toBe('1')
  })

  it('精确匹配：完全匹配另一个助教姓名', () => {
    const result = matchTeacherByName('李四', mockTeachers)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('李四')
    expect(result?.id).toBe('3')
  })

  it('前缀匹配：唯一前缀匹配成功', () => {
    // "王" 只能匹配到 "王五"，是唯一前缀匹配
    const result = matchTeacherByName('王', mockTeachers)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('王五')
    expect(result?.id).toBe('4')
  })

  it('前缀匹配：多个前缀匹配返回 null', () => {
    // "张" 能匹配到 "张三" 和 "张小明"，无法唯一匹配
    const result = matchTeacherByName('张', mockTeachers)
    expect(result).toBeNull()
  })

  it('包含匹配：唯一包含匹配成功', () => {
    // "小明" 只包含在 "张小明" 中
    const result = matchTeacherByName('小明', mockTeachers)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('张小明')
    expect(result?.id).toBe('2')
  })

  it('包含匹配：多个包含匹配返回 null', () => {
    // 创建一个包含多个匹配的场景
    const teachersWithSamePart: Teacher[] = [
      createMockTeacher('1', '张明', 'formal', 10),
      createMockTeacher('2', '李明', 'intern', 5)
    ]
    // "明" 包含在两个名字中，无法唯一匹配
    const result = matchTeacherByName('明', teachersWithSamePart)
    expect(result).toBeNull()
  })

  it('无匹配：不存在的助教姓名返回 null', () => {
    const result = matchTeacherByName('赵六', mockTeachers)
    expect(result).toBeNull()
  })

  it('空输入：空字符串返回 null', () => {
    const result = matchTeacherByName('', mockTeachers)
    expect(result).toBeNull()
  })

  it('空列表：空助教列表返回 null', () => {
    const result = matchTeacherByName('张三', [])
    expect(result).toBeNull()
  })

  it('包含匹配：单字名称不会触发包含匹配（需要>=2字）', () => {
    // 输入只有一个字符，不会触发包含匹配
    const result = matchTeacherByName('三', mockTeachers)
    expect(result).toBeNull()
  })

  describe('P0-1 修复验证：创建和删除使用相同的匹配逻辑', () => {
    it('场景模拟：创建时用"张三"精确匹配，删除时同样精确匹配', () => {
      // 创建时输入 "张三"
      const createMatch = matchTeacherByName('张三', mockTeachers)
      expect(createMatch?.id).toBe('1')
      
      // 删除时 record.teacher_name 保存的是 "张三"，同样精确匹配
      const deleteMatch = matchTeacherByName('张三', mockTeachers)
      expect(deleteMatch?.id).toBe('1')
      
      // 匹配结果一致，课时正确回滚
      expect(createMatch?.id).toBe(deleteMatch?.id)
    })

    it('场景模拟：创建时用"王"前缀匹配，删除时同样前缀匹配', () => {
      // 创建时输入 "王"（唯一前缀匹配到 "王五"）
      const createMatch = matchTeacherByName('王', mockTeachers)
      expect(createMatch?.id).toBe('4')
      
      // 删除时 record.teacher_name 保存的是 "王"，同样前缀匹配
      const deleteMatch = matchTeacherByName('王', mockTeachers)
      expect(deleteMatch?.id).toBe('4')
      
      // 匹配结果一致，课时正确回滚
      expect(createMatch?.id).toBe(deleteMatch?.id)
    })

    it('场景模拟：创建时用"小明"包含匹配，删除时同样包含匹配', () => {
      // 创建时输入 "小明"（唯一包含匹配到 "张小明"）
      const createMatch = matchTeacherByName('小明', mockTeachers)
      expect(createMatch?.id).toBe('2')
      
      // 删除时 record.teacher_name 保存的是 "小明"，同样包含匹配
      const deleteMatch = matchTeacherByName('小明', mockTeachers)
      expect(deleteMatch?.id).toBe('2')
      
      // 匹配结果一致，课时正确回滚
      expect(createMatch?.id).toBe(deleteMatch?.id)
    })

    it('问题场景：如果创建时无法唯一匹配，删除时也无法匹配（课时不会错误累加/回滚）', () => {
      // 创建时输入 "张" 无法唯一匹配
      const createMatch = matchTeacherByName('张', mockTeachers)
      expect(createMatch).toBeNull()
      
      // 课时不会累加（因为没有匹配到助教）
      // 删除时同样无法匹配
      const deleteMatch = matchTeacherByName('张', mockTeachers)
      expect(deleteMatch).toBeNull()
      
      // 课时不会回滚（因为没有匹配到助教）
      // 这是正确的行为：无法匹配时跳过课时操作
    })
  })
})

describe('formatDateCN', () => {
  it('格式化日期字符串为中文格式 (YYYY/MM/DD)', () => {
    const result = formatDateCN('2024-03-15')
    expect(result).toBe('2024/03/15')
  })

  it('格式化 Date 对象为中文格式', () => {
    const date = new Date(2024, 2, 15) // 本地 2024年3月15日
    const result = formatDateCN(date)
    expect(result).toContain('2024')
    expect(result).toContain('03')
    expect(result).toContain('15')
  })

  it('空值返回 "-"', () => {
    expect(formatDateCN(null)).toBe('-')
    expect(formatDateCN(undefined)).toBe('-')
    expect(formatDateCN('')).toBe('-')
  })

  it('使用中文本地化格式', () => {
    const date = new Date('2024-01-05')
    const result = formatDateCN(date)
    // 中文格式使用 zh-CN，格式为 YYYY/MM/DD
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/)
  })

  it('处理年末日期', () => {
    const result = formatDateCN('2024-12-31')
    expect(result).toBe('2024/12/31')
  })

  it('处理年初日期', () => {
    const result = formatDateCN('2024-01-01')
    expect(result).toBe('2024/01/01')
  })
})
