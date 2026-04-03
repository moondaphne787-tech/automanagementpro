// 主组件
export { ManualSchedule } from './ManualSchedule'
export type { ManualScheduleSidebarProps } from './ManualSchedule'

// 侧边栏组件
export { ScheduleSidebar } from './ScheduleSidebar'
export type { ScheduleSidebarProps, ScheduleItem as SidebarScheduleItem } from './ScheduleSidebar'

// 子组件
export { StudentRowComponent } from './StudentRow'
export { TeacherTimelineRow } from './TeacherTimeline'
export { TeacherDetailCard } from './TeacherDetailCard'
export { AssignTeacherPopover } from './AssignTeacherPopover'

// Hook
export { useManualSchedule } from './hooks/useManualSchedule'
export type { UseManualScheduleOptions, UseManualScheduleReturn } from './hooks/useManualSchedule'

// 工具函数（组件内部使用的计算函数）
export { 
  getTimeRange, 
  calculateSlotStyle 
} from './hooks/useManualSchedule'

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
export { TEACHER_COLORS, HOUR_WIDTH, ROW_HEIGHT, LEVEL_LABELS } from './constants'

// 注意：DAY_LABELS、getDayOfWeek、formatDateISO、timeToMinutes、minutesToTime
// 请直接从权威来源导入：
// - DAY_LABELS: import { DAY_LABELS } from '@/types'
// - getDayOfWeek, formatDateISO, timeToMinutes, minutesToTime: import { ... } from '@/lib/utils'
