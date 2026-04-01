// 主组件
export { ManualSchedule } from './ManualSchedule'

// 子组件
export { StudentRowComponent } from './StudentRow'
export { TeacherTimelineRow } from './TeacherTimeline'
export { TeacherDetailCard } from './TeacherDetailCard'
export { AssignTeacherPopover } from './AssignTeacherPopover'

// Hook
export { useManualSchedule } from './hooks/useManualSchedule'
export type { UseManualScheduleOptions, UseManualScheduleReturn } from './hooks/useManualSchedule'

// 工具函数
export { 
  formatDate, 
  getDayOfWeek, 
  timeToMinutes, 
  minutesToTime, 
  getTimeRange, 
  calculateSlotStyle 
} from './hooks/useManualSchedule'

// 也从 utils 导出 formatDateISO 作为替代名称（推荐使用）
export { formatDateISO } from '@/lib/utils'

// 类型
export type {
  TeacherWithColor,
  StudentSlot,
  StudentRow,
  ConflictType,
  ConflictInfo,
  TeacherCardData,
  TeacherAssignStatus,
  TimeRange
} from './types'

// 常量
export { TEACHER_COLORS, HOUR_WIDTH, ROW_HEIGHT, DAY_LABELS, LEVEL_LABELS } from './constants'