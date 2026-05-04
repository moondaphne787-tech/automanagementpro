import { create } from 'zustand'
import type { AppState } from './types'
import { createStudentSlice } from './studentSlice'
import { createWordbankSlice } from './wordbankSlice'
import { createClassRecordSlice } from './classRecordSlice'
import { createLessonPlanSlice } from './lessonPlanSlice'
import { createSemesterConfigSlice } from './semesterConfigSlice'
import { createUISlice } from './uiSlice'
import { createDashboardSlice } from './dashboardSlice'

// 组合所有 slices 创建统一的 store
// 注意：readingCheckinSlice 已拆分为独立的 useReadingCheckinStore，
// 避免频繁打卡状态变更触发其他 slice 的 selector 重新计算
export const useAppStore = create<AppState>()(
  (...a) => ({
    ...createStudentSlice(...a),
    ...createWordbankSlice(...a),
    ...createClassRecordSlice(...a),
    ...createLessonPlanSlice(...a),
    ...createSemesterConfigSlice(...a),
    ...createUISlice(...a),
    ...createDashboardSlice(...a),
  })
)

// 导出类型供外部使用
export type { AppState } from './types'
// 导出独立的 readingCheckin store 供外部使用
export { useReadingCheckinStore } from './readingCheckinStore'
