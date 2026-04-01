import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { studentDb } from '../db/students'
import { lessonPlanDb } from '../db/lessonPlans'
import { classRecordDb } from '../db/classRecords'
import { scheduledClassDb } from '../db/schedule'
import { billingDb } from '../db/billing'
import { todoDb } from '../db/todos'
import { getWeekRange, getTodayStr } from '../lib/dateUtils'
import {
  formatDateRange,
  calculateWeeklySummary,
  buildTodayScheduleItems,
  buildPlanStatusItems,
  buildAlertStudents,
  buildStudentOverview,
  buildDashboardStats,
  getExpiredPlanCounts,
  getScheduleCountByStudent,
} from '../utils/dashboardUtils'
import type { 
  Student, 
  Billing, 
  LessonPlan, 
  ClassRecord, 
  ScheduledClass,
  DashboardData
} from '../types'

// 向后兼容：re-export DashboardData 类型（如有其他地方从此 hook 导入）
export type { DashboardData } from '../types'

// 缓存配置
interface CacheConfig {
  staleTime: number  // 数据新鲜时间（毫秒），在此时间内不会重新请求
  cacheTime: number  // 缓存保留时间（毫秒），超过此时间缓存会被清除
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  staleTime: 30 * 1000,  // 30 秒内数据视为新鲜
  cacheTime: 5 * 60 * 1000,  // 5 分钟后缓存失效
}

// 清除缓存 - 使用 store 的方法
export function clearDashboardCache(): void {
  useAppStore.getState().clearDashboardCache()
}

export function useDashboard(cacheConfig: Partial<CacheConfig> = {}) {
  const config = { ...DEFAULT_CACHE_CONFIG, ...cacheConfig }
  
  // 从 store 获取缓存状态和方法
  const dashboardData = useAppStore(state => state.dashboardData)
  const dashboardLoadedAt = useAppStore(state => state.dashboardLoadedAt)
  const dashboardDateKey = useAppStore(state => state.dashboardDateKey)
  const setDashboardCache = useAppStore(state => state.setDashboardCache)
  const isDashboardCacheValid = useAppStore(state => state.isDashboardCacheValid)
  
  const [data, setData] = useState<DashboardData | null>(() => {
    // 初始化时检查是否有有效缓存
    if (isDashboardCacheValid(config.staleTime)) {
      return dashboardData
    }
    return null
  })
  const [loading, setLoading] = useState(() => !isDashboardCacheValid(config.staleTime))
  const [error, setError] = useState<string | null>(null)
  
  // 使用 ref 追踪是否正在进行请求
  const isLoadingRef = useRef(false)

  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    // 如果有有效缓存且不是强制刷新，直接返回缓存数据
    if (!forceRefresh && isDashboardCacheValid(config.staleTime)) {
      setData(dashboardData!)
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

      // ---------- 使用工具函数构建数据 ----------

      // 顶部统计卡片
      const stats = buildDashboardStats(
        todaySchedules,
        weekSchedulesAll,
        weekPlans,
        allBillings as (Billing & { remaining_hours: number })[],
        allStudents
      )

      // 今日排课
      const todayRecords = weekRecords.filter((r: ClassRecord) => r.class_date === today)
      const todayScheduleItems = buildTodayScheduleItems(
        todaySchedules,
        allStudents,
        todayRecords,
        weekPlans,
        today
      )

      // 本周计划状态
      const problemPlanStudents = buildPlanStatusItems(
        weekSchedulesAll,
        weekPlans,
        expiredPlans,
        allStudents
      )

      // 本周课堂总结
      // 先检查本周是否有课堂记录
      let summaryWeekRange = week
      let summaryRecords = weekRecords
      let summaryScheduledStudents = new Set<string>(
        weekSchedulesAll.map((s: ScheduledClass) => s.student_id)
      )

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

      const weeklySummary = calculateWeeklySummary(
        summaryRecords,
        summaryScheduledStudents,
        summaryWeekRange.label,
        formatDateRange(summaryWeekRange.start, summaryWeekRange.end)
      )

      // 需关注学员
      const expiredByStudent = getExpiredPlanCounts(expiredPlans)
      const scheduleCountByStudent = getScheduleCountByStudent(weekSchedulesAll)
      const alertStudents = buildAlertStudents(
        activeStudents,
        allBillings,
        weekRecords,
        expiredByStudent,
        scheduleCountByStudent
      )

      // 学员总览
      const studentOverview = buildStudentOverview(allStudents)

      const result: DashboardData = {
        stats,
        todaySchedules: todayScheduleItems,
        problemPlanStudents,
        weeklySummary,
        alertStudents,
        studentOverview,
        todos: allTodos,
      }
      
      // 更新缓存到 store
      setDashboardCache(result, today)
      
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [config.staleTime, isDashboardCacheValid, dashboardData, setDashboardCache])

  useEffect(() => {
    // 检查缓存有效性
    if (isDashboardCacheValid(config.staleTime)) {
      setData(dashboardData!)
      setLoading(false)
      return
    }
    
    loadData()
  }, [loadData, config.staleTime, isDashboardCacheValid, dashboardData])

  return { 
    data, 
    loading, 
    error, 
    refresh: () => loadData(true),  // 强制刷新
    clearCache: clearDashboardCache  // 清除缓存（使用 store 方法）
  }
}