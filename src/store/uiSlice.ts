import type { StateCreator } from 'zustand'
import type { AppState, UISlice, DashboardConfig } from './types'

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  left: ['todaySchedule', 'weeklyPlan', 'alertStudents'],
  right: ['todo', 'weeklySummary', 'studentOverview'],
  hidden: []
}

// 从 localStorage 读取初始状态
const getInitialSidebarCollapsed = (): boolean => {
  try {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  } catch { return false }
}

const getInitialTheme = (): 'light' | 'dark' => {
  try {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  } catch { return 'light' }
}

const getInitialRecentStudents = (): Array<{ id: string; name: string }> => {
  try {
    const stored = localStorage.getItem('recentStudents')
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

const getInitialDashboardConfig = (): DashboardConfig => {
  try {
    const stored = localStorage.getItem('dashboardConfig')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.left && parsed.right) return parsed
    }
  } catch {}
  return DEFAULT_DASHBOARD_CONFIG
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  sidebarCollapsed: getInitialSidebarCollapsed(),
  theme: getInitialTheme(),
  recentStudents: getInitialRecentStudents(),
  dashboardConfig: getInitialDashboardConfig(),

  toggleSidebar: () => {
    set(state => {
      const newCollapsed = !state.sidebarCollapsed
      try { localStorage.setItem('sidebarCollapsed', String(newCollapsed)) } catch {}
      return { sidebarCollapsed: newCollapsed }
    })
  },

  setTheme: (theme) => {
    set({ theme })
    try { localStorage.setItem('theme', theme) } catch {}
    document.documentElement.classList.toggle('dark', theme === 'dark')
  },

  addRecentStudent: (id, name) => {
    set(state => {
      const filtered = state.recentStudents.filter(s => s.id !== id)
      const updated = [{ id, name }, ...filtered].slice(0, 5)
      try { localStorage.setItem('recentStudents', JSON.stringify(updated)) } catch {}
      return { recentStudents: updated }
    })
  },

  setDashboardConfig: (config) => {
    set({ dashboardConfig: config })
    try { localStorage.setItem('dashboardConfig', JSON.stringify(config)) } catch {}
  },

  resetDashboardConfig: () => {
    set({ dashboardConfig: DEFAULT_DASHBOARD_CONFIG })
    try { localStorage.setItem('dashboardConfig', JSON.stringify(DEFAULT_DASHBOARD_CONFIG)) } catch {}
  },
})
