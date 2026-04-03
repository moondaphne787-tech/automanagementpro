import { describe, it, expect } from 'vitest'
import type { ClassRecordRow, LessonPlanRow, StudentRow } from './utils'
import {
  parseTasks, mapClassRecord, mapLessonPlan, mapStudent,
  isAllowedField,
  STUDENT_UPDATABLE_FIELDS,
  CLASS_RECORD_UPDATABLE_FIELDS,
  LESSON_PLAN_UPDATABLE_FIELDS,
  BILLING_UPDATABLE_FIELDS,
  EXAM_SCORE_UPDATABLE_FIELDS,
  LEARNING_PHASE_UPDATABLE_FIELDS,
  TRIAL_CONVERSION_UPDATABLE_FIELDS,
  TEACHER_UPDATABLE_FIELDS,
  TEACHER_AVAILABILITY_UPDATABLE_FIELDS,
  STUDENT_SCHEDULE_PREFERENCE_UPDATABLE_FIELDS,
  SCHEDULED_CLASS_UPDATABLE_FIELDS,
  WORDBANK_UPDATABLE_FIELDS,
  TODO_UPDATABLE_FIELDS,
} from './utils'

describe('parseTasks', () => {
  it('应该解析有效的 JSON 字符串', () => {
    const json = JSON.stringify([{ type: 'vocab_new', wordbank_label: '词库A', level_from: 1, level_to: 3 }])
    const result = parseTasks(json)
    expect(result).toEqual([{ type: 'vocab_new', wordbank_label: '词库A', level_from: 1, level_to: 3 }])
  })

  it('应该处理 null/undefined 返回空数组', () => {
    expect(parseTasks(null)).toEqual([])
    expect(parseTasks(undefined)).toEqual([])
  })

  it('应该处理空字符串返回空数组', () => {
    expect(parseTasks('')).toEqual([])
  })

  it('应该处理无效 JSON 返回空数组', () => {
    expect(parseTasks('not valid json')).toEqual([])
  })

  it('应该处理非数组 JSON 返回空数组', () => {
    expect(parseTasks('{"key": "value"}')).toEqual([])
  })

  it('应该直接返回已经是数组的输入', () => {
    const tasks = [{ type: 'phonics' as const }]
    expect(parseTasks(tasks)).toBe(tasks)
  })

  it('应该处理 "[]" 字符串', () => {
    expect(parseTasks('[]')).toEqual([])
  })
})

describe('mapClassRecord', () => {
  it('应该正确转换数据库原始行', () => {
    const row = {
      id: 'test-id',
      student_id: 'student-1',
      class_date: '2026-04-01',
      duration_hours: 1,
      teacher_name: '张老师',
      attendance: 'present',
      tasks: JSON.stringify([{ type: 'vocab_new', level_from: 1, level_to: 3 }]),
      task_completed: 'completed',
      incomplete_reason: null,
      performance: 'good',
      detail_feedback: null,
      highlights: null,
      issues: null,
      checkin_completed: 1,
      phase_id: null,
      plan_id: null,
      imported_from_excel: 0,
      created_at: '2026-04-01T00:00:00Z'
    }

    const result = mapClassRecord(row as ClassRecordRow)

    expect(result.tasks).toEqual([{ type: 'vocab_new', level_from: 1, level_to: 3 }])
    expect(result.checkin_completed).toBe(true)
    expect(result.imported_from_excel).toBe(false)
    expect(result.plan_id).toBeNull()
  })

  it('应该将 SQLite 的 0/1 正确转换为布尔值', () => {
    const row = {
      id: 'test-id',
      tasks: '[]',
      checkin_completed: 0,
      imported_from_excel: 1,
      plan_id: 'plan-123',
    }

    const result = mapClassRecord(row as unknown as ClassRecordRow)

    expect(result.checkin_completed).toBe(false)
    expect(result.imported_from_excel).toBe(true)
    expect(result.plan_id).toBe('plan-123')
  })

  it('应该处理 tasks 为 null 的情况', () => {
    const row = {
      id: 'test-id',
      tasks: null,
      checkin_completed: 0,
      imported_from_excel: 0,
      plan_id: undefined,
    }

    const result = mapClassRecord(row as unknown as ClassRecordRow)

    expect(result.tasks).toEqual([])
    expect(result.plan_id).toBeNull()
  })
})

