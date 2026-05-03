import type { StateCreator } from 'zustand'
import type { AppState, UISlice } from './types'

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

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  sidebarCollapsed: getInitialSidebarCollapsed(),
  theme: getInitialTheme(),
  recentStudents: getInitialRecentStudents(),

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
})
