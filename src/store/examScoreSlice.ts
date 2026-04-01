import type { StateCreator } from 'zustand'
import type { AppState, ExamScoreSlice } from './types'
import { examScoreDb } from '@/db'

export const createExamScoreSlice: StateCreator<AppState, [], [], ExamScoreSlice> = (set, get) => ({
  // 初始状态
  examScores: [],

  // 加载考试成绩
  loadExamScores: async (studentId) => {
    const scores = await examScoreDb.getByStudentId(studentId)
    set({ examScores: scores })
  },

  // 创建考试成绩
  createExamScore: async (data) => {
    const score = await examScoreDb.create(data)
    await get().loadExamScores(data.student_id)
    return score
  },

  // 更新考试成绩
  updateExamScore: async (id, data) => {
    const score = await examScoreDb.update(id, data)
    if (score && get().currentStudent?.id === score.student_id) {
      await get().loadExamScores(score.student_id)
    }
    return score
  },

  // 删除考试成绩
  deleteExamScore: async (id) => {
    const score = await examScoreDb.getById(id)
    if (score) {
      await examScoreDb.delete(id)
      if (get().currentStudent?.id === score.student_id) {
        await get().loadExamScores(score.student_id)
      }
    }
  }
})