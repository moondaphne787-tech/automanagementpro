/**
 * 课堂记录服务层
 * 负责课堂记录创建/更新/删除的副作用编排
 * 包含：学员课时更新、词库进度同步、助教课时同步
 */
import type { ClassRecord, TaskBlock, Teacher, Wordbank, StudentWordbankProgress } from '@/types'
import { classRecordDb, billingDb, wordbankDb, progressDb, teacherDb } from '@/db'
import { toast } from 'sonner'
import { matchTeacherByName } from '@/lib/utils'

// ============================================================
// 助教课时同步（原 teacherHoursService.ts）
// ============================================================
async function syncTeacherHours(teacherName: string | undefined, durationHours: number, allTeachers: Teacher[]): Promise<void> {
  if (!teacherName || !durationHours) return
  const matchedTeacher = matchTeacherByName(teacherName, allTeachers)
  if (matchedTeacher) {
    await teacherDb.addTeachingHours(matchedTeacher.id, durationHours)
  }
}

async function adjustTeacherHoursOnUpdate(params: {
  oldTeacherName: string | null
  newTeacherName: string | null
  oldDuration: number
  newDuration: number
}): Promise<void> {
  const { oldTeacherName, newTeacherName, oldDuration, newDuration } = params
  if (oldTeacherName === newTeacherName && oldDuration === newDuration) return

  const allTeachers = await teacherDb.getAll()

  if (oldTeacherName && oldDuration) {
    const oldTeacher = matchTeacherByName(oldTeacherName, allTeachers)
    if (oldTeacher) {
      await teacherDb.update(oldTeacher.id, {
        total_teaching_hours: Math.max(0, oldTeacher.total_teaching_hours - oldDuration)
      })
    }
  }

  if (newTeacherName && newDuration) {
    const updatedTeachers = await teacherDb.getAll()
    const newTeacher = matchTeacherByName(newTeacherName, updatedTeachers)
    if (newTeacher) {
      await teacherDb.addTeachingHours(newTeacher.id, newDuration)
    }
  }
}

async function rollbackTeacherHours(teacherName: string | null, durationHours: number): Promise<void> {
  if (!teacherName || !durationHours) return
  const allTeachers = await teacherDb.getAll()
  const teacher = matchTeacherByName(teacherName, allTeachers)
  if (teacher) {
    await teacherDb.update(teacher.id, {
      total_teaching_hours: Math.max(0, teacher.total_teaching_hours - durationHours)
    })
  }
}

export function collectTeacherHoursUpdates(records: Array<{ teacher_name?: string; duration_hours?: number }>): Map<string, number> {
  const teacherHoursMap = new Map<string, number>()
  for (const record of records) {
    if (record.teacher_name && record.duration_hours) {
      const current = teacherHoursMap.get(record.teacher_name) || 0
      teacherHoursMap.set(record.teacher_name, current + record.duration_hours)
    }
  }
  return teacherHoursMap
}

async function syncTeacherHoursForBatch(records: Array<{ teacher_name?: string; duration_hours?: number }>): Promise<void> {
  const teacherHoursMap = collectTeacherHoursUpdates(records)
  if (teacherHoursMap.size > 0) {
    const allTeachers = await teacherDb.getAll()
    for (const [teacherName, hours] of teacherHoursMap) {
      await syncTeacherHours(teacherName, hours, allTeachers)
    }
  }
}

// ============================================================
// 词库进度同步（原 wordbankSyncService.ts）
// ============================================================
async function syncWordbankProgressForRecord(
  studentId: string,
  tasks: TaskBlock[],
  wordbanks: Wordbank[],
  existingProgress: StudentWordbankProgress[]
): Promise<void> {
  for (const task of tasks) {
    const effectiveLevel = task.level_reached ?? task.level_to
    if ((task.type === 'vocab_new' || task.type === 'vocab_review') &&
        task.wordbank_label && effectiveLevel) {
      const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
      if (wordbank) {
        const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)

        if (!currentProgress || effectiveLevel > currentProgress.current_level) {
          await progressDb.upsert({
            student_id: studentId,
            wordbank_id: wordbank.id,
            current_level: effectiveLevel
          })
        }
      }
    }
  }
}

export function collectWordbankProgressUpdates(
  records: Array<{ student_id: string; tasks: TaskBlock[] }>,
  wordbankMap: Map<string, Wordbank>,
  progressMap: Map<string, StudentWordbankProgress[]>
): {
  updates: Array<{ student_id: string; wordbank_id: string; current_level: number }>
} {
  const updates: Array<{ student_id: string; wordbank_id: string; current_level: number }> = []

  for (const record of records) {
    for (const task of record.tasks) {
      const effectiveLevel = task.level_reached ?? task.level_to
      if ((task.type === 'vocab_new' || task.type === 'vocab_review') &&
          task.wordbank_label && effectiveLevel) {
        const wordbank = wordbankMap.get(task.wordbank_label)
        if (wordbank) {
          const existingProgress = progressMap.get(record.student_id) || []
          const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)

          if (!currentProgress || effectiveLevel > currentProgress.current_level) {
            updates.push({ student_id: record.student_id, wordbank_id: wordbank.id, current_level: effectiveLevel })
          }
        }
      }
    }
  }

  return { updates }
}

