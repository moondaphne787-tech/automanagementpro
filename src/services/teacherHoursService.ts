/**
 * 助教课时同步服务
 * 负责课堂记录创建/更新/删除后的助教课时同步逻辑
 */
import type { Teacher } from '@/types'
import { teacherDb } from '@/db'
import { matchTeacherByName } from '@/lib/utils'

/**
 * 单条课堂记录创建后同步助教课时
 * best-effort 操作，失败不影响核心数据
 */
export async function syncTeacherHours(
  teacherName: string | undefined,
  durationHours: number,
  allTeachers: Teacher[]
): Promise<void> {
  if (!teacherName || !durationHours) return
  
  const matchedTeacher = matchTeacherByName(teacherName, allTeachers)
  if (matchedTeacher) {
    await teacherDb.addTeachingHours(matchedTeacher.id, durationHours)
  }
}

/**
 * 课堂记录更新时调整助教课时
 * 处理助教变更和时长变更两种情况
 */
export async function adjustTeacherHoursOnUpdate(params: {
  oldTeacherName: string | null
  newTeacherName: string | null
  oldDuration: number
  newDuration: number
}): Promise<void> {
  const { oldTeacherName, newTeacherName, oldDuration, newDuration } = params
  
  if (oldTeacherName === newTeacherName && oldDuration === newDuration) return
  
  const allTeachers = await teacherDb.getAll()
  
  // 回退原助教课时
  if (oldTeacherName && oldDuration) {
    const oldTeacher = matchTeacherByName(oldTeacherName, allTeachers)
    if (oldTeacher) {
      await teacherDb.update(oldTeacher.id, {
        total_teaching_hours: Math.max(0, oldTeacher.total_teaching_hours - oldDuration)
      })
    }
  }
  
  // 累加新助教课时（重新获取最新数据）
  if (newTeacherName && newDuration) {
    const updatedTeachers = await teacherDb.getAll()
    const newTeacher = matchTeacherByName(newTeacherName, updatedTeachers)
    if (newTeacher) {
      await teacherDb.addTeachingHours(newTeacher.id, newDuration)
    }
  }
}

/**
 * 课堂记录删除时回退助教课时
 */
export async function rollbackTeacherHours(
  teacherName: string | null,
  durationHours: number
): Promise<void> {
  if (!teacherName || !durationHours) return
  
  const allTeachers = await teacherDb.getAll()
  const teacher = matchTeacherByName(teacherName, allTeachers)
  if (teacher) {
    await teacherDb.update(teacher.id, {
      total_teaching_hours: Math.max(0, teacher.total_teaching_hours - durationHours)
    })
  }
}

/**
 * 收集批量导入时按助教姓名汇总的课时（纯计算，无副作用）
 */
export function collectTeacherHoursUpdates(
  records: Array<{ teacher_name?: string; duration_hours?: number }>
): Map<string, number> {
  const teacherHoursMap = new Map<string, number>()
  
  for (const record of records) {
    if (record.teacher_name && record.duration_hours) {
      const current = teacherHoursMap.get(record.teacher_name) || 0
      teacherHoursMap.set(record.teacher_name, current + record.duration_hours)
    }
  }
  
  return teacherHoursMap
}

/**
 * 批量导入后同步助教课时
 */
export async function syncTeacherHoursForBatch(
  records: Array<{ teacher_name?: string; duration_hours?: number }>
): Promise<void> {
  const teacherHoursMap = collectTeacherHoursUpdates(records)
  
  if (teacherHoursMap.size > 0) {
    const allTeachers = await teacherDb.getAll()
    for (const [teacherName, hours] of teacherHoursMap) {
      await syncTeacherHours(teacherName, hours, allTeachers)
    }
  }
}
