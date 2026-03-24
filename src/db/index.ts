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

// 考试成绩操作
export { examScoreDb } from './examScores'

// 学习阶段操作
export { learningPhaseDb } from './phases'

// 体验生成交记录操作
export { trialConversionDb } from './trialConversions'

// 助教操作
export { teacherDb } from './teachers'

// 排课相关操作
export { teacherAvailabilityDb, studentSchedulePreferenceDb, scheduledClassDb } from './schedule'

// 设置操作
export { settingsDb } from './settings'

// 类型重导出（方便使用）
export type { 
  Student, 
  Billing, 
  Wordbank, 
  StudentWordbankProgress, 
  ClassRecord, 
  LessonPlan, 
  ExamScore, 
  LearningPhase, 
  TrialConversion, 
  Teacher, 
  TeacherAvailability, 
  StudentSchedulePreference, 
  ScheduledClass, 
  DayOfWeek 
} from '@/types'