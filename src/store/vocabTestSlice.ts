import type { StateCreator } from 'zustand'
import type { AppState, VocabTestSlice } from './types'
import { vocabTestDb } from '@/db'
import { toast } from 'sonner'

export const createVocabTestSlice: StateCreator<AppState, [], [], VocabTestSlice> = (set, get) => ({
  vocabTests: [],
  vocabTestsLoading: false,

  loadVocabTests: async (studentId) => {
    set({ vocabTestsLoading: true })
    try {
      const tests = await vocabTestDb.getByStudentId(studentId)
      set({ vocabTests: tests })
    } catch (e) {
      console.error('Failed to load vocab tests:', e)
      toast.error('加载词汇量记录失败')
    } finally {
      set({ vocabTestsLoading: false })
    }
  },

  createVocabTest: async (data) => {
    try {
      const test = await vocabTestDb.create(data)
      await get().loadVocabTests(data.student_id)
      return test
    } catch (e) {
      console.error('Failed to create vocab test:', e)
      toast.error('添加词汇量记录失败')
      return undefined
    }
  },

  updateVocabTest: async (id, data) => {
    try {
      const test = await vocabTestDb.update(id, data)
      if (test && get().currentStudent?.id === test.student_id) {
        await get().loadVocabTests(test.student_id)
      }
      return test
    } catch (e) {
      console.error('Failed to update vocab test:', e)
      toast.error('更新词汇量记录失败')
      return undefined
    }
  },

  deleteVocabTest: async (id) => {
    try {
      const test = await vocabTestDb.getById(id)
      if (test) {
        await vocabTestDb.delete(id)
        if (get().currentStudent?.id === test.student_id) {
          await get().loadVocabTests(test.student_id)
        }
      }
    } catch (e) {
      console.error('Failed to delete vocab test:', e)
      toast.error('删除词汇量记录失败')
    }
  }
})
