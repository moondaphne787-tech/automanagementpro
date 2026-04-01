import type { StateCreator } from 'zustand'
import type { AppState, LearningPhaseSlice } from './types'
import { learningPhaseDb } from '@/db'

export const createLearningPhaseSlice: StateCreator<AppState, [], [], LearningPhaseSlice> = (set, get) => ({
  // 初始状态
  learningPhases: [],

  // 加载学习阶段
  loadLearningPhases: async (studentId) => {
    const phases = await learningPhaseDb.getByStudentId(studentId)
    set({ learningPhases: phases })
  },

  // 创建学习阶段
  createLearningPhase: async (data) => {
    const phase = await learningPhaseDb.create(data)
    await get().loadLearningPhases(data.student_id)
    return phase
  },

  // 更新学习阶段
  updateLearningPhase: async (id, data) => {
    const phase = await learningPhaseDb.update(id, data)
    if (phase && get().currentStudent?.id === phase.student_id) {
      await get().loadLearningPhases(phase.student_id)
    }
    return phase
  },

  // 删除学习阶段
  deleteLearningPhase: async (id) => {
    const phase = await learningPhaseDb.getById(id)
    if (phase) {
      await learningPhaseDb.delete(id)
      if (get().currentStudent?.id === phase.student_id) {
        await get().loadLearningPhases(phase.student_id)
      }
    }
  }
})