async function syncWordbankProgressForBatch(records: Array<{ student_id: string; tasks: TaskBlock[] }>): Promise<void> {
  const wordbanks = await wordbankDb.getAll()
  const wordbankMap = new Map(wordbanks.map(w => [w.name, w]))

  const uniqueStudentIds = [...new Set(records.map(r => r.student_id))]
  const progressMap = await progressDb.getAllForStudents(uniqueStudentIds)

  const { updates } = collectWordbankProgressUpdates(records, wordbankMap, progressMap)

  await progressDb.batchUpsert(updates, wordbanks, progressMap)
}

// ============================================================
// 公开 API
// ============================================================

export interface CreateClassRecordData {
  student_id: string
  class_date: string
  duration_hours?: number
  teacher_name?: string
  attendance?: 'present' | 'absent' | 'late'
  tasks: TaskBlock[]
  task_completed?: 'completed' | 'partial' | 'not_completed'
  incomplete_reason?: string
  performance?: 'excellent' | 'good' | 'needs_improvement'
  detail_feedback?: string
  highlights?: string
  issues?: string
  checkin_completed?: boolean
  phase_id?: string
  imported_from_excel?: boolean
}

/**
 * 创建课堂记录（含所有副作用）
 */
export async function createClassRecord(data: CreateClassRecordData): Promise<ClassRecord> {
  const billing = await billingDb.getByStudentId(data.student_id)
  const billingUpdate = billing && data.duration_hours ? {
    student_id: data.student_id,
    used_hours_delta: data.duration_hours
  } : undefined

  const record = await classRecordDb.createWithBillingUpdate(data, billingUpdate)

  // 词库进度同步（best-effort）
  try {
    const wordbanks = await wordbankDb.getAll()
    const existingProgress = await progressDb.getByStudentId(data.student_id)
    await syncWordbankProgressForRecord(data.student_id, data.tasks, wordbanks, existingProgress)
  } catch (err) {
    console.warn('[classRecordService] 词库进度同步失败（不影响核心数据）:', err)
  }

  // 助教课时同步（best-effort）
  try {
    const allTeachers = await teacherDb.getAll()
    await syncTeacherHours(data.teacher_name, data.duration_hours ?? 0, allTeachers)
  } catch (err) {
    console.warn('[classRecordService] 助教课时同步失败（不影响核心数据）:', err)
  }

  return record
}

/**
 * 更新课堂记录（含所有副作用）
 */
export async function updateClassRecord(id: string, data: Partial<ClassRecord>): Promise<ClassRecord | undefined> {
  const oldRecord = await classRecordDb.getById(id)
  if (!oldRecord) return undefined

  const record = await classRecordDb.update(id, data)
  if (!record) return undefined

  // 课时调整
  if (data.duration_hours !== undefined && oldRecord.duration_hours !== data.duration_hours) {
    const billing = await billingDb.getByStudentId(record.student_id)
    if (billing) {
      const newUsedHours = Math.max(0, billing.used_hours - oldRecord.duration_hours + data.duration_hours)
      await billingDb.update(record.student_id, { used_hours: newUsedHours })
    }
  }

  // 助教课时调整
  if (data.duration_hours !== undefined || data.teacher_name !== undefined) {
    await adjustTeacherHoursOnUpdate({
      oldTeacherName: oldRecord.teacher_name,
      newTeacherName: data.teacher_name ?? oldRecord.teacher_name,
      oldDuration: oldRecord.duration_hours,
      newDuration: data.duration_hours ?? oldRecord.duration_hours,
    })
  }

  return record
}

/**
 * 删除课堂记录（含所有副作用）
 */
export async function deleteClassRecord(id: string): Promise<ClassRecord | undefined> {
  const record = await classRecordDb.getById(id)
  if (!record) return undefined

  if (record.duration_hours) {
    const billing = await billingDb.getByStudentId(record.student_id)
    if (billing) {
      await billingDb.update(record.student_id, {
        used_hours: Math.max(0, billing.used_hours - record.duration_hours)
      })
    }
  }

  await rollbackTeacherHours(record.teacher_name, record.duration_hours)
  await classRecordDb.delete(id)
  return record
}

/**
 * 批量导入课堂记录（含所有副作用）
 */
export async function batchImportClassRecords(records: CreateClassRecordData[]): Promise<number> {
  const studentHoursMap = new Map<string, number>()
  for (const record of records) {
    if (record.duration_hours && record.student_id) {
      const current = studentHoursMap.get(record.student_id) || 0
      studentHoursMap.set(record.student_id, current + record.duration_hours)
    }
  }

  const count = await classRecordDb.batchCreateWithBillingUpdate(records, studentHoursMap)
  await syncWordbankProgressForBatch(records)
  await syncTeacherHoursForBatch(records)
  return count
}