describe('mapLessonPlan', () => {
  it('应该正确转换数据库原始行', () => {
    const row = {
      id: 'plan-1',
      student_id: 'student-1',
      phase_id: null,
      plan_date: '2026-04-01',
      tasks: JSON.stringify([{ type: 'reading', content: '阅读训练' }]),
      notes: '备注',
      ai_reason: null,
      generated_by_ai: 1,
      created_at: '2026-04-01T00:00:00Z'
    }

    const result = mapLessonPlan(row as LessonPlanRow)

    expect(result.tasks).toEqual([{ type: 'reading', content: '阅读训练' }])
    expect(result.generated_by_ai).toBe(true)
  })

  it('应该将 generated_by_ai 的 0 转换为 false', () => {
    const row = {
      id: 'plan-2',
      tasks: '[]',
      generated_by_ai: 0,
    }

    const result = mapLessonPlan(row as unknown as LessonPlanRow)

    expect(result.generated_by_ai).toBe(false)
    expect(result.tasks).toEqual([])
  })

  it('应该处理 tasks 为无效 JSON 的情况', () => {
    const row = {
      id: 'plan-3',
      tasks: 'invalid',
      generated_by_ai: 0,
    }

    const result = mapLessonPlan(row as unknown as LessonPlanRow)

    expect(result.tasks).toEqual([])
  })
})

describe('mapStudent', () => {
  it('应该正确转换布尔字段', () => {
    const row = {
      id: 'student-1',
      name: '张三',
      phonics_completed: 1,
      ipa_completed: 0,
      status: 'active',
    }

    const result = mapStudent(row as unknown as StudentRow)

    expect(result.phonics_completed).toBe(true)
    expect(result.ipa_completed).toBe(false)
    expect(result.name).toBe('张三')
  })

  it('应该处理 null/undefined 布尔字段', () => {
    const row = {
      id: 'student-2',
      name: '李四',
      phonics_completed: null,
      ipa_completed: undefined,
    }

    const result = mapStudent(row as unknown as StudentRow)

    expect(result.phonics_completed).toBe(false)
    expect(result.ipa_completed).toBe(false)
  })

  it('应该保留其他字段不变', () => {
    const row = {
      id: 'student-3',
      name: '王五',
      school: '实验小学',
      grade: '五年级',
      phonics_completed: 1,
      ipa_completed: 1,
      level: 'medium',
      notes: '优秀学员',
    }

    const result = mapStudent(row as unknown as StudentRow)

    expect(result.id).toBe('student-3')
    expect(result.school).toBe('实验小学')
    expect(result.grade).toBe('五年级')
    expect(result.level).toBe('medium')
    expect(result.notes).toBe('优秀学员')
    expect(result.phonics_completed).toBe(true)
    expect(result.ipa_completed).toBe(true)
  })
})

