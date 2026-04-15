import type { StateCreator } from 'zustand'
import type { AppState, LearningPhaseSlice } from './types'
import { learningPhaseDb } from '@/db'
import { toast } from 'sonner'

export const createLearningPhaseSlice: StateCreator<AppState, [], [], LearningPhaseSlice> = (set, get) => ({
  learningPhases: [],
  learningPhasesLoading: false,

  loadLearningPhases: async (studentId) => {
    set({ learningPhasesLoading: true })
    try {
      const phases = await learningPhaseDb.getByStudentId(studentId)
      set({ learningPhases: phases })
    } catch (e) {
      console.error('Failed to load learning phases:', e)
      toast.error('加载学习阶段失败')
    } finally {
      set({ learningPhasesLoading: false })
    }
  },

  createLearningPhase: async (data) => {
    try {
      const phase = await learningPhaseDb.create(data)
      await get().loadLearningPhases(data.student_id)
      return phase
    } catch (e) {
      console.error('Failed to create learning phase:', e)
      toast.error('创建学习阶段失败')
      return undefined
    }
  },

  updateLearningPhase: async (id, data) => {
    try {
      const phase = await learningPhaseDb.update(id, data)
      if (phase && get().currentStudent?.id === phase.student_id) {
        await get().loadLearningPhases(phase.student_id)
      }
      return phase
    } catch (e) {
      console.error('Failed to update learning phase:', e)
      toast.error('更新学习阶段失败')
      return undefined
    }
  },

  deleteLearningPhase: async (id) => {
    try {
      const phase = await learningPhaseDb.getById(id)
      if (phase) {
        await learningPhaseDb.delete(id)
        if (get().currentStudent?.id === phase.student_id) {
          await get().loadLearningPhases(phase.student_id)
        }
      }
    } catch (e) {
      console.error('Failed to delete learning phase:', e)
      toast.error('删除学习阶段失败')
    }
  }
})
