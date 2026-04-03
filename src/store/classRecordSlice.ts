import type { StateCreator } from 'zustand'
import type { AppState, ClassRecordSlice } from './types'
import { classRecordDb, billingDb } from '@/db'
import {
  createClassRecord as serviceCreate,
  updateClassRecord as serviceUpdate,
  deleteClassRecord as serviceDelete,
  batchImportClassRecords as serviceBatchImport,
} from '@/services/classRecordService'

export const createClassRecordSlice: StateCreator<AppState, [], [], ClassRecordSlice> = (set, get) => ({
  // 初始状态
  classRecords: [],

  // 加载课堂记录
  loadClassRecords: async (studentId) => {
    const records = await classRecordDb.getByStudentId(studentId)
    set({ classRecords: records })
  },

  // 创建课堂记录 — 业务逻辑委托给 service 层
  createClassRecord: async (data) => {
    const record = await serviceCreate(data)
    
    // 刷新 UI 状态
    await get().loadClassRecords(data.student_id)
    if (get().currentStudent?.id === data.student_id) {
      const billing = await billingDb.getByStudentId(data.student_id)
      set({ currentBilling: billing ?? null })
      await get().loadProgress(data.student_id)
    }
    await get().loadStudents()
    
    return record
  },

  // 更新课堂记录 — 业务逻辑委托给 service 层
  updateClassRecord: async (id, data) => {
    const record = await serviceUpdate(id, data)
    if (!record) return undefined
    
    // 刷新 UI 状态
    if (get().currentStudent?.id === record.student_id) {
      await get().loadClassRecords(record.student_id)
      const billing = await billingDb.getByStudentId(record.student_id)
      set({ currentBilling: billing ?? null })
    }
    await get().loadStudents()
    
    return record
  },

  // 删除课堂记录 — 业务逻辑委托给 service 层
  deleteClassRecord: async (id) => {
    const record = await serviceDelete(id)
    if (!record) return
    
    // 刷新 UI 状态
    if (get().currentStudent?.id === record.student_id) {
      await get().loadClassRecords(record.student_id)
      const billing = await billingDb.getByStudentId(record.student_id)
      set({ currentBilling: billing ?? null })
    }
    await get().loadStudents()
  },

  // 批量导入课堂记录 — 业务逻辑委托给 service 层
  batchImportClassRecords: async (records) => {
    const count = await serviceBatchImport(records)
    
    // 刷新 UI 状态
    await get().loadStudents()
    return count
  }
})
