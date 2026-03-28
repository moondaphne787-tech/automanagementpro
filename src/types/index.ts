// 学员类型
export type StudentType = 'formal' | 'trial'

// 学员状态
export type StudentStatus = 'active' | 'paused' | 'graduated'

// 程度等级
export type LevelType = 'weak' | 'medium' | 'advanced'

// 年级类型
export type GradeType = 
  | '三年级' | '四年级' | '五年级' | '六年级' 
  | '初一' | '初二' | '初三'
  | '高一' | '高二' | '高三'
  | '大学'

// 词库分类
export type WordbankCategory = 
  | 'textbook' 
  | 'primary_exam' 
  | 'primary_advanced' 
  | 'junior_exam' 
  | 'junior_advanced' 
  | 'senior_exam' 
  | 'senior_advanced' 
  | 'college_cet4'

// 词库进度状态
export type ProgressStatus = 'active' | 'completed' | 'paused'

// 课堂出勤状态
export type AttendanceType = 'present' | 'absent' | 'late'

// 任务完成状态
export type TaskCompletedType = 'completed' | 'partial' | 'not_completed'

// 课堂表现
export type PerformanceType = 'excellent' | 'good' | 'needs_improvement'

// 考试类型
export type ExamType = 'school_exam' | 'placement' | 'mock'

// 学习阶段类型
export type PhaseType = 'semester' | 'summer' | 'winter'

// 助教状态
export type TeacherStatus = 'active' | 'inactive'

// 口语水平
export type OralLevel = 'basic' | 'intermediate' | 'advanced'

// 助教培训阶段
export type TrainingStage = 'probation' | 'intern' | 'formal'

// 助教类型
export type TeacherType = 'regular' | 'vacation'

// 排课状态
export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'

// 星期
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

// 排课日期类型
export type ScheduleDateType = 'regular_weekend' | 'friday_evening' | 'holiday' | 'custom'

// 任务类型
export type TaskType = 
  | 'phonics' 
  | 'vocab_new' 
  | 'vocab_review' 
  | 'nine_grid' 
  | 'textbook' 
  | 'reading' 
  | 'picture_book' 
  | 'exercise' 
  | 'other'

