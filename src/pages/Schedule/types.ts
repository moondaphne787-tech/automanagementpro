import { DAY_LABELS } from '@/types'
import type { DayOfWeek } from '@/types'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'
import { formatDateISO, getDayOfWeek } from '@/lib/utils'

// 视图模式类型
export type ViewMode = 'week' | 'arrange' | 'manual'

// 预设排课模式
export type SchedulePreset = 'weekend_with_friday' | 'week' | 'custom'

// 单个排课项
export interface ScheduleItem {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
}

// 白天时间槽（8点到18点）
export const DAYTIME_SLOTS: string[] = []
for (let h = 8; h <= 18; h++) {
  DAYTIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`)
}

// 晚上时间槽（18点到21点）
export const EVENING_SLOTS: string[] = []
for (let h = 18; h <= 21; h++) {
  EVENING_SLOTS.push(`${h.toString().padStart(2, '0')}:00`)
}

// 星期标签 - 从 @/types 导入并重新导出
export { DAY_LABELS }

// 日期工具函数 - 从 @/lib/utils 导入并重新导出
export { formatDateISO as formatDate, getDayOfWeek }

// 格式化日期显示（保留，用于特殊格式需求）
export function formatDisplayDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 获取日期类型对应的图标（emoji 字符串）
export function getDateTypeIcon(type: ScheduleDateConfig['type']): string {
  if (type === 'friday_evening') return '🌙'
  return '☀️'
}
