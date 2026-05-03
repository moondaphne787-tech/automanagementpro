import type { StateCreator } from 'zustand'
import type { AppState, PlanningSlice } from './types'
import type { StudentPlan, Milestone, PlanStatus } from '@/types'

function getApi() {
  return (window as any).electronAPI
}

function hasPlanApi(): boolean {
  const api = getApi()
  return typeof api?.planGet === 'function'
}

export const createPlanningSlice: StateCreator<AppState, [], [], PlanningSlice> = (set, get) => ({
  plan: null,
  milestones: [],
  planStatus: null,
  planStatusDate: null,
  planLoading: false,
  milestonesLoading: false,

  loadPlanningData: async (studentId) => {
    if (!hasPlanApi()) return
    const api = getApi()
    set({ planLoading: true, milestonesLoading: true })
    try {
      const [plan, ms] = await Promise.all([
        api.planGet(studentId),
        api.milestoneList(studentId),
      ])
      set({ plan, milestones: ms })
    } catch (e) {
      console.error('Failed to load planning data:', e)
    } finally {
      set({ planLoading: false, milestonesLoading: false })
    }

    try {
      const rows = await api.dbQuery(
        `SELECT plan_date, plan_status_json FROM lesson_plans WHERE student_id = ? AND plan_status_json IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
        [studentId]
      ) as Array<{ plan_date: string | null; plan_status_json: string }>
      if (rows.length > 0) {
        set({
          planStatus: JSON.parse(rows[0].plan_status_json) as PlanStatus,
          planStatusDate: rows[0].plan_date,
        })
      }
    } catch (e) {
      console.error(e)
    }
  },

  savePlan: async (data) => {
    const api = getApi()
    if (!api?.planSave) return false
    try {
      await api.planSave(data)
      return true
    } catch (e) {
      console.error('Failed to save plan:', e)
      return false
    }
  },

  addMilestone: async (data) => {
    const api = getApi()
    if (!api?.milestoneAdd) return false
    try {
      await api.milestoneAdd(data)
      return true
    } catch (e) {
      console.error('Failed to add milestone:', e)
      return false
    }
  },

  updateMilestone: async (id, data) => {
    const api = getApi()
    if (!api?.milestoneUpdate) return false
    try {
      await api.milestoneUpdate({ id, ...data })
      return true
    } catch (e) {
      console.error('Failed to update milestone:', e)
      return false
    }
  },

  deleteMilestone: async (id) => {
    const api = getApi()
    if (!api?.milestoneDelete) return
    try {
      await api.milestoneDelete(id)
    } catch (e) {
      console.error('Failed to delete milestone:', e)
    }
  },

  reorderMilestones: async (milestones) => {
    const ids = milestones.map(m => m.id)
    // Optimistically update the store
    set({ milestones })
    const api = getApi()
    if (!api?.milestoneReorder) return
    try {
      await api.milestoneReorder(ids)
    } catch (e) {
      console.error('Failed to reorder milestones:', e)
      // Rollback on failure
      if (milestones[0]?.studentId) {
        await get().loadPlanningData(milestones[0].studentId)
      }
    }
  },
})
