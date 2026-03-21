import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化日期
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 格式化课时
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '0'
  return hours.toFixed(1)
}

// 生成学号
export function generateStudentNo(index: number): string {
  return (index + 1).toString().padStart(4, '0')
}

// 获取程度等级颜色
export function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    weak: 'bg-orange-500',
    medium: 'bg-blue-500',
    advanced: 'bg-green-500'
  }
  return colors[level] || 'bg-gray-500'
}

// 获取状态颜色
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-600',
    paused: 'text-yellow-600',
    graduated: 'text-gray-500'
  }
  return colors[status] || 'text-gray-500'
}

// 判断是否需要课时预警
export function isHoursWarning(billing: { remaining_hours: number; warning_threshold: number } | null | undefined): boolean {
  if (!billing) return false
  return billing.remaining_hours <= billing.warning_threshold
}