import type { StateCreator } from 'zustand'
import type { AppState, SemesterConfigSlice } from './types'
import { settingsDb } from '@/db'

export const createSemesterConfigSlice: StateCreator<AppState, [], [], SemesterConfigSlice> = (set) => ({
  // 初始状态
  semesterConfig: null,

  // 加载学期配置
  loadSemesterConfig: async () => {
    const keys = ['spring_start', 'spring_end', 'summer_start', 'summer_end', 
                   'autumn_start', 'autumn_end', 'winter_start', 'winter_end']
    const values = await Promise.all(keys.map(k => settingsDb.get(`semester_${k}`)))
    set({
      semesterConfig: {
        spring_start: values[0] || '',
        spring_end: values[1] || '',
        summer_start: values[2] || '',
        summer_end: values[3] || '',
        autumn_start: values[4] || '',
        autumn_end: values[5] || '',
        winter_start: values[6] || '',
        winter_end: values[7] || '',
      }
    })
  }
})