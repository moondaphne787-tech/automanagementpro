import type { StateCreator } from 'zustand'
import type { AppState, ExamScoreSlice } from './types'
import { examScoreDb } from '@/db'
import { toast } from 'sonner'

export const createExamScoreSlice: StateCreator<AppState, [], [], ExamScoreSlice> = (set, get) => ({
  examScores: [],
  examScoresLoading: false,

  loadExamScores: async (studentId) => {
    set({ examScoresLoading: true })
    try {
      const scores = await examScoreDb.getByStudentId(studentId)
      set({ examScores: scores })
    } catch (e) {
      console.error('Failed to load exam scores:', e)
      toast.error('加载考试成绩失败')
    } finally {
      set({ examScoresLoading: false })
    }
  },

  createExamScore: async (data) => {
    try {
      const score = await examScoreDb.create(data)
      await get().loadExamScores(data.student_id)
      return score
    } catch (e) {
      console.error('Failed to create exam score:', e)
      toast.error('添加考试成绩失败')
      return undefined
    }
  },

  updateExamScore: async (id, data) => {
    try {
      const score = await examScoreDb.update(id, data)
      if (score && get().currentStudent?.id === score.student_id) {
        await get().loadExamScores(score.student_id)
      }
      return score
    } catch (e) {
      console.error('Failed to update exam score:', e)
      toast.error('更新考试成绩失败')
      return undefined
    }
  },

  deleteExamScore: async (id) => {
    try {
      const score = await examScoreDb.getById(id)
      if (score) {
        await examScoreDb.delete(id)
        if (get().currentStudent?.id === score.student_id) {
          await get().loadExamScores(score.student_id)
        }
      }
    } catch (e) {
      console.error('Failed to delete exam score:', e)
      toast.error('删除考试成绩失败')
    }
  }
})
