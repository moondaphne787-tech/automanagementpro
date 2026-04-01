/**
 * Dashboard 工具函数模块
 * 从 useDashboard hook 中抽离的纯计算函数
 */

import type { 
  Student, 
  Billing, 
  LessonPlan, 
  ClassRecord, 
  ScheduledClass,
  WeeklySummary,
  AlertStudentItem,
  DashboardStats,
  TodayScheduleItem,
  PlanStatusItem,
  StudentOverviewData
} from '@/types'
import { formatLocalDate } from '@/lib/dateUtils'

/**
 * 格式化日期范围显示
 */
export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`
}

/**
 * 计算周课堂总结数据
 */
export function calculateWeeklySummary(
  records: ClassRecord[],
  scheduledStudents: Set<string>,
  weekLabel: string,
  dateRange: string
): WeeklySummary {
  // 使用 task_completed 字段计算完成率
  // 'completed' 表示 100% 完成，'partial' 表示部分完成（按 50% 权重计算）
  const weightedCompleted = records.reduce((sum, r) => {
    if (r.task_completed === 'completed') return sum + 1
    if (r.task_completed === 'partial') return sum + 0.5
    return sum
  }, 0)
  const avgCompletionRate = records.length > 0
    ? Math.round(weightedCompleted / records.length * 100)
    : 0

  const totalHours = records.reduce((sum, r) => sum + (r.duration_hours ?? 0), 0)
  const attendanceCount = records.filter(r => r.attendance === 'present').length
  const recordedStudentIds = new Set(records.map(r => r.student_id))
  const unrecorded = [...scheduledStudents].filter(
    id => !recordedStudentIds.has(id)
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

/**
 * 构建今日排课数据
 */
export function buildTodayScheduleItems(
  todaySchedules: ScheduledClass[],
  allStudents: Student[],
  todayRecords: ClassRecord[],
  weekPlans: LessonPlan[],
  today: string
): TodayScheduleItem[] {
  const todayPlanStudentIds = new Set<string>(
    weekPlans.filter(p => p.plan_date === today).map(p => p.student_id)
  )
  const todayRecordStudentIds = new Set<string>(todayRecords.map(r => r.student_id))

  return todaySchedules
    .map(s => {
      const student = allStudents.find(st => st.id === s.student_id)
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
    })
    .filter(s => s.startTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

/**
 * 构建计划状态数据（只返回有问题的）
 */
export function buildPlanStatusItems(
  weekSchedulesAll: ScheduledClass[],
  weekPlans: LessonPlan[],
  expiredPlans: LessonPlan[],
  allStudents: Student[]
): PlanStatusItem[] {
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
    const student = allStudents.find(s => s.id === studentId)
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

  return problemPlanStudents
}

/**
 * 构建预警学员数据
 */
export function buildAlertStudents(
  activeStudents: Student[],
  allBillings: Billing[],
  weekRecords: ClassRecord[],
  expiredByStudent: Map<string, number>,
  scheduleCountByStudent: Map<string, number>
): AlertStudentItem[] {
  const alertStudents: AlertStudentItem[] = []

  for (const student of activeStudents) {
    const studentAlerts: AlertStudentItem['alerts'] = []

    // 课时预警
    const billing = allBillings.find(b => b.student_id === student.id)
    if (billing && (billing.remaining_hours ?? 99) <= 3) {
      studentAlerts.push({
        type: 'low_hours',
        message: `剩余课时仅 ${billing.remaining_hours?.toFixed(1) ?? '?'} 小时`
      })
    }

    // 本周暂无课堂记录
    if (scheduleCountByStudent.has(student.id)) {
      const studentRecords = weekRecords.filter(r => r.student_id === student.id)
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
  return alertStudents.sort((a, b) => b.alerts.length - a.alerts.length)
}

/**
 * 构建学员总览数据
 */
export function buildStudentOverview(
  allStudents: Student[]
): StudentOverviewData {
  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)
  const thisMonthStartStr = formatLocalDate(thisMonthStart)

  return {
    total: allStudents.length,
    active: allStudents.filter(s => s.status === 'active').length,
    paused: allStudents.filter(s => s.status === 'paused').length,
    graduated: allStudents.filter(s => s.status === 'graduated').length,
    trialThisMonth: allStudents.filter(s =>
      s.student_type === 'trial' && s.created_at >= thisMonthStartStr
    ).length,
    convertedThisMonth: allStudents.filter((s: Student & { trial_converted_date?: string }) =>
      s.status === 'active' &&
      s.trial_converted_date &&
      s.trial_converted_date >= thisMonthStartStr
    ).length,
  }
}

/**
 * 构建统计卡片数据
 */
export function buildDashboardStats(
  todaySchedules: ScheduledClass[],
  weekSchedulesAll: ScheduledClass[],
  weekPlans: LessonPlan[],
  allBillings: (Billing & { remaining_hours: number })[],
  allStudents: Student[]
): DashboardStats {
  const lowHoursStudents = allBillings.filter(b => (b.remaining_hours ?? 0) <= 3)
  const trialStudents = allStudents.filter(s =>
    s.student_type === 'trial' && s.status === 'active'
  )

  const studentsWithWeekSchedule = new Set<string>(
    weekSchedulesAll.map(s => s.student_id)
  )
  const studentsWithWeekPlan = new Set<string>(weekPlans.map(p => p.student_id))
  const missingPlanCount = [...studentsWithWeekSchedule].filter(
    id => !studentsWithWeekPlan.has(id)
  ).length

  return {
    todayScheduleCount: todaySchedules.length,
    missingPlanCount,
    lowHoursCount: lowHoursStudents.length,
    trialStudentCount: trialStudents.length,
  }
}

/**
 * 获取学员过期计划统计
 */
export function getExpiredPlanCounts(expiredPlans: LessonPlan[]): Map<string, number> {
  const expiredByStudent = new Map<string, number>()
  for (const p of expiredPlans) {
    expiredByStudent.set(p.student_id, (expiredByStudent.get(p.student_id) ?? 0) + 1)
  }
  return expiredByStudent
}

/**
 * 获取学员排课数量统计
 */
export function getScheduleCountByStudent(schedules: ScheduledClass[]): Map<string, number> {
  const countByStudent = new Map<string, number>()
  for (const s of schedules) {
    countByStudent.set(s.student_id, (countByStudent.get(s.student_id) ?? 0) + 1)
  }
  return countByStudent
}