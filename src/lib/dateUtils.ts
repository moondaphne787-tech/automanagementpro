import type { DayOfWeek } from '@/types'

/**
 * 日期工具函数模块
 * 统一管理所有日期相关的工具函数，避免重复实现
 */

/**
 * 格式化日期为 ISO 格式 (YYYY-MM-DD)
 * 注意：使用 UTC 时间，可能与本地时区有差异
 * @param date - Date 对象
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 格式化本地日期为 YYYY-MM-DD 格式（避免时区问题）
 * 使用本地时区，确保日期与用户期望一致
 * @param date - Date 对象
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取日期对应的星期
 * @param dateInput - 日期字符串 (YYYY-MM-DD) 或 Date 对象
 * @returns DayOfWeek 类型 ('monday', 'tuesday', ...)
 */
export function getDayOfWeek(dateInput: string | Date): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return days[date.getDay()]
}

/**
 * 格式化日期显示为中文格式（月日 星期）
 * @param dateStr - YYYY-MM-DD 格式的日期字符串
 * @returns 如 "3月24日 周一"
 */
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${days[date.getDay()]}`
}

/**
 * 获取周范围（周一到周日）
 * @param offsetWeeks - 周偏移量，0=本周，-1=上周，1=下周
 * @returns { start, end, label } 开始日期、结束日期、标签
 */
export function getWeekRange(offsetWeeks: number = 0): { start: string; end: string; label: string } {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  // 计算本周一（周一为一周的开始，周日为一周的结束）
  // getDay(): 0=周日, 1=周一, 2=周二, ..., 6=周六
  // 如果今天是周日(0)，需要回退6天到周一；否则回退 (day-1) 天
  const daysToMonday = day === 0 ? 6 : day - 1
  monday.setDate(now.getDate() - daysToMonday + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)  // 周一到周日共7天，偏移6天
  sunday.setHours(23, 59, 59, 999)
  
  // 使用本地日期格式化，避免时区转换问题
  const start = formatLocalDate(monday)
  const end = formatLocalDate(sunday)
  
  let label = '本周'
  if (offsetWeeks === -1) {
    label = '上周'
  } else if (offsetWeeks < -1) {
    label = `${Math.abs(offsetWeeks)}周前`
  } else if (offsetWeeks === 1) {
    label = '下周'
  } else if (offsetWeeks > 1) {
    label = `${offsetWeeks}周后`
  }
  
  return { start, end, label }
}

/**
 * 将时间字符串转换为分钟数
 * @param time - HH:MM 格式的时间字符串
 * @returns 从午夜开始的分钟数
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * 将分钟数转换为时间字符串
 * @param minutes - 从午夜开始的分钟数
 * @returns HH:MM 格式的时间字符串
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * 获取今日日期字符串（YYYY-MM-DD 格式，使用本地时区）
 * @returns 今日日期字符串
 */
export function getTodayStr(): string {
  return formatLocalDate(new Date())
}

/**
 * 获取指定日期所在周的周一日期
 * @param dateStr - YYYY-MM-DD 格式的日期字符串
 * @returns YYYY-MM-DD 格式的周一日期字符串
 */
export function getWeekStartFromDate(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return formatDateISO(date)
}