// 学员信息
export interface Student {
  id: string
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
  phonics_completed: boolean
  ipa_completed: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// 课时与收费信息
export interface Billing {
  id: string
  student_id: string
  total_hours: number
  used_hours: number
  remaining_hours: number
  warning_threshold: number
  last_payment_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// 词库配置
export interface Wordbank {
  id: string
  name: string
  total_levels: number
  nine_grid_interval: number
  category: WordbankCategory
  sort_order: number
  notes: string | null
}

// 学生词库进度
export interface StudentWordbankProgress {
  id: string
  student_id: string
  wordbank_id: string
  wordbank_label: string
  current_level: number
  total_levels_override: number | null
  last_nine_grid_level: number
  status: ProgressStatus
  started_date: string | null
  completed_date: string | null
  source: 'manual' | 'imported' | 'synced'
  notes: string | null
}

// 任务块
export interface TaskBlock {
  type: TaskType
  wordbank_label?: string
  level_from?: number
  level_to?: number
  level_reached?: number
  content?: string
}

// 课堂记录
export interface ClassRecord {
  id: string
  student_id: string
  class_date: string
  duration_hours: number
  teacher_name: string | null
  attendance: AttendanceType
  tasks: TaskBlock[]
  task_completed: TaskCompletedType
  incomplete_reason: string | null
  performance: PerformanceType
  detail_feedback: string | null
  highlights: string | null
  issues: string | null
  checkin_completed: boolean
  phase_id: string | null
  plan_id: string | null  // 关联的课程计划ID
  imported_from_excel: boolean
  created_at: string
}

// 课程计划
export interface LessonPlan {
  id: string
  student_id: string
  phase_id: string | null
  plan_date: string | null
  tasks: TaskBlock[]
  notes: string | null
  ai_reason: string | null
  generated_by_ai: boolean
  created_at: string
}

// 考试成绩
export interface ExamScore {
  id: string
  student_id: string
  exam_date: string
  exam_name: string | null
  exam_type: ExamType
  score: number | null
  full_score: number
  notes: string | null
}

// 学习阶段
export interface LearningPhase {
  id: string
  student_id: string
  phase_name: string | null
  phase_type: PhaseType
  start_date: string | null
  end_date: string | null
  goal: string | null
  vocab_start: number | null
  vocab_end: number | null
  summary: string | null
  created_at: string
}

// 体验生成交记录
export interface TrialConversion {
  id: string
  student_id: string
  trial_date: string | null
  conversion_date: string | null
  converted: boolean
  commission_note: string | null
  notes: string | null
  created_at: string
}

// 助教信息
export interface Teacher {
  id: string
  name: string
  phone: string | null
  university: string | null
  major: string | null
  enroll_date: string | null
  status: TeacherStatus
  vocab_level: string | null
  oral_level: OralLevel
  teaching_style: string | null
  suitable_grades: string | null
  suitable_levels: string[] | null
  training_stage: TrainingStage
  teacher_types: TeacherType[]
  total_teaching_hours: number
  notes: string | null
  created_at: string
}

// 老师可用时段
export interface TeacherAvailability {
  id: string
  teacher_id: string
  week_start: string | null
  day_of_week: DayOfWeek
  start_time: string | null
  end_time: string | null
  notes: string | null
}

// 学生固定时段偏好
export interface StudentSchedulePreference {
  id: string
  student_id: string
  day_of_week: DayOfWeek
  preferred_start: string | null
  preferred_end: string | null
  semester: string | null
  notes: string | null
}

// 课表
export interface ScheduledClass {
  id: string
  student_id: string
  teacher_id: string | null
  class_date: string
  start_time: string | null
  end_time: string | null
  duration_hours: number
  status: ScheduleStatus
  rescheduled_from_id: string | null
  cancel_reason: string | null
  notes: string | null
  created_at: string
}

// 系统设置
export interface Setting {
  key: string
  value: string | null
  updated_at: string
}

// AI配置
export interface AIConfig {
  api_url: string
  api_key: string
  model: string
  temperature: number
  max_tokens: number
}

// 助教培训阶段显示名称
export const TRAINING_STAGE_LABELS: Record<TrainingStage, string> = {
  probation: '实训期',
  intern: '实习期',
  formal: '正式助教'
}

// 助教类型显示名称
export const TEACHER_TYPE_LABELS: Record<TeacherType, string> = {
  regular: '平时助教',
  vacation: '寒暑假助教'
}

// 学员列表项（包含课时信息）
export type StudentWithBilling = Student & {
  billing: Billing | null | undefined
}

// 筛选条件
export interface FilterOptions {
  status: StudentStatus | 'all'
  student_type: StudentType | 'all'
  level: LevelType | 'all'
  grade: string | 'all'
  search: string
  day_of_week: DayOfWeek | 'all'  // 按周几筛选有课学员
}

// 排序选项
export interface SortOptions {
  field: 'student_no' | 'total_hours' | 'remaining_hours' | 'enroll_date' | 'last_class'
  direction: 'asc' | 'desc'
}

// 年级选项列表
export const GRADE_OPTIONS: GradeType[] = [
  '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
  '大学'
]

// 助教适合年级范围选项
export const SUITABLE_GRADE_OPTIONS = [
  { value: '小学', label: '小学（三至六年级）' },
  { value: '初中', label: '初中（初一至初三）' },
  { value: '高中', label: '高中（高一至高三）' },
  { value: '小学,初中', label: '小学+初中' },
  { value: '初中,高中', label: '初中+高中' },
  { value: '小学,初中,高中', label: '小学+初中+高中' },
] as const

// 年级所属阶段映射
export const GRADE_STAGE_MAP: Record<string, '小学' | '初中' | '高中' | '大学'> = {
  '三年级': '小学', '四年级': '小学', '五年级': '小学', '六年级': '小学',
  '初一': '初中', '初二': '初中', '初三': '初中',
  '高一': '高中', '高二': '高中', '高三': '高中',
  '大学': '大学'
}

// 根据适合年级范围获取具体年级列表
export function getGradesFromSuitableGrades(suitableGrades: string | null): string[] {
  if (!suitableGrades) return []
  
  const grades: string[] = []
  const parts = suitableGrades.split(',').map(s => s.trim())
  
  for (const part of parts) {
    switch (part) {
      case '小学':
        grades.push('三年级', '四年级', '五年级', '六年级')
        break
      case '初中':
        grades.push('初一', '初二', '初三')
        break
      case '高中':
        grades.push('高一', '高二', '高三')
        break
    }
  }
  
  return grades
}

// 程度等级显示名称
export const LEVEL_LABELS: Record<LevelType, string> = {
  weak: '基础薄弱',
  medium: '基础较好',
  advanced: '非常优秀'
}

// 学员状态显示名称
export const STATUS_LABELS: Record<StudentStatus, string> = {
  active: '在读',
  paused: '暂停',
  graduated: '结课'
}

// 学员类型显示名称
export const STUDENT_TYPE_LABELS: Record<StudentType, string> = {
  formal: '正式学员',
  trial: '体验生'
}

// 任务类型显示名称
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  phonics: '语音训练',
  vocab_new: '词库学习（新词）',
  vocab_review: '词库复习',
  nine_grid: '九宫格清理',
  textbook: '课文梳理',
  reading: '阅读训练',
  picture_book: '绘本阅读',
  exercise: '专项练习',
  other: '其他'
}

// Electron API 类型声明
export interface ElectronAPI {
  // 基础数据库操作
  dbQuery: (sql: string, params?: unknown[]) => Promise<unknown>
  dbQueryOne: (sql: string, params?: unknown[]) => Promise<unknown>
  dbTransaction: (statements: Array<{ sql: string; params: unknown[] }>) => Promise<{ success: boolean }>
  dbGetPath: () => Promise<string>
  dbBackup: (backupPath: string) => Promise<{ success: boolean }>
  
  // 迁移和备份相关
  dbGetVersion: () => Promise<{ version: number; latestVersion: number }>
  dbGetMigrationHistory: () => Promise<Array<{ version: number; applied_at: string; description?: string }>>
  dbGetStats: () => Promise<{
    version: number
    latestVersion: number
    students: number
    teachers: number
    classRecords: number
    lessonPlans: number
    dbSize: number
    lastBackup: string | null
  } | null>
  dbCreateBackup: (backupName?: string) => Promise<{ success: boolean; path: string }>
  dbGetBackupHistory: (limit?: number) => Promise<Array<{
    id: string
    backup_path: string
    backup_type: string
    file_size: number
    created_at: string
  }>>
  dbRestoreFromBackup: (backupPath: string) => Promise<{ success: boolean; message: string }>
  dbGetBackupDir: () => Promise<string>
  dbOpenBackupDir: () => Promise<{ success: boolean }>
  
  // 对话框
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => 
    Promise<{ canceled: boolean; filePath?: string }>
  
  // 其他
  getWasmPath: (filename: string) => Promise<string>
  printLessonPlans: (htmlContent: string) => Promise<{ success: boolean; error?: string }>
  platform: string
  isElectron: boolean
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
