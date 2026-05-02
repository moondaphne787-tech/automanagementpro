import type { ScheduleDateType } from '@/types'
import { formatDateISO } from '@/lib/utils'

// 排课日期配置（原在 schedulePrompts.ts，迁移至此）
export interface ScheduleDateConfig {
  date: string
  type: ScheduleDateType
  label: string
}

// 视图模式类型
export type ViewMode = 'week' | 'manual'

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

// 格式化日期显示
export function formatDisplayDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 获取日期类型对应的图标
export function getDateTypeIcon(type: ScheduleDateConfig['type']): string {
  if (type === 'friday_evening') return '🌙'
  return '☀️'
}

/** 获取以周一为起点的本周日期 */
function getWeekMonday(baseDate: Date): Date {
  const d = new Date(baseDate)
  const day = d.getDay() // 0=周日
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// 生成含周五晚的排课日期配置（周五晚+周六+周日）
export function getWeekendWithFridayConfigs(baseDate: Date): ScheduleDateConfig[] {
  const monday = getWeekMonday(baseDate)
  const configs: ScheduleDateConfig[] = []

  const friday = new Date(monday); friday.setDate(monday.getDate() + 4)
  configs.push({ date: formatDateISO(friday), type: 'friday_evening', label: `周五晚 ${friday.getMonth() + 1}/${friday.getDate()}` })

  const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5)
  configs.push({ date: formatDateISO(saturday), type: 'regular_weekend', label: `周六 ${saturday.getMonth() + 1}/${saturday.getDate()}` })

  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  configs.push({ date: formatDateISO(sunday), type: 'regular_weekend', label: `周日 ${sunday.getMonth() + 1}/${sunday.getDate()}` })

  return configs
}

// 生成一周的排课日期配置（周一到周日）
export function getWeekDateConfigs(baseDate: Date): ScheduleDateConfig[] {
  const monday = getWeekMonday(baseDate)
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const type: ScheduleDateType = i === 4 ? 'friday_evening' : i >= 5 ? 'regular_weekend' : 'custom'
    return { date: formatDateISO(d), type, label: `${dayNames[i]} ${d.getMonth() + 1}/${d.getDate()}` }
  })
}
