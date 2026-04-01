import type { StateCreator } from 'zustand'
import type { AppState, LessonPlanSlice } from './types'
import { lessonPlanDb } from '@/db'

export const createLessonPlanSlice: StateCreator<AppState, [], [], LessonPlanSlice> = (set, get) => ({
  // 初始状态
  lessonPlans: [],

  // 加载课程计划
  loadLessonPlans: async (studentId) => {
    const plans = await lessonPlanDb.getByStudentId(studentId)
    set({ lessonPlans: plans })
  },

  // 创建课程计划
  createLessonPlan: async (data) => {
    const plan = await lessonPlanDb.create(data)
    await get().loadLessonPlans(data.student_id)
    return plan
  },

  // 更新课程计划
  updateLessonPlan: async (id, data) => {
    const plan = await lessonPlanDb.update(id, data)
    if (plan && get().currentStudent?.id === plan.student_id) {
      await get().loadLessonPlans(plan.student_id)
    }
    return plan
  },

  // 删除课程计划
  deleteLessonPlan: async (id) => {
    const plan = await lessonPlanDb.getById(id)
    if (plan && plan.student_id) {
      await lessonPlanDb.delete(id)
      if (get().currentStudent?.id === plan.student_id) {
        await get().loadLessonPlans(plan.student_id)
      }
      // 刷新过期计划数量
      await get().loadStudents()
    }
  }
})