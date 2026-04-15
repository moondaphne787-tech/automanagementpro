import type { StateCreator } from 'zustand'
import type { AppState, LessonPlanSlice } from './types'
import { lessonPlanDb, settingsDb, classRecordDb } from '@/db'
import { toast } from 'sonner'

export const createLessonPlanSlice: StateCreator<AppState, [], [], LessonPlanSlice> = (set, get) => ({
  lessonPlans: [],
  expiredPlans: [],
  recentRecords: [],
  aiConfig: null,
  lessonPlansLoading: false,

  loadLessonPlans: async (studentId) => {
    set({ lessonPlansLoading: true })
    try {
      const plans = await lessonPlanDb.getByStudentId(studentId)
      set({ lessonPlans: plans })
    } catch (e) {
      console.error('Failed to load lesson plans:', e)
      toast.error('加载课程计划失败')
    } finally {
      set({ lessonPlansLoading: false })
    }
  },

  loadExpiredPlans: async (studentId) => {
    try {
      const expired = await lessonPlanDb.getExpiredPlans(studentId)
      set({ expiredPlans: expired })
    } catch (e) {
      console.error('Failed to load expired plans:', e)
    }
  },

  loadRecentRecords: async (studentId, limit = 3) => {
    try {
      const records = await classRecordDb.getByStudentId(studentId, limit)
      set({ recentRecords: records })
    } catch (e) {
      console.error('Failed to load recent records:', e)
    }
  },

  loadAIConfig: async () => {
    try {
      const url = await settingsDb.get('ai_api_url')
      const key = await settingsDb.get('ai_api_key')
      const model = await settingsDb.get('ai_model')
      const temp = await settingsDb.get('ai_temperature')
      const tokens = await settingsDb.get('ai_max_tokens')

      if (key) {
        set({
          aiConfig: {
            api_url: url || 'https://api.deepseek.com/v1',
            api_key: key,
            model: model || 'deepseek-chat',
            temperature: parseFloat(temp || '0.7'),
            max_tokens: parseInt(tokens || '2048'),
          },
        })
      } else {
        set({ aiConfig: null })
      }
    } catch (e) {
      console.error('Failed to load AI config:', e)
    }
  },

  getLastPlanSummary: async (studentId) => {
    return lessonPlanDb.getLastPlanSummary(studentId)
  },

  createLessonPlan: async (data) => {
    try {
      const plan = await lessonPlanDb.create(data)
      await get().loadLessonPlans(data.student_id)
      await get().loadExpiredPlans(data.student_id)
      return plan
    } catch (e) {
      console.error('Failed to create lesson plan:', e)
      toast.error('创建课程计划失败')
      return undefined
    }
  },

  updateLessonPlan: async (id, data) => {
    try {
      const plan = await lessonPlanDb.update(id, data)
      if (plan && get().currentStudent?.id === plan.student_id) {
        await get().loadLessonPlans(plan.student_id)
        await get().loadExpiredPlans(plan.student_id)
      }
      return plan
    } catch (e) {
      console.error('Failed to update lesson plan:', e)
      toast.error('更新课程计划失败')
      return undefined
    }
  },

  deleteLessonPlan: async (id) => {
    try {
      const plan = await lessonPlanDb.getById(id)
      if (plan && plan.student_id) {
        await lessonPlanDb.delete(id)
        if (get().currentStudent?.id === plan.student_id) {
          await get().loadLessonPlans(plan.student_id)
          await get().loadExpiredPlans(plan.student_id)
        }
        await get().loadStudents()
      }
    } catch (e) {
      console.error('Failed to delete lesson plan:', e)
      toast.error('删除课程计划失败')
    }
  },
})
