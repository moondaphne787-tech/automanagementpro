import type { ScheduleDateType } from '@/types'

export interface ScheduleDateConfig {
  date: string
  type: ScheduleDateType
  label: string
}

export interface ScheduleItem {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
}

export function formatDisplayDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}
