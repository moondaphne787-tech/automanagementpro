import type { DayOfWeek } from '@/types'

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

// 星期标签
export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: '周一',
  tuesday: '周二',
  wednesday: '周三',
  thursday: '周四',
  friday: '周五',
  saturday: '周六',
  sunday: '周日'
}

// 格式化日期
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDisplayDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 获取日期对应的星期
export function getDayOfWeek(dateStr: string): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const date = new Date(dateStr)
  return days[date.getDay()]
}