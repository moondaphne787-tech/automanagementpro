import type { StateCreator } from 'zustand'
import type { AppState, UISlice } from './types'

// 从 localStorage 读取初始状态
const getInitialSidebarCollapsed = (): boolean => {
  try {
    const stored = localStorage.getItem('sidebarCollapsed')
    return stored === 'true'
  } catch {
    return false
  }
}

const getInitialTheme = (): 'light' | 'dark' => {
  try {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
    return stored || 'light'
  } catch {
    return 'light'
  }
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  // 初始状态（从 localStorage 恢复）
  sidebarCollapsed: getInitialSidebarCollapsed(),
  theme: getInitialTheme(),

  // 切换侧边栏
  toggleSidebar: () => {
    set(state => {
      const newCollapsed = !state.sidebarCollapsed
      // 持久化到 localStorage
      try {
        localStorage.setItem('sidebarCollapsed', String(newCollapsed))
      } catch (e) {
        console.error('Failed to save sidebar state:', e)
      }
      return { sidebarCollapsed: newCollapsed }
    })
  },

  // 设置主题
  setTheme: (theme) => {
    set({ theme })
    // 持久化到 localStorage
    try {
      localStorage.setItem('theme', theme)
    } catch (e) {
      console.error('Failed to save theme:', e)
    }
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
})
