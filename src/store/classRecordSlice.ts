import type { StateCreator } from 'zustand'
import type { AppState, ClassRecordSlice } from './types'
import { classRecordDb, billingDb } from '@/db'
import { toast } from 'sonner'
import {
  createClassRecord as serviceCreate,
  updateClassRecord as serviceUpdate,
  deleteClassRecord as serviceDelete,
  batchImportClassRecords as serviceBatchImport,
} from '@/services/classRecordService'

export const createClassRecordSlice: StateCreator<AppState, [], [], ClassRecordSlice> = (set, get) => ({
  classRecords: [],
  classRecordsLoading: false,

  loadClassRecords: async (studentId) => {
    set({ classRecordsLoading: true })
    try {
      const records = await classRecordDb.getByStudentId(studentId)
      set({ classRecords: records })
    } catch (e) {
      console.error('Failed to load class records:', e)
      toast.error('加载课堂记录失败')
    } finally {
      set({ classRecordsLoading: false })
    }
  },

  createClassRecord: async (data) => {
    try {
      const record = await serviceCreate(data)
      await get().loadClassRecords(data.student_id)
      if (get().currentStudent?.id === data.student_id) {
        const billing = await billingDb.getByStudentId(data.student_id)
        set({ currentBilling: billing ?? null })
        await get().loadProgress(data.student_id)
      }
      await get().loadStudents()
      return record
    } catch (e) {
      console.error('Failed to create class record:', e)
      toast.error('创建课堂记录失败')
      return undefined
    }
  },

  updateClassRecord: async (id, data) => {
    try {
      const record = await serviceUpdate(id, data)
      if (!record) return undefined
      if (get().currentStudent?.id === record.student_id) {
        await get().loadClassRecords(record.student_id)
        const billing = await billingDb.getByStudentId(record.student_id)
        set({ currentBilling: billing ?? null })
      }
      await get().loadStudents()
      return record
    } catch (e) {
      console.error('Failed to update class record:', e)
      toast.error('更新课堂记录失败')
      return undefined
    }
  },

  deleteClassRecord: async (id) => {
    try {
      const record = await serviceDelete(id)
      if (!record) return
      if (get().currentStudent?.id === record.student_id) {
        await get().loadClassRecords(record.student_id)
        const billing = await billingDb.getByStudentId(record.student_id)
        set({ currentBilling: billing ?? null })
      }
      await get().loadStudents()
    } catch (e) {
      console.error('Failed to delete class record:', e)
      toast.error('删除课堂记录失败')
    }
  },

  batchImportClassRecords: async (records) => {
    try {
      const count = await serviceBatchImport(records)
      await get().loadStudents()
      return count
    } catch (e) {
      console.error('Failed to batch import class records:', e)
      toast.error('批量导入课堂记录失败')
      return 0
    }
  }
})
