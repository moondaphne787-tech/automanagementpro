import { useState, useEffect, useCallback, useRef } from 'react'
import { studentDb } from '../db/students'
import { lessonPlanDb } from '../db/lessonPlans'
import { classRecordDb } from '../db/classRecords'
import { scheduledClassDb } from '../db/schedule'
import { billingDb } from '../db/billing'
import { todoDb, Todo } from '../db/todos'
import type { Student, Billing, LessonPlan, ClassRecord, ScheduledClass } from '../types'

// 顶部统计卡片数据
export interface DashboardStats {
  todayScheduleCount: number
  missingPlanCount: number
  lowHoursCount: number
  trialStudentCount: number
}

// 今日排课
export interface TodayScheduleItem {
  studentId: string
  studentName: string
  grade?: string
  startTime: string
  endTime: string
  teacherName?: string
  hasPlan: boolean
  hasClassRecord: boolean
}

// 本周计划状态
export interface PlanStatusItem {
  studentId: string
  studentName: string
  grade?: string
  scheduledCount: number
  planCount: number
  expiredCount: number
  issue: 'missing' | 'expired' | 'partial'
}

// 本周课堂总结
export interface WeeklySummary {
  label: string  // 显示标签，如"本周"、"上周"
  dateRange: string  // 日期范围，如"3/24 - 3/30"
  totalLessons: number
  totalHours: number
  avgCompletionRate: number
  attendanceRate: number
  unrecordedCount: number
}

// 需关注学员
export interface AlertStudentItem {
  studentId: string
  studentName: string
  grade?: string
  alerts: Array<{
    type: 'low_hours' | 'absent' | 'no_record' | 'trial_followup' | 'expired_plans'
    message: string
  }>
}

// 学员总览
export interface StudentOverviewData {
  total: number
  active: number
  paused: number
  graduated: number
  trialThisMonth: number
  convertedThisMonth: number
}

export interface DashboardData {
  stats: DashboardStats
  todaySchedules: TodayScheduleItem[]
  problemPlanStudents: PlanStatusItem[]
  weeklySummary: WeeklySummary
  alertStudents: AlertStudentItem[]
  studentOverview: StudentOverviewData
  todos: Todo[]
}

// 缓存配置
interface CacheConfig {
  staleTime: number  // 数据新鲜时间（毫秒），在此时间内不会重新请求
  cacheTime: number  // 缓存保留时间（毫秒），超过此时间缓存会被清除
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  staleTime: 30 * 1000,  // 30 秒内数据视为新鲜
  cacheTime: 5 * 60 * 1000,  // 5 分钟后缓存失效
}

// 缓存项
interface CacheEntry<T> {
  data: T
  timestamp: number
  dateKey: string  // 用于判断日期是否变化（跨天需要刷新）
}

// 全局缓存存储
let dashboardCache: CacheEntry<DashboardData> | null = null

