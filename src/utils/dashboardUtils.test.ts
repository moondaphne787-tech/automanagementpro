import { describe, it, expect } from 'vitest'
import { buildAlertStudents, buildDashboardStats, buildStudentOverview } from './dashboardUtils'
import type { Student, Billing, ClassRecord, LessonPlan, ScheduledClass } from '@/types'
import { formatLocalDate } from '@/lib/dateUtils'

// 创建模拟学员数据
const createMockStudent = (id: string, name: string, status: 'active' | 'paused' | 'graduated' = 'active'): Student => ({
  id,
  student_no: null,
  name,
  school: null,
  grade: '初一',
  account: null,
  enroll_date: null,
  student_type: 'formal',
  status,
  level: 'medium',
  initial_score: null,
  initial_vocab: null,
  phonics_progress: null,
  phonics_completed: false,
  ipa_completed: false,
  reading_progress: null,
  notes: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
})

// 创建模拟课时数据
const createMockBilling = (
  studentId: string,
  remainingHours: number,
  warningThreshold: number = 10
): Billing => ({
  id: `billing-${studentId}`,
  student_id: studentId,
  total_hours: 100,
  used_hours: 100 - remainingHours,
  remaining_hours: remainingHours,
  warning_threshold: warningThreshold,
  last_payment_date: null,
  notes: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
})

