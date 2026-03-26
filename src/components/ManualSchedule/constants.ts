import type { DayOfWeek, LevelType } from './types'

// 预设颜色板
export const TEACHER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
]

// 每小时像素宽度
export const HOUR_WIDTH = 80

// 学生行高度
export const ROW_HEIGHT = 60

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

// 程度等级显示
export const LEVEL_LABELS: Record<LevelType, string> = {
  weak: '薄弱',
  medium: '较好',
  advanced: '优秀'
}