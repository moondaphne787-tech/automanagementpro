/**
 * 课堂记录服务层
 * 负责课堂记录创建/更新/删除的副作用编排
 * Store 只负责状态管理和数据刷新，不承担业务编排
 */
import type { ClassRecord, TaskBlock } from '@/types'
import { classRecordDb, billingDb, wordbankDb, progressDb, teacherDb } from '@/db'
import {
  syncWordbankProgressForRecord,
  syncWordbankProgressForBatch,
} from './wordbankSyncService'
import {
  syncTeacherHours,
  adjustTeacherHoursOnUpdate,
  rollbackTeacherHours,
  syncTeacherHoursForBatch,
} from './teacherHoursService'

// ===== 创建课堂记录的入参类型 =====
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
 * 核心流程：创建记录 + 更新课时（事务） → 同步词库进度 → 同步助教课时
 */
export async function createClassRecord(data: CreateClassRecordData): Promise<ClassRecord> {
  // 1. 事务性操作：创建记录 + 更新课时
  const billing = await billingDb.getByStudentId(data.student_id)
  const billingUpdate = billing && data.duration_hours ? {
    student_id: data.student_id,
    used_hours_delta: data.duration_hours
  } : undefined
  
  const record = await classRecordDb.createWithBillingUpdate(data, billingUpdate)
  
  // 2. 词库进度同步（best-effort）
  try {
    const wordbanks = await wordbankDb.getAll()
    const existingProgress = await progressDb.getByStudentId(data.student_id)
    await syncWordbankProgressForRecord(data.student_id, data.tasks, wordbanks, existingProgress)
  } catch (err) {
    console.warn('[classRecordService] 词库进度同步失败（不影响核心数据）:', err)
  }
  
  // 3. 助教课时同步（best-effort）
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
 * 处理课时调整和助教课时调整
 */
export async function updateClassRecord(
  id: string,
  data: Partial<ClassRecord>
): Promise<ClassRecord | undefined> {
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
    const newTeacherName = data.teacher_name !== undefined ? data.teacher_name : oldRecord.teacher_name
    const newDuration = data.duration_hours ?? oldRecord.duration_hours
    
    await adjustTeacherHoursOnUpdate({
      oldTeacherName: oldRecord.teacher_name,
      newTeacherName: newTeacherName,
      oldDuration: oldRecord.duration_hours,
      newDuration: newDuration,
    })
  }
  
  return record
}

/**
 * 删除课堂记录（含所有副作用）
 * 回退学员课时和助教课时
 */
export async function deleteClassRecord(id: string): Promise<ClassRecord | undefined> {
  const record = await classRecordDb.getById(id)
  if (!record) return undefined
  
  // 回退学员课时
  if (record.duration_hours) {
    const billing = await billingDb.getByStudentId(record.student_id)
    if (billing) {
      await billingDb.update(record.student_id, {
        used_hours: Math.max(0, billing.used_hours - record.duration_hours)
      })
    }
  }
  
  // 回退助教课时
  await rollbackTeacherHours(record.teacher_name, record.duration_hours)
  
  await classRecordDb.delete(id)
  
  return record
}

/**
 * 批量导入课堂记录（含所有副作用）
 * 核心流程：批量创建 + 课时更新（事务） → 词库进度同步 → 助教课时同步
 */
export async function batchImportClassRecords(
  records: CreateClassRecordData[]
): Promise<number> {
  // 1. 按学员汇总课时变化
  const studentHoursMap = new Map<string, number>()
  for (const record of records) {
    if (record.duration_hours && record.student_id) {
      const current = studentHoursMap.get(record.student_id) || 0
      studentHoursMap.set(record.student_id, current + record.duration_hours)
    }
  }
  
  // 2. 事务性操作：批量创建记录 + 更新课时
  const count = await classRecordDb.batchCreateWithBillingUpdate(records, studentHoursMap)
  
  // 3. 词库进度同步
  await syncWordbankProgressForBatch(records)
  
  // 4. 助教课时同步
  await syncTeacherHoursForBatch(records)
  
  return count
}