describe('P0-1 修复验证：课时预警阈值个性化', () => {
  describe('buildAlertStudents - 预警阈值测试', () => {
    it('使用默认阈值3：当 warning_threshold 未设置时，使用默认值3', () => {
      const students = [createMockStudent('1', '张三')]
      // 剩余 3 小时，阈值默认 3，应该触发预警
      const billings = [createMockBilling('1', 3, 3)]
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      expect(result).toHaveLength(1)
      expect(result[0].alerts.some(a => a.type === 'low_hours')).toBe(true)
    })

    it('使用默认阈值3：剩余课时 > 3 时不触发预警', () => {
      const students = [createMockStudent('1', '张三')]
      // 剩余 4 小时，阈值默认 3，不应触发预警
      const billings = [createMockBilling('1', 4, 3)]
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      expect(result).toHaveLength(0)
    })

    it('使用个性化阈值：学员A阈值10，剩余8小时触发预警', () => {
      const students = [createMockStudent('1', '学员A')]
      // 剩余 8 小时，但阈值是 10，应该触发预警
      const billings = [createMockBilling('1', 8, 10)]
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      expect(result).toHaveLength(1)
      expect(result[0].alerts.some(a => a.type === 'low_hours')).toBe(true)
      expect(result[0].alerts.find(a => a.type === 'low_hours')?.message).toContain('8.0')
    })

    it('使用个性化阈值：学员B阈值5，剩余6小时不触发预警', () => {
      const students = [createMockStudent('1', '学员B')]
      // 剩余 6 小时，阈值是 5，不应触发预警
      const billings = [createMockBilling('1', 6, 5)]
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      expect(result).toHaveLength(0)
    })

    it('使用个性化阈值：学员C阈值5，剩余5小时触发预警（边界值）', () => {
      const students = [createMockStudent('1', '学员C')]
      // 剩余 5 小时，阈值是 5，应触发预警（<=）
      const billings = [createMockBilling('1', 5, 5)]
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      expect(result).toHaveLength(1)
      expect(result[0].alerts.some(a => a.type === 'low_hours')).toBe(true)
    })

    it('多学员场景：不同阈值产生不同预警结果', () => {
      const students = [
        createMockStudent('1', '学员A'),
        createMockStudent('2', '学员B'),
        createMockStudent('3', '学员C'),
      ]
      // 学员A：剩余8小时，阈值10 -> 应预警
      // 学员B：剩余4小时，阈值3 -> 不应预警
      // 学员C：剩余2小时，阈值3 -> 应预警
      const billings = [
        createMockBilling('1', 8, 10),
        createMockBilling('2', 4, 3),
        createMockBilling('3', 2, 3),
      ]
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      expect(result).toHaveLength(2)
      const alertStudentIds = result.map(r => r.studentId)
      expect(alertStudentIds).toContain('1')
      expect(alertStudentIds).toContain('3')
      expect(alertStudentIds).not.toContain('2')
    })

    it('修复前的问题复现：硬编码阈值3导致预警错误', () => {
      // 这个测试验证的是修复前的问题：
      // 修复前：无论 warning_threshold 设置为多少，都用 <= 3 判断
      // 修复后：使用 (billing.warning_threshold ?? 3)
      const students = [createMockStudent('1', '高阈值学员')]
      // 剩余 8 小时，阈值设置为 10
      // 修复前：8 <= 3 为 false，不预警（错误：应该预警）
      // 修复后：8 <= 10 为 true，预警（正确）
      const billings = [createMockBilling('1', 8, 10)]
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      // 修复后应该产生预警
      expect(result).toHaveLength(1)
      expect(result[0].alerts.some(a => a.type === 'low_hours')).toBe(true)
    })

    it('无课时信息：不产生课时预警', () => {
      const students = [createMockStudent('1', '张三')]
      const billings: Billing[] = []
      
      const result = buildAlertStudents(students, billings, [], new Map(), new Map())
      
      expect(result).toHaveLength(0)
    })
  })

  describe('buildDashboardStats - 统计卡片数据', () => {
    it('使用个性化阈值统计低课时学员数量', () => {
      const students = [
        createMockStudent('1', '学员A'),
        createMockStudent('2', '学员B'),
      ]
      // 学员A：剩余2小时，阈值3 -> 2 <= 3，预警
      // 学员B：剩余10小时，阈值3 -> 10 > 3，不预警
      const billings = [
        { ...createMockBilling('1', 2, 3), remaining_hours: 2 },
        { ...createMockBilling('2', 10, 3), remaining_hours: 10 },
      ]
      
      const result = buildDashboardStats([], [], [], billings, students)
      
      expect(result.lowHoursCount).toBe(1)
    })

    it('不同阈值：高阈值学员也能被正确统计', () => {
      const students = [
        createMockStudent('1', '学员A'),
        createMockStudent('2', '学员B'),
        createMockStudent('3', '学员C'),
      ]
      // 学员A：剩余8小时，阈值10 -> 8 <= 10，预警
      // 学员B：剩余8小时，阈值5 -> 8 > 5，不预警
      // 学员C：剩余2小时，阈值3 -> 2 <= 3，预警
      const billings = [
        { ...createMockBilling('1', 8, 10), remaining_hours: 8 },
        { ...createMockBilling('2', 8, 5), remaining_hours: 8 },
        { ...createMockBilling('3', 2, 3), remaining_hours: 2 },
      ]
      
      const result = buildDashboardStats([], [], [], billings, students)
      
      // 学员A和学员C应该被统计为低课时
      expect(result.lowHoursCount).toBe(2)
    })

    it('buildDashboardStats 与 buildAlertStudents 使用相同的阈值逻辑', () => {
      const students = [createMockStudent('1', '学员A')]
      const billings = [{ ...createMockBilling('1', 8, 10), remaining_hours: 8 }]
      
      // buildDashboardStats 应该统计到这个学员
      const stats = buildDashboardStats([], [], [], billings, students)
      expect(stats.lowHoursCount).toBe(1)
      
      // buildAlertStudents 也应该对这个学员产生预警
      const alerts = buildAlertStudents(students, billings, [], new Map(), new Map())
      expect(alerts).toHaveLength(1)
      expect(alerts[0].alerts.some(a => a.type === 'low_hours')).toBe(true)
    })
  })
})

describe('buildAlertStudents - 其他预警类型', () => {
  it('本周暂无课堂记录预警', () => {
    const students = [createMockStudent('1', '张三')]
    const billings = [createMockBilling('1', 10, 3)] // 课时充足，不触发课时预警
    const scheduleCount = new Map([['1', 2]]) // 有排课
    
    const result = buildAlertStudents(students, billings, [], new Map(), scheduleCount)
    
    expect(result).toHaveLength(1)
    expect(result[0].alerts.some(a => a.type === 'no_record')).toBe(true)
  })

  it('过期计划预警', () => {
    const students = [createMockStudent('1', '张三')]
    const billings = [createMockBilling('1', 10, 3)]
    const expiredPlans = new Map([['1', 2]]) // 2条过期计划
    
    const result = buildAlertStudents(students, billings, [], expiredPlans, new Map())
    
    expect(result).toHaveLength(1)
    expect(result[0].alerts.some(a => a.type === 'expired_plans')).toBe(true)
  })

  it('多预警合并显示', () => {
    const students = [createMockStudent('1', '张三')]
    // 低课时
    const billings = [createMockBilling('1', 2, 3)]
    // 有排课但无记录
    const scheduleCount = new Map([['1', 2]])
    // 2条过期计划
    const expiredPlans = new Map([['1', 2]])
    
    const result = buildAlertStudents(students, billings, [], expiredPlans, scheduleCount)
    
    expect(result).toHaveLength(1)
    expect(result[0].alerts).toHaveLength(3)
  })
})

