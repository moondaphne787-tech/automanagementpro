import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Teacher } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 助教姓名匹配工具函数
 * 匹配优先级：精确匹配 > 唯一前缀匹配 > 唯一包含匹配
 * 如果匹配到多个候选，记录警告并返回 null
 * 
 * @param name 输入的助教姓名
 * @param teachers 助教列表
 * @returns 匹配到的助教对象，如果无法唯一匹配则返回 null
 */
export function matchTeacherByName(name: string, teachers: Teacher[]): Teacher | null {
  if (!name || !teachers.length) return null
  
  // 1. 精确匹配
  const exactMatch = teachers.find(t => t.name === name)
  if (exactMatch) {
    return exactMatch
  }
  
  // 2. 唯一前缀匹配
  const prefixMatches = teachers.filter(t => t.name.startsWith(name))
  if (prefixMatches.length === 1) {
    console.warn(`[TeacherMatch] 前缀匹配: "${name}" → "${prefixMatches[0].name}"`)
    return prefixMatches[0]
  }
  if (prefixMatches.length > 1) {
    console.warn(`[TeacherMatch] 无法唯一匹配助教"${name}"，前缀匹配到 ${prefixMatches.length} 个候选: ${prefixMatches.map(t => t.name).join(', ')}，跳过课时累加`)
    return null
  }
  
  // 3. 唯一包含匹配（名称≥2字）
  if (name.length >= 2) {
    const containsMatches = teachers.filter(t => t.name.includes(name))
    if (containsMatches.length === 1) {
      console.warn(`[TeacherMatch] 包含匹配: "${name}" → "${containsMatches[0].name}"`)
      return containsMatches[0]
    }
    if (containsMatches.length > 1) {
      console.warn(`[TeacherMatch] 无法唯一匹配助教"${name}"，包含匹配到 ${containsMatches.length} 个候选: ${containsMatches.map(t => t.name).join(', ')}，跳过课时累加`)
      return null
    }
  }
  
  console.warn(`[TeacherMatch] 无法唯一匹配助教"${name}"，跳过课时累加`)
  return null
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