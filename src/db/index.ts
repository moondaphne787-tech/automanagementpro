// 数据库模块统一导出
// 重构说明：原单文件已拆分为多个模块文件，此文件仅做 re-export

// 工具函数
export { initDatabase, generateId, ipcQuery, ipcQueryOne } from './utils'

// 学员操作
export { studentDb } from './students'

// 课时操作
export { billingDb } from './billing'

// 词库操作
export { wordbankDb } from './wordbanks'

// 进度操作
export { progressDb } from './progress'

// 课堂记录操作
export { classRecordDb } from './classRecords'

// 课程计划操作
export { lessonPlanDb } from './lessonPlans'

// 体验生成交记录操作
export { trialConversionDb } from './trialConversions'

// 助教操作
export { teacherDb } from './teachers'

// 排课相关操作
export { teacherAvailabilityDb, studentSchedulePreferenceDb, scheduledClassDb } from './schedule'

// 排课时段配置
export { schedulePeriodDb } from './schedulePeriods'
export type { SchedulePeriod, SchedulePeriodCreate } from './schedulePeriods'

// 设置操作
export { settingsDb } from './settings'

// 朗读打卡操作
export { readingCheckinDb } from './readingCheckins'
export type { ReadingCheckinRow, MonthSummaryResult } from './readingCheckins'

// 任务类型预设模板操作
export { taskPresetDb } from './taskPresets'
export type { TaskPreset, TaskPresetCreate } from './taskPresets'

// 课程计划模板操作
export { planTemplateDb } from './planTemplates'
export type { PlanTemplate, PlanTemplateCreate } from './planTemplates'

// 成长档案备注操作
export { growthNoteDb } from './growthNotes'
export type { GrowthNote } from './growthNotes'

// 类型重导出（方便使用）
export type { 
  Student, 
  Billing, 
  Wordbank, 
  StudentWordbankProgress, 
  ClassRecord, 
  LessonPlan, 
  ExamScore,
  VocabTest,
  LearningPhase,
  TrialConversion, 
  Teacher, 
  TeacherAvailability, 
  StudentSchedulePreference, 
  ScheduledClass, 
  DayOfWeek 
} from '@/types'