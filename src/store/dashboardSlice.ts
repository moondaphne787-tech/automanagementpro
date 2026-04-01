import type { StateCreator } from 'zustand'
import type { AppState, DashboardSlice } from './types'

export const createDashboardSlice: StateCreator<AppState, [], [], DashboardSlice> = (set, get) => ({
  // 初始状态
  dashboardData: null,
  dashboardLoadedAt: null,
  dashboardDateKey: null,

  // 设置 Dashboard 缓存
  setDashboardCache: (data, dateKey) => {
    set({
      dashboardData: data,
      dashboardLoadedAt: Date.now(),
      dashboardDateKey: dateKey
    })
  },

  // 清除 Dashboard 缓存
  clearDashboardCache: () => {
    set({
      dashboardData: null,
      dashboardLoadedAt: null,
      dashboardDateKey: null
    })
  },

  // 检查 Dashboard 缓存是否有效
  isDashboardCacheValid: (staleTime) => {
    const state = get()
    if (!state.dashboardData || !state.dashboardLoadedAt || !state.dashboardDateKey) {
      return false
    }
    
    // 格式化本地日期为 YYYY-MM-DD 格式
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    
    // 如果日期变化（跨天），缓存失效
    if (state.dashboardDateKey !== today) return false
    
    // 如果超过新鲜时间，缓存失效
    if (Date.now() - state.dashboardLoadedAt > staleTime) return false
    
    return true
  }
})