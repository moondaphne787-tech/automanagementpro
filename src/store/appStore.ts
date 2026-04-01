import { create } from 'zustand'
import type { AppState } from './types'
import { createStudentSlice } from './studentSlice'
import { createWordbankSlice } from './wordbankSlice'
import { createClassRecordSlice } from './classRecordSlice'
import { createLessonPlanSlice } from './lessonPlanSlice'
import { createExamScoreSlice } from './examScoreSlice'
import { createLearningPhaseSlice } from './learningPhaseSlice'
import { createSemesterConfigSlice } from './semesterConfigSlice'
import { createUISlice } from './uiSlice'
import { createDashboardSlice } from './dashboardSlice'

// 组合所有 slices 创建统一的 store
export const useAppStore = create<AppState>()(
  (...a) => ({
    ...createStudentSlice(...a),
    ...createWordbankSlice(...a),
    ...createClassRecordSlice(...a),
    ...createLessonPlanSlice(...a),
    ...createExamScoreSlice(...a),
    ...createLearningPhaseSlice(...a),
    ...createSemesterConfigSlice(...a),
    ...createUISlice(...a),
    ...createDashboardSlice(...a),
  })
)

// 导出类型供外部使用
export type { AppState } from './types'