// 格式化本地日期为 YYYY-MM-DD 格式（避免时区问题）
function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekRange(offsetWeeks: number = 0): { start: string; end: string; label: string } {
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
  
  // 使用本地日期格式化，避免 toISOString() 的时区转换问题
  const start = formatLocalDate(monday)
  const end = formatLocalDate(sunday)
  
  let label = '本周'
  if (offsetWeeks === -1) {
    label = '上周'
  } else if (offsetWeeks < -1) {
    label = `${Math.abs(offsetWeeks)}周前`
  }
  
  return { start, end, label }
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

// 检查缓存是否有效
function isCacheValid(cache: CacheEntry<DashboardData> | null, config: CacheConfig): boolean {
  if (!cache) return false
  
  const now = Date.now()
  const today = getTodayStr()
  
  // 如果日期变化（跨天），缓存失效
  if (cache.dateKey !== today) return false
  
  // 如果超过新鲜时间，缓存失效
  if (now - cache.timestamp > config.staleTime) return false
  
  return true
}

// 清除缓存
export function clearDashboardCache(): void {
  dashboardCache = null
}

// 获取缓存状态（用于调试和测试）
export function getDashboardCacheStatus(): { hasCache: boolean; timestamp: number | null; isStale: boolean } {
  if (!dashboardCache) {
    return { hasCache: false, timestamp: null, isStale: true }
  }
  
  const now = Date.now()
  const isStale = now - dashboardCache.timestamp > DEFAULT_CACHE_CONFIG.staleTime
  
  return {
    hasCache: true,
    timestamp: dashboardCache.timestamp,
    isStale
  }
}

export function useDashboard(cacheConfig: Partial<CacheConfig> = {}) {
  const config = { ...DEFAULT_CACHE_CONFIG, ...cacheConfig }
  
  const [data, setData] = useState<DashboardData | null>(() => {
    // 初始化时检查是否有有效缓存
    if (isCacheValid(dashboardCache, config)) {
      return dashboardCache!.data
    }
    return null
  })
  const [loading, setLoading] = useState(() => !isCacheValid(dashboardCache, config))
  const [error, setError] = useState<string | null>(null)
  
  // 使用 ref 追踪是否正在进行请求
  const isLoadingRef = useRef(false)

  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    // 如果有有效缓存且不是强制刷新，直接返回缓存数据
    if (!forceRefresh && isCacheValid(dashboardCache, config)) {
      setData(dashboardCache!.data)
      setLoading(false)
      setError(null)
      return
    }
    
    // 防止重复请求
    if (isLoadingRef.current) {
      return
    }
    
    isLoadingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const today = getTodayStr()
      const week = getWeekRange()

      // 并行加载所有基础数据
      const [
        allStudents,
        allBillings,
        allTodos,
        weekPlans,
        weekRecords,
        todaySchedules,
        expiredPlans,
        weekSchedulesAll,
      ] = await Promise.all([
        studentDb.getAll(),
        billingDb.getAll(),
        todoDb.getActive(),
        lessonPlanDb.getByDateRange(week.start, week.end),
        classRecordDb.getByDateRange(week.start, week.end),
        scheduledClassDb.getByDate(today),
        lessonPlanDb.getAllExpiredPlans(),
        scheduledClassDb.getByWeek(week.start, week.end),
      ])

      const activeStudents = allStudents.filter((s: Student) => s.status === 'active')
      const today7DaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

      // ---------- 顶部统计卡片 ----------
      const lowHoursStudents = allBillings.filter((b: Billing & { remaining_hours: number }) => (b.remaining_hours ?? 0) <= 3)
      const trialStudents = allStudents.filter((s: Student) =>
        s.student_type === 'trial' &&
        (!(s as any).trial_followup_date || (s as any).trial_followup_date < today7DaysAgo)
      )

      // 本周缺计划：本周有排课但没有有效计划的学员数
      const studentsWithWeekSchedule = new Set<string>(
        weekSchedulesAll.map((s: ScheduledClass) => s.student_id)
      )
      const studentsWithWeekPlan = new Set<string>(weekPlans.map((p: LessonPlan) => p.student_id))
      const missingPlanCount = [...studentsWithWeekSchedule].filter(
        (id: string) => !studentsWithWeekPlan.has(id)
      ).length

      const stats: DashboardStats = {
        todayScheduleCount: todaySchedules.length,
        missingPlanCount,
        lowHoursCount: lowHoursStudents.length,
        trialStudentCount: trialStudents.length,
      }

      // ---------- 今日排课 ----------
      const todayRecords = weekRecords.filter((r: ClassRecord) => r.class_date === today)
      const todayPlanStudentIds = new Set<string>(
        weekPlans.filter((p: LessonPlan) => p.plan_date === today).map((p: LessonPlan) => p.student_id)
      )
      const todayRecordStudentIds = new Set<string>(todayRecords.map((r: ClassRecord) => r.student_id))

      const todayScheduleItems: TodayScheduleItem[] = todaySchedules.map((s: ScheduledClass) => {
        const student = allStudents.find((st: Student) => st.id === s.student_id)
        return {
          studentId: s.student_id,
          studentName: student?.name ?? (s as any).student?.name ?? '未知学员',
          grade: student?.grade ?? (s as any).student?.grade ?? undefined,
          startTime: s.start_time || '',
          endTime: s.end_time || '',
          teacherName: (s as any).teacher?.name || (s as any).teacher_name,
          hasPlan: todayPlanStudentIds.has(s.student_id),
          hasClassRecord: todayRecordStudentIds.has(s.student_id),
        }
      }).filter((s: TodayScheduleItem) => s.startTime).sort((a: TodayScheduleItem, b: TodayScheduleItem) => a.startTime.localeCompare(b.startTime))

      // ---------- 本周计划状态（只显示有问题的） ----------
      const expiredByStudent = new Map<string, number>()
      for (const p of expiredPlans) {
        expiredByStudent.set(p.student_id, (expiredByStudent.get(p.student_id) ?? 0) + 1)
      }

      const scheduleCountByStudent = new Map<string, number>()
      for (const s of weekSchedulesAll) {
        scheduleCountByStudent.set(s.student_id, (scheduleCountByStudent.get(s.student_id) ?? 0) + 1)
      }
      const planCountByStudent = new Map<string, number>()
      for (const p of weekPlans) {
        planCountByStudent.set(p.student_id, (planCountByStudent.get(p.student_id) ?? 0) + 1)
      }

      const problemPlanStudents: PlanStatusItem[] = []
      for (const [studentId, schedCount] of scheduleCountByStudent.entries()) {
        const planCount = planCountByStudent.get(studentId) ?? 0
        const expiredCount = expiredByStudent.get(studentId) ?? 0
        const student = allStudents.find((s: Student) => s.id === studentId)
        if (!student) continue

        if (planCount === 0) {
          problemPlanStudents.push({
            studentId,
            studentName: student.name,
            grade: student.grade ?? undefined,
            scheduledCount: schedCount,
            planCount: 0,
            expiredCount,
            issue: 'missing'
          })
        } else if (expiredCount > 0) {
          problemPlanStudents.push({
            studentId,
            studentName: student.name,
            grade: student.grade ?? undefined,
            scheduledCount: schedCount,
            planCount,
            expiredCount,
            issue: 'expired'
          })
        } else if (planCount < schedCount) {
          problemPlanStudents.push({
            studentId,
            studentName: student.name,
            grade: student.grade ?? undefined,
            scheduledCount: schedCount,
            planCount,
            expiredCount: 0,
            issue: 'partial'
          })
        }
      }

      // ---------- 本周课堂总结 ----------
      // 格式化日期范围显示
      const formatDateRange = (start: string, end: string): string => {
        const startDate = new Date(start)
        const endDate = new Date(end)
        return `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`
      }

      // 计算课堂总结数据的辅助函数
      const calculateWeeklySummary = (
        records: ClassRecord[],
        scheduledStudents: Set<string>,
        weekLabel: string,
        dateRange: string
      ): WeeklySummary => {
        // 使用 task_completed 字段计算完成率（'completed' 表示 100% 完成）
        const completedCount = records.filter((r: ClassRecord) => r.task_completed === 'completed').length
        const avgCompletionRate = records.length > 0
          ? Math.round(completedCount / records.length * 100)
          : 0

        const totalHours = records.reduce((sum: number, r: ClassRecord) => sum + (r.duration_hours ?? 0), 0)
        const attendanceCount = records.filter((r: ClassRecord) => r.attendance === 'present').length
        const recordedStudentIds = new Set(records.map((r: ClassRecord) => r.student_id))
        const unrecorded = [...scheduledStudents].filter(
          (id: string) => !recordedStudentIds.has(id)
        ).length

        return {
          label: weekLabel,
          dateRange,
          totalLessons: records.length,
          totalHours: Math.round(totalHours * 10) / 10,
          avgCompletionRate,
          attendanceRate: records.length > 0
            ? Math.round(attendanceCount / records.length * 100)
            : 0,
          unrecordedCount: unrecorded,
        }
      }

      // 先检查本周是否有课堂记录
      let summaryWeekRange = week
      let summaryRecords = weekRecords
      let summaryScheduledStudents = studentsWithWeekSchedule

      // 如果本周没有课堂记录，尝试获取上周的数据
      if (weekRecords.length === 0) {
        const lastWeek = getWeekRange(-1)
        const lastWeekRecords = await classRecordDb.getByDateRange(lastWeek.start, lastWeek.end)
        const lastWeekSchedules = await scheduledClassDb.getByWeek(lastWeek.start, lastWeek.end)
        const lastWeekScheduledStudents = new Set<string>(
          lastWeekSchedules.map((s: ScheduledClass) => s.student_id)
        )

        if (lastWeekRecords.length > 0) {
          summaryWeekRange = lastWeek
          summaryRecords = lastWeekRecords
          summaryScheduledStudents = lastWeekScheduledStudents
        }
      }

      const weeklySummary: WeeklySummary = calculateWeeklySummary(
        summaryRecords,
        summaryScheduledStudents,
        summaryWeekRange.label,
        formatDateRange(summaryWeekRange.start, summaryWeekRange.end)
      )

      // ---------- 需关注学员 ----------
      const alertStudents: AlertStudentItem[] = []
      for (const student of activeStudents) {
        const studentAlerts: AlertStudentItem['alerts'] = []

        // 课时预警
        const billing = allBillings.find((b: Billing) => b.student_id === student.id)
        if (billing && (billing.remaining_hours ?? 99) <= 3) {
          studentAlerts.push({
            type: 'low_hours',
            message: `剩余课时仅 ${billing.remaining_hours?.toFixed(1) ?? '?'} 小时`
          })
        }

        // 本周暂无课堂记录
        if (!scheduleCountByStudent.has(student.id)) {
          // 该学员本周无排课，跳过
        } else {
          const studentRecords = weekRecords.filter((r: ClassRecord) => r.student_id === student.id)
          if (studentRecords.length === 0) {
            studentAlerts.push({
              type: 'no_record',
              message: '本周暂无课堂记录'
            })
          }
        }

        // 过期计划超过 1 条
        const expiredCnt = expiredByStudent.get(student.id) ?? 0
        if (expiredCnt >= 2) {
          studentAlerts.push({
            type: 'expired_plans',
            message: `${expiredCnt} 条计划过期未执行`
          })
        }

        if (studentAlerts.length > 0) {
          alertStudents.push({
            studentId: student.id,
            studentName: student.name,
            grade: student.grade ?? undefined,
            alerts: studentAlerts
          })
        }
      }

      // 按警报数量排序，问题越多越靠前
      alertStudents.sort((a: AlertStudentItem, b: AlertStudentItem) => b.alerts.length - a.alerts.length)

      // ---------- 学员总览 ----------
      const thisMonthStart = new Date()
      thisMonthStart.setDate(1)
      thisMonthStart.setHours(0, 0, 0, 0)
      const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0]

      const studentOverview: StudentOverviewData = {
        total: allStudents.length,
        active: allStudents.filter((s: Student) => s.status === 'active').length,
        paused: allStudents.filter((s: Student) => s.status === 'paused').length,
        graduated: allStudents.filter((s: Student) => s.status === 'graduated').length,
        trialThisMonth: allStudents.filter((s: Student) =>
          s.student_type === 'trial' && s.created_at >= thisMonthStartStr
        ).length,
        convertedThisMonth: allStudents.filter((s: Student & { trial_converted_date?: string }) =>
          s.status === 'active' &&
          s.trial_converted_date &&
          s.trial_converted_date >= thisMonthStartStr
        ).length,
      }

      const result: DashboardData = {
        stats,
        todaySchedules: todayScheduleItems,
        problemPlanStudents,
        weeklySummary,
        alertStudents,
        studentOverview,
        todos: allTodos,
      }
      
      // 更新缓存
      dashboardCache = {
        data: result,
        timestamp: Date.now(),
        dateKey: today
      }
      
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [config])

  useEffect(() => {
    // 检查缓存有效性
    if (isCacheValid(dashboardCache, config)) {
      setData(dashboardCache!.data)
      setLoading(false)
      return
    }
    
    loadData()
  }, [loadData, config])

  return { 
    data, 
    loading, 
    error, 
    refresh: () => loadData(true),  // 强制刷新
    clearCache: clearDashboardCache  // 清除缓存
  }
}