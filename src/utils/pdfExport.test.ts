import { describe, it, expect } from 'vitest'
import type { Student, LessonPlan } from '@/types'

// 测试 P0-2 修复：程度等级映射
// 由于 getLevelText 是内部函数，我们通过测试导出函数来间接验证

describe('P0-2 修复验证：pdfExport.ts 程度等级映射', () => {
  // 创建模拟学员数据
  const createMockStudent = (level: 'weak' | 'medium' | 'advanced'): Student => ({
    id: '1',
    student_no: null,
    name: '测试学员',
    school: null,
    grade: '初一',
    account: null,
    enroll_date: null,
    student_type: 'formal',
    status: 'active',
    level,  // 使用传入的 level 值
    initial_score: null,
    initial_vocab: null,
    phonics_progress: null,
    phonics_completed: false,
    ipa_completed: false,
    reading_progress: null,
    learning_target: null,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  })

  const createMockPlan = (): LessonPlan => ({
    id: '1',
    student_id: '1',
    phase_id: null,
    plan_date: '2024-01-15',
    tasks: [],
    notes: null,
    ai_reason: null,
    generated_by_ai: false,
    plan_status_json: null,
    created_at: '2024-01-01'
  })

  describe('getLevelText 程度等级映射测试', () => {
    it('level 为 weak 时显示"基础薄弱"', async () => {
      const { printLessonPlan } = await import('./pdfExport')
      const student = createMockStudent('weak')
      const plan = createMockPlan()
      
      // 模拟获取 HTML 内容（不实际打开窗口）
      const originalOpen = window.open
      let htmlContent = ''
      window.open = (() => {
        return {
          document: {
            write: (html: string) => { htmlContent = html },
            close: () => {},
          },
          onload: null as (() => void) | null,
          print: () => {},
        } as unknown as Window
      }) as typeof window.open

      printLessonPlan(student, plan)
      
      window.open = originalOpen
      
      expect(htmlContent).toContain('基础薄弱')
      expect(htmlContent).not.toContain('非常优秀')
      expect(htmlContent).not.toContain('基础较好')
    })

    it('level 为 medium 时显示"基础较好"', async () => {
      const { printLessonPlan } = await import('./pdfExport')
      const student = createMockStudent('medium')
      const plan = createMockPlan()
      
      const originalOpen = window.open
      let htmlContent = ''
      window.open = (() => {
        return {
          document: {
            write: (html: string) => { htmlContent = html },
            close: () => {},
          },
          onload: null as (() => void) | null,
          print: () => {},
        } as unknown as Window
      }) as typeof window.open

      printLessonPlan(student, plan)
      
      window.open = originalOpen
      
      expect(htmlContent).toContain('基础较好')
      expect(htmlContent).not.toContain('基础薄弱')
      expect(htmlContent).not.toContain('非常优秀')
    })

    it('level 为 advanced 时显示"非常优秀"（P0-2 核心修复点）', async () => {
      // 这是 P0-2 的核心测试点：
      // 修复前：if (level === 'strong') return '非常优秀' - 永远不会匹配
      // 修复后：if (level === 'advanced') return '非常优秀' - 正确匹配
      const { printLessonPlan } = await import('./pdfExport')
      const student = createMockStudent('advanced')
      const plan = createMockPlan()
      
      const originalOpen = window.open
      let htmlContent = ''
      window.open = (() => {
        return {
          document: {
            write: (html: string) => { htmlContent = html },
            close: () => {},
          },
          onload: null as (() => void) | null,
          print: () => {},
        } as unknown as Window
      }) as typeof window.open

      printLessonPlan(student, plan)
      
      window.open = originalOpen
      
      // 验证修复后的关键点：advanced 应该显示 "非常优秀"
      expect(htmlContent).toContain('非常优秀')
      expect(htmlContent).not.toContain('基础薄弱')
      expect(htmlContent).not.toContain('基础较好')
      // 确保不再显示 "-" （修复前的错误行为）
      // 注意：减号可能出现在日期中，所以我们检查程度字段附近的显示
    })

    it('level 为 undefined 时显示"-"', async () => {
      const { printLessonPlan } = await import('./pdfExport')
      const student = { ...createMockStudent('medium'), level: undefined as unknown as 'medium' }
      const plan = createMockPlan()
      
      const originalOpen = window.open
      let htmlContent = ''
      window.open = (() => {
        return {
          document: {
            write: (html: string) => { htmlContent = html },
            close: () => {},
          },
          onload: null as (() => void) | null,
          print: () => {},
        } as unknown as Window
      }) as typeof window.open

      printLessonPlan(student, plan)
      
      window.open = originalOpen
      
      // 程度应该显示 "-"
      // 需要在程度字段检查，而不是简单的包含检查
      expect(htmlContent).toMatch(/程度<\/div>\s*<div class="info-value">-/)
    })

    it('批量导出时程度等级正确显示', async () => {
      const { exportMultipleLessonPlansPDF } = await import('./pdfExport')
      
      const students = [
        createMockStudent('weak'),
        createMockStudent('medium'),
        createMockStudent('advanced'),
      ]
      
      const plans = students.map((student, index) => ({
        student,
        plan: { ...createMockPlan(), id: String(index + 1), student_id: student.id }
      }))
      
      const originalOpen = window.open
      let htmlContent = ''
      window.open = (() => {
        return {
          document: {
            write: (html: string) => { htmlContent = html },
            close: () => {},
          },
          onload: null as (() => void) | null,
          print: () => {},
        } as unknown as Window
      }) as typeof window.open

      await exportMultipleLessonPlansPDF(plans)
      
      window.open = originalOpen
      
      // 验证所有三种程度都正确显示
      expect(htmlContent).toContain('基础薄弱')
      expect(htmlContent).toContain('基础较好')
      expect(htmlContent).toContain('非常优秀')
    })
  })

  describe('修复前后对比验证', () => {
    it('确认 advanced 不再被误判为未知等级', async () => {
      // 修复前的代码：
      // if (level === 'strong') return '非常优秀'  -> 错误：'advanced' !== 'strong'
      // return '-' -> 所以 advanced 返回 '-'
      
      // 修复后的代码：
      // if (level === 'advanced') return '非常优秀'  -> 正确
      
      const { printLessonPlan } = await import('./pdfExport')
      const student = createMockStudent('advanced')
      const plan = createMockPlan()
      
      const originalOpen = window.open
      let htmlContent = ''
      window.open = (() => {
        return {
          document: {
            write: (html: string) => { htmlContent = html },
            close: () => {},
          },
          onload: null as (() => void) | null,
          print: () => {},
        } as unknown as Window
      }) as typeof window.open

      printLessonPlan(student, plan)
      
      window.open = originalOpen
      
      // 核心断言：advanced 等级必须显示 "非常优秀"，而不是 "-"
      expect(htmlContent).toContain('非常优秀')
      
      // 确保不是显示默认值
      const levelMatch = htmlContent.match(/程度<\/div>\s*<div class="info-value">([^<]+)<\/div>/)
      expect(levelMatch).not.toBeNull()
      expect(levelMatch![1].trim()).toBe('非常优秀')
    })
  })
})