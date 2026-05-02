// 数据库工具函数
import type { TaskBlock, ClassRecord, LessonPlan, Student, Teacher, TrialConversion, TeacherType, DayOfWeek, StudentType, StudentStatus, LevelType } from '@/types'

// ===== 数据库行类型定义 =====
// SQLite 返回的原始行类型，布尔值为 0/1，JSON 字段为字符串

/** students 表原始行 */
export interface StudentRow {
  id: string
  student_no: string | null
  name: string
  school: string | null
  grade: string | null
  account: string | null
  enroll_date: string | null
  student_type: 'formal' | 'trial'
  status: 'active' | 'paused' | 'graduated'
  level: 'weak' | 'medium' | 'advanced'
  initial_score: number | null
  initial_vocab: number | null
  phonics_progress: string | null
  phonics_completed: number  // SQLite 0/1
  ipa_completed: number      // SQLite 0/1
  reading_progress: string | null
  learning_target: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** class_records 表原始行 */
export interface ClassRecordRow {
  id: string
  student_id: string
  class_date: string
  duration_hours: number
  teacher_name: string | null
  attendance: 'present' | 'absent' | 'late'
  tasks: string  // JSON 字符串
  task_completed: 'completed' | 'partial' | 'not_completed'
  incomplete_reason: string | null
  performance: 'excellent' | 'good' | 'needs_improvement'
  detail_feedback: string | null
  highlights: string | null
  issues: string | null
  checkin_completed: number  // SQLite 0/1
  phase_id: string | null
  plan_id: string | null
  imported_from_excel: number  // SQLite 0/1
  created_at: string
}

/** lesson_plans 表原始行 */
export interface LessonPlanRow {
  id: string
  student_id: string
  phase_id: string | null
  plan_date: string | null
  tasks: string  // JSON 字符串
  notes: string | null
  ai_reason: string | null
  generated_by_ai: number  // SQLite 0/1
  plan_status_json: string | null
  created_at: string
}

/** teachers 表原始行 */
export interface TeacherRow {
  id: string
  name: string
  phone: string | null
  university: string | null
  major: string | null
  enroll_date: string | null
  status: 'active' | 'inactive'
  vocab_level: string | null
  oral_level: 'basic' | 'intermediate' | 'advanced'
  teaching_style: string | null
  suitable_grades: string | null
  suitable_levels: string | null  // JSON 字符串
  training_stage: 'probation' | 'intern' | 'formal'
  teacher_types: string  // JSON 字符串
  total_teaching_hours: number
  notes: string | null
  created_at: string
}

/** trial_conversions 表原始行 */
export interface TrialConversionRow {
  id: string
  student_id: string
  trial_date: string | null
  conversion_date: string | null
  converted: number  // SQLite 0/1
  commission_note: string | null
  notes: string | null
  created_at: string
}

/** scheduled_classes JOIN students/teachers 的原始行 */
export interface ScheduledClassWithJoinRow {
  id: string
  student_id: string
  teacher_id: string | null
  class_date: string
  start_time: string | null
  end_time: string | null
  duration_hours: number
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  rescheduled_from_id: string | null
  cancel_reason: string | null
  notes: string | null
  created_at: string
  student_name: string
  grade: string | null
  level: string | null
  teacher_name: string | null
}

/** student_schedule_preferences JOIN students 的原始行 */
export interface PreferenceWithStudentRow {
  id: string
  student_id: string
  day_of_week: DayOfWeek
  preferred_start: string | null
  preferred_end: string | null
  semester: string | null
  notes: string | null
  student_name: string
  grade: string | null
  level: LevelType | null
  status: StudentStatus
  student_type: StudentType
}

/** ecords JOIN lesson_plans 的原始行 */
export interface ClassRecordWithPlanRow extends ClassRecordRow {
  plan_id_ref: string | null
  plan_tasks: string | null
  plan_notes: string | null
  plan_ai_reason: string | null
}

/** students JOIN billing 的原始行 */
export interface StudentWithBillingRow extends StudentRow {
  billing_id: string | null
  total_hours: number | null
  used_hours: number | null
  remaining_hours: number | null
  warning_threshold: number | null
  last_payment_date: string | null
  last_class_date: string | null  // 子查询获取的最近上课日期
}

/** trial students JOIN 查询的原始行 */
export interface TrialStudentRow extends StudentRow {
  conversion_id: string | null
  trial_date: string | null
  conversion_date: string | null
  converted: number
  tc_commission_note: string | null
  tc_notes: string | null
  tc_created_at: string | null
  billing_id: string | null
  total_hours: number | null
  used_hours: number | null
  remaining_hours: number | null
  warning_threshold: number | null
}

/** trial_conversions JOIN students 的原始行 */
export interface ConversionWithStudentRow extends TrialConversionRow {
  student_no: string | null
  name: string
  school: string | null
  grade: string | null
  account: string | null
  enroll_date: string | null
  student_type: StudentType
  status: StudentStatus
  level: LevelType
  initial_score: number | null
  initial_vocab: number | null
  phonics_progress: string | null
  phonics_completed: number
  ipa_completed: number
  reading_progress: string | null
  student_created_at: string
  updated_at: string
}

/** reading_checkins 聚合查询的原始行 */
export interface ReadingCheckinAggRow {
  id: string
  student_no: string | null
  name: string
  monthly_count: number
  checked_yesterday: number  // SQLite 0/1
}

// ===== 各表允许更新的字段白名单 =====
// 用于防止 SQL 注入：运行时校验字段名是否在白名单中

export const STUDENT_UPDATABLE_FIELDS = new Set([
  'student_no', 'name', 'school', 'grade', 'account', 'enroll_date',
  'student_type', 'status', 'level', 'initial_score', 'initial_vocab',
  'phonics_progress', 'phonics_completed', 'ipa_completed', 'reading_progress',
  'notes', 'updated_at', 'learning_target'
])

export const CLASS_RECORD_UPDATABLE_FIELDS = new Set([
  'student_id', 'class_date', 'duration_hours', 'teacher_name', 'attendance',
  'tasks', 'task_completed', 'incomplete_reason', 'performance',
  'detail_feedback', 'highlights', 'issues', 'checkin_completed',
  'phase_id', 'plan_id', 'imported_from_excel'
])

export const LESSON_PLAN_UPDATABLE_FIELDS = new Set([
  'student_id', 'phase_id', 'plan_date', 'tasks', 'notes',
  'ai_reason', 'generated_by_ai', 'plan_status_json'
])

export const BILLING_UPDATABLE_FIELDS = new Set([
  'total_hours', 'used_hours', 'warning_threshold',
  'last_payment_date', 'notes', 'updated_at'
])

export const EXAM_SCORE_UPDATABLE_FIELDS = new Set([
  'student_id', 'exam_date', 'exam_name', 'exam_type',
  'score', 'full_score', 'notes'
])

export const VOCAB_TEST_UPDATABLE_FIELDS = new Set([
  'student_id', 'test_date', 'vocab_count', 'test_source', 'notes'
])

export const LEARNING_PHASE_UPDATABLE_FIELDS = new Set([
  'student_id', 'phase_name', 'phase_type', 'start_date', 'end_date',
  'goal', 'vocab_start', 'vocab_end', 'summary'
])

export const TRIAL_CONVERSION_UPDATABLE_FIELDS = new Set([
  'student_id', 'trial_date', 'conversion_date', 'converted',
  'commission_note', 'notes'
])

export const TEACHER_UPDATABLE_FIELDS = new Set([
  'name', 'phone', 'university', 'major', 'enroll_date', 'status',
  'vocab_level', 'oral_level', 'teaching_style', 'suitable_grades',
  'suitable_levels', 'training_stage', 'teacher_types',
  'total_teaching_hours', 'notes'
])

export const TEACHER_AVAILABILITY_UPDATABLE_FIELDS = new Set([
  'teacher_id', 'week_start', 'day_of_week', 'start_time', 'end_time', 'notes'
])

export const STUDENT_SCHEDULE_PREFERENCE_UPDATABLE_FIELDS = new Set([
  'student_id', 'day_of_week', 'preferred_start', 'preferred_end',
  'semester', 'notes'
])

export const SCHEDULED_CLASS_UPDATABLE_FIELDS = new Set([
  'student_id', 'teacher_id', 'class_date', 'start_time', 'end_time',
  'duration_hours', 'status', 'rescheduled_from_id', 'cancel_reason', 'notes'
])

export const WORDBANK_UPDATABLE_FIELDS = new Set([
  'name', 'total_levels', 'category', 'sort_order', 'notes'
])

export const TODO_UPDATABLE_FIELDS = new Set([
  'content', 'student_id', 'due_date', 'completed', 'completed_at', 'sort_order'
])

/**
 * 校验字段名是否在白名单中，防止 SQL 注入
 * @param key 字段名
 * @param allowedFields 允许的字段白名单
 * @returns 是否允许
 */
export function isAllowedField(key: string, allowedFields: Set<string>): boolean {
  return allowedFields.has(key)
}

/**
 * 解析 tasks 字段，确保返回 TaskBlock[]
 * 统一处理数据库中存储为 JSON 字符串的情况
 * @param tasks - 可能是字符串或 TaskBlock[]
 * @returns TaskBlock[]
 */
export function parseTasks(tasks: TaskBlock[] | string | null | undefined): TaskBlock[] {
  if (!tasks) return []
  if (typeof tasks === 'string') {
    try {
      const parsed = JSON.parse(tasks)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      console.warn('[parseTasks] JSON 解析失败:', tasks)
      return []
    }
  }
  return Array.isArray(tasks) ? tasks : []
}

/**
 * 统一的 ClassRecord 行映射函数
 * 将数据库原始行转换为 ClassRecord 类型（JSON 解析 + 布尔值转换）
 */
export function mapClassRecord(row: ClassRecordRow): ClassRecord {
  return {
    ...row,
    tasks: parseTasks(row.tasks),
    checkin_completed: !!row.checkin_completed,
    imported_from_excel: !!row.imported_from_excel,
    plan_id: row.plan_id || null,
  }
}

/**
 * 统一的 LessonPlan 行映射函数
 * 将数据库原始行转换为 LessonPlan 类型（JSON 解析 + 布尔值转换）
 */
export function mapLessonPlan(row: LessonPlanRow): LessonPlan {
  return {
    ...row,
    tasks: parseTasks(row.tasks),
    generated_by_ai: !!row.generated_by_ai,
    plan_status_json: row.plan_status_json ?? null,
  }
}

/**
 * 统一的 Student 行映射函数
 * 将数据库原始行转换为 Student 类型（布尔值转换）
 */
export function mapStudent(row: StudentRow): Student {
  return {
    ...row,
    phonics_completed: !!row.phonics_completed,
    ipa_completed: !!row.ipa_completed,
  }
}

/**
 * 统一的 Teacher 行映射函数
 * 将数据库原始行转换为 Teacher 类型（JSON 解析 + 默认值）
 */
export function mapTeacher(row: TeacherRow): Teacher {
  return {
    ...row,
    suitable_levels: row.suitable_levels ? JSON.parse(row.suitable_levels) : null,
    teacher_types: row.teacher_types ? JSON.parse(row.teacher_types) as TeacherType[] : [],
    total_teaching_hours: row.total_teaching_hours || 0,
    training_stage: row.training_stage || 'probation',
  }
}

/**
 * 统一的 TrialConversion 行映射函数
 * 将数据库原始行转换为 TrialConversion 类型（布尔值转换）
 */
export function mapTrialConversion(row: TrialConversionRow): TrialConversion {
  return {
    ...row,
    converted: !!row.converted,
  }
}


// 初始化数据库 - 在 Electron 中由主进程处理
export async function initDatabase(): Promise<void> {
  // 检查是否在 Electron 环境中
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron
  
  console.log('initDatabase called, isElectron:', isElectron)
  console.log('window.electronAPI:', window.electronAPI)
  
  if (isElectron) {
    // Electron 环境中，数据库在主进程初始化
    // 测试 IPC 通信是否正常
    try {
      const dbPath = await window.electronAPI!.dbGetPath()
      console.log('Database path:', dbPath)
      console.log('Using Electron main process database (better-sqlite3)')
      return
    } catch (error) {
      console.error('Failed to connect to main process database:', error)
      throw new Error('无法连接到主进程数据库: ' + (error as Error).message)
    }
  }
  
  // 非 Electron 环境（浏览器）暂不支持
  throw new Error('此应用需要 Electron 环境运行，请使用桌面应用版本。')
}

// 生成唯一 ID - 使用 crypto.randomUUID() 统一为 UUID v4 格式
// 现代 Electron/Chromium 原生支持 crypto.randomUUID()
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * 带重试机制的 IPC 数据库查询
 * @param sql SQL 查询语句
 * @param params 查询参数
 * @param retries 重试次数，默认 2 次
 * @returns 查询结果
 * @throws 当重试次数用尽后仍然失败时抛出错误
 */
export async function ipcQuery<T>(sql: string, params: unknown[] = [], retries = 2): Promise<T> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await window.electronAPI.dbQuery(sql, params) as Promise<T>
    } catch (error) {
      lastError = error as Error
      console.warn(`[ipcQuery] 第 ${attempt + 1} 次查询失败:`, error)
      
      // 检查是否是约束错误或数据错误，这些错误重试无法解决
      const errorMsg = lastError?.message || ''
      const isConstraintError = errorMsg.includes('UNIQUE constraint') ||
                                errorMsg.includes('FOREIGN KEY constraint') ||
                                errorMsg.includes('NOT NULL constraint') ||
                                errorMsg.includes('CHECK constraint')
      
      // 如果是约束错误，直接抛出，不进行重试
      if (isConstraintError) {
        throw lastError
      }
      
      // 如果还有重试机会，等待一段时间后重试
      if (attempt < retries) {
        const delay = 100 * (attempt + 1)
        console.log(`[ipcQuery] 将在 ${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // 所有重试都失败后，抛出最后一个错误
  throw new Error(`数据库查询失败（已重试 ${retries} 次）: ${lastError?.message || '未知错误'}`)
}

/**
 * 带重试机制的 IPC 单条记录查询
 * @param sql SQL 查询语句
 * @param params 查询参数
 * @param retries 重试次数，默认 2 次
 * @returns 查询结果或 undefined
 * @throws 当重试次数用尽后仍然失败时抛出错误
 */
export async function ipcQueryOne<T>(sql: string, params: unknown[] = [], retries = 2): Promise<T | undefined> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await window.electronAPI.dbQueryOne(sql, params) as Promise<T | undefined>
    } catch (error) {
      lastError = error as Error
      console.warn(`[ipcQueryOne] 第 ${attempt + 1} 次查询失败:`, error)
      
      // 检查是否是约束错误或数据错误，这些错误重试无法解决
      const errorMsg = lastError?.message || ''
      const isConstraintError = errorMsg.includes('UNIQUE constraint') ||
                                errorMsg.includes('FOREIGN KEY constraint') ||
                                errorMsg.includes('NOT NULL constraint') ||
                                errorMsg.includes('CHECK constraint')
      
      // 如果是约束错误，直接抛出，不进行重试
      if (isConstraintError) {
        throw lastError
      }
      
      // 如果还有重试机会，等待一段时间后重试
      if (attempt < retries) {
        const delay = 100 * (attempt + 1)
        console.log(`[ipcQueryOne] 将在 ${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // 所有重试都失败后，抛出最后一个错误
  throw new Error(`数据库查询失败（已重试 ${retries} 次）: ${lastError?.message || '未知错误'}`)
}

/**
 * 执行数据库事务（多个SQL语句原子执行）
 * @param statements SQL语句数组，每项包含 sql 和 params
 * @throws 当事务执行失败时抛出错误
 */
export async function ipcTransaction(statements: Array<{ sql: string; params: unknown[] }>): Promise<void> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  
  try {
    await window.electronAPI.dbTransaction(statements)
  } catch (error) {
    console.error('[ipcTransaction] 事务执行失败:', error)
    throw new Error(`数据库事务失败: ${(error as Error)?.message || '未知错误'}`)
  }
}