describe('isAllowedField - SQL 注入防护白名单校验', () => {
  it('应该允许白名单中的合法字段', () => {
    expect(isAllowedField('name', STUDENT_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('school', STUDENT_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('grade', STUDENT_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('status', STUDENT_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('phonics_completed', STUDENT_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('ipa_completed', STUDENT_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('notes', STUDENT_UPDATABLE_FIELDS)).toBe(true)
  })

  it('应该拒绝不在白名单中的字段（如 id、created_at）', () => {
    expect(isAllowedField('id', STUDENT_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('created_at', STUDENT_UPDATABLE_FIELDS)).toBe(false)
  })

  it('应该拒绝 SQL 注入攻击字段名', () => {
    expect(isAllowedField('id; DROP TABLE students--', STUDENT_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField("name' OR '1'='1", STUDENT_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('1=1; --', STUDENT_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('Robert"); DROP TABLE students;--', STUDENT_UPDATABLE_FIELDS)).toBe(false)
  })

  it('应该拒绝空字符串和特殊字符字段名', () => {
    expect(isAllowedField('', STUDENT_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField(' ', STUDENT_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('*', STUDENT_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('name = ?; DELETE FROM students WHERE 1', STUDENT_UPDATABLE_FIELDS)).toBe(false)
  })

  it('应该对所有表的白名单正确工作', () => {
    // ClassRecord
    expect(isAllowedField('tasks', CLASS_RECORD_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('checkin_completed', CLASS_RECORD_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', CLASS_RECORD_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('created_at', CLASS_RECORD_UPDATABLE_FIELDS)).toBe(false)

    // LessonPlan
    expect(isAllowedField('tasks', LESSON_PLAN_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('generated_by_ai', LESSON_PLAN_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', LESSON_PLAN_UPDATABLE_FIELDS)).toBe(false)

    // Billing
    expect(isAllowedField('total_hours', BILLING_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('used_hours', BILLING_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', BILLING_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('student_id', BILLING_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('remaining_hours', BILLING_UPDATABLE_FIELDS)).toBe(false)

    // ExamScore
    expect(isAllowedField('score', EXAM_SCORE_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', EXAM_SCORE_UPDATABLE_FIELDS)).toBe(false)

    // LearningPhase
    expect(isAllowedField('phase_name', LEARNING_PHASE_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', LEARNING_PHASE_UPDATABLE_FIELDS)).toBe(false)

    // TrialConversion
    expect(isAllowedField('converted', TRIAL_CONVERSION_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', TRIAL_CONVERSION_UPDATABLE_FIELDS)).toBe(false)

    // Teacher
    expect(isAllowedField('suitable_levels', TEACHER_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('teacher_types', TEACHER_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', TEACHER_UPDATABLE_FIELDS)).toBe(false)

    // TeacherAvailability
    expect(isAllowedField('day_of_week', TEACHER_AVAILABILITY_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', TEACHER_AVAILABILITY_UPDATABLE_FIELDS)).toBe(false)

    // StudentSchedulePreference
    expect(isAllowedField('preferred_start', STUDENT_SCHEDULE_PREFERENCE_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', STUDENT_SCHEDULE_PREFERENCE_UPDATABLE_FIELDS)).toBe(false)

    // ScheduledClass
    expect(isAllowedField('status', SCHEDULED_CLASS_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('cancel_reason', SCHEDULED_CLASS_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', SCHEDULED_CLASS_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('created_at', SCHEDULED_CLASS_UPDATABLE_FIELDS)).toBe(false)

    // Wordbank
    expect(isAllowedField('name', WORDBANK_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('total_levels', WORDBANK_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', WORDBANK_UPDATABLE_FIELDS)).toBe(false)

    // Todo
    expect(isAllowedField('content', TODO_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('completed', TODO_UPDATABLE_FIELDS)).toBe(true)
    expect(isAllowedField('id', TODO_UPDATABLE_FIELDS)).toBe(false)
    expect(isAllowedField('created_at', TODO_UPDATABLE_FIELDS)).toBe(false)
  })

  it('白名单不应包含 id 和 created_at 字段', () => {
    const allWhitelists = [
      STUDENT_UPDATABLE_FIELDS,
      CLASS_RECORD_UPDATABLE_FIELDS,
      LESSON_PLAN_UPDATABLE_FIELDS,
      BILLING_UPDATABLE_FIELDS,
      EXAM_SCORE_UPDATABLE_FIELDS,
      LEARNING_PHASE_UPDATABLE_FIELDS,
      TRIAL_CONVERSION_UPDATABLE_FIELDS,
      TEACHER_UPDATABLE_FIELDS,
      TEACHER_AVAILABILITY_UPDATABLE_FIELDS,
      STUDENT_SCHEDULE_PREFERENCE_UPDATABLE_FIELDS,
      SCHEDULED_CLASS_UPDATABLE_FIELDS,
      WORDBANK_UPDATABLE_FIELDS,
      TODO_UPDATABLE_FIELDS,
    ]

    for (const whitelist of allWhitelists) {
      expect(whitelist.has('id')).toBe(false)
      expect(whitelist.has('created_at')).toBe(false)
    }
  })

  it('Billing 白名单不应包含 remaining_hours（生成列）和 student_id', () => {
    expect(BILLING_UPDATABLE_FIELDS.has('remaining_hours')).toBe(false)
    expect(BILLING_UPDATABLE_FIELDS.has('student_id')).toBe(false)
  })
})
