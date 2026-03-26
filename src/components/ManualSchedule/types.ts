import type { Student, Teacher, ScheduledClass, DayOfWeek, Billing, StudentSchedulePreference, TeacherAvailability, LevelType } from '@/types'

// 带颜色的助教类型
export interface TeacherWithColor extends Teacher {
  color: string
  availabilities?: TeacherAvailability[]
}

// 学生时段数据
export interface StudentSlot {
  id: string
  student: Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
  preferredStart: string
  preferredEnd: string
  durationHours: number
  scheduledClass?: ScheduledClass & { teacher?: Teacher }
  teacherId?: string
  teacher?: TeacherWithColor
  status: 'unscheduled' | 'scheduled'
}

// 学生行数据
export interface StudentRow {
  student: Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
  slots: StudentSlot[]
}

// 冲突类型
export type ConflictType = 'none' | 'hard' | 'soft'

// 冲突信息
export interface ConflictInfo {
  type: ConflictType
  reasons: string[]
}

// 助教卡片数据
export interface TeacherCardData {
  teacher: TeacherWithColor
  color: string
  todayAvailability: string
  suitableLevels: string[]
  suitableGrades: string
  scheduledHours: number
  remainingHours: number
  isFull: boolean
  hasAvailabilityToday: boolean  // 当日是否有可用时段
}

// 助教分配状态
export interface TeacherAssignStatus {
  teacher: TeacherWithColor
  canAssign: boolean
  conflictType: ConflictType
  reasons: string[]
}

// 时间范围
export interface TimeRange {
  start: number
  end: number
}

// 导出类型
export type { Student, Teacher, ScheduledClass, DayOfWeek, Billing, StudentSchedulePreference, TeacherAvailability, LevelType }