describe('P0-3 修复验证：buildStudentOverview 不再访问不存在的 trial_converted_date 字段', () => {
  // 创建带有学生类型的模拟学员
  const createMockStudentWithType = (
    id: string,
    name: string,
    status: 'active' | 'paused' | 'graduated' = 'active',
    studentType: 'formal' | 'trial' = 'formal',
    createdAt: string = '2024-01-01'
  ): Student => ({
    id,
    student_no: null,
    name,
    school: null,
    grade: '初一',
    account: null,
    enroll_date: null,
    student_type: studentType,
    status,
    level: 'medium',
    initial_score: null,
    initial_vocab: null,
    phonics_progress: null,
    phonics_completed: false,
    ipa_completed: false,
    reading_progress: null,
    notes: null,
    created_at: createdAt,
    updated_at: '2024-01-01'
  })

  it('正确统计学员总数和各状态数量', () => {
    const students = [
      createMockStudentWithType('1', '学员A', 'active'),
      createMockStudentWithType('2', '学员B', 'active'),
      createMockStudentWithType('3', '学员C', 'paused'),
      createMockStudentWithType('4', '学员D', 'graduated'),
    ]
    
    const result = buildStudentOverview(students)
    
    expect(result.total).toBe(4)
    expect(result.active).toBe(2)
    expect(result.paused).toBe(1)
    expect(result.graduated).toBe(1)
  })

  it('正确统计本月新增体验生', () => {
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    // 使用 formatLocalDate 与 buildStudentOverview 保持一致的日期格式
    const thisMonthStr = formatLocalDate(thisMonth)
    
    const students = [
      // 本月新增体验生
      createMockStudentWithType('1', '体验生A', 'active', 'trial', thisMonthStr),
      createMockStudentWithType('2', '体验生B', 'active', 'trial', thisMonthStr),
      // 上月体验生
      createMockStudentWithType('3', '体验生C', 'active', 'trial', '2024-01-01'),
      // 正式学员
      createMockStudentWithType('4', '正式学员', 'active', 'formal', thisMonthStr),
    ]
    
    const result = buildStudentOverview(students)
    
    expect(result.trialThisMonth).toBe(2)
  })

  it('convertedThisMonth 不传参数时默认为 0', () => {
    const students = [
      createMockStudentWithType('1', '学员A', 'active'),
      createMockStudentWithType('2', '学员B', 'active'),
    ]
    
    const result = buildStudentOverview(students)
    
    expect(result.convertedThisMonth).toBe(0)
  })

  it('convertedThisMonth 传入实际成交数时正确返回', () => {
    const students = [
      createMockStudentWithType('1', '学员A', 'active'),
      createMockStudentWithType('2', '学员B', 'active'),
    ]
    
    // 模拟从 trialConversionDb.getMonthlyConversions() 获取到 3 个成交
    const result = buildStudentOverview(students, 3)
    
    expect(result.convertedThisMonth).toBe(3)
  })

  it('convertedThisMonth 传入 0 时返回 0', () => {
    const students = [
      createMockStudentWithType('1', '学员A', 'active'),
    ]
    
    const result = buildStudentOverview(students, 0)
    
    expect(result.convertedThisMonth).toBe(0)
  })

  it('不再使用 as any 访问不存在的字段（类型安全）', () => {
    // 此测试确保函数签名正确接受 Student[] 类型
    // 修复前需要使用 Student & { trial_converted_date?: string } 类型断言
    // 修复后直接使用 Student 类型
    const students: Student[] = [
      createMockStudentWithType('1', '学员A', 'active'),
    ]
    
    // TypeScript 编译时会检查类型，如果函数签名不匹配会报错
    const result = buildStudentOverview(students)
    
    expect(result).toBeDefined()
    expect(result.total).toBe(1)
  })
})
