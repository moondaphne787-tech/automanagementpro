// Store 类型定义
import type {
  Student,
  StudentWithBilling,
  Billing,
  Wordbank,
  StudentWordbankProgress,
  ClassRecord,
  LessonPlan,
  ExamScore,
  VocabTest,
  LearningPhase,
  FilterOptions,
  SortOptions,
  TaskBlock,
  DashboardData,
  AIConfig
} from '@/types'

// ===== 学员 Slice 类型 =====
export interface StudentSlice {
  students: StudentWithBilling[]
  studentsLoading: boolean
  filters: FilterOptions
  sort: SortOptions
  currentStudent: Student | null
  currentBilling: Billing | null
  currentProgress: StudentWordbankProgress[]
  expiredPlansMap: Map<string, number>
  expiredPlansLoading: boolean
  scheduleInfoMap: Map<string, { nextClassDate: string | null; hasThisWeekClass: boolean }>
  scheduleInfoLoading: boolean
  
  loadStudents: () => Promise<void>
  loadExpiredPlansCount: () => Promise<void>
  loadScheduleInfo: () => Promise<void>
  setFilters: (filters: Partial<FilterOptions>) => void
  setSort: (sort: SortOptions) => void
  createStudent: (student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => Promise<Student>
  updateStudent: (id: string, data: Partial<Student>) => Promise<Student | undefined>
  deleteStudent: (id: string) => Promise<void>
  selectStudent: (id: string | null) => Promise<void>
  updateBilling: (studentId: string, data: Partial<Billing>) => Promise<Billing | undefined>
  addHours: (studentId: string, hours: number) => Promise<Billing | undefined>
  loadProgress: (studentId: string) => Promise<void>
  upsertProgress: (data: {
    student_id: string
    wordbank_id: string
    current_level: number
    total_levels_override?: number
    status?: 'active' | 'completed' | 'paused'
    notes?: string
  }) => Promise<void>
  deleteProgress: (studentId: string, wordbankId: string) => Promise<void>
}

// ===== 词库 Slice 类型 =====
export interface WordbankSlice {
  wordbanks: Wordbank[]
  loadWordbanks: () => Promise<void>
  createWordbank: (wordbank: Omit<Wordbank, 'id'>) => Promise<Wordbank>
  upsertWordbank: (wordbank: Omit<Wordbank, 'id'>) => Promise<Wordbank>
  updateWordbank: (id: string, data: Partial<Wordbank>) => Promise<Wordbank | undefined>
  deleteWordbank: (id: string) => Promise<void>
}

// ===== 课堂记录 Slice 类型 =====
export interface ClassRecordSlice {
  classRecords: ClassRecord[]
  classRecordsLoading: boolean
  loadClassRecords: (studentId: string) => Promise<void>
  createClassRecord: (data: {
    student_id: string
    class_date: string
    duration_hours?: number
    teacher_name?: string
    attendance?: 'present' | 'absent' | 'late'
    tasks: TaskBlock[]
    task_completed?: 'completed' | 'partial' | 'not_completed'
    incomplete_reason?: string
    performance?: 'excellent' | 'good' | 'needs_improvement'
    detail_feedback?: string
    highlights?: string
    issues?: string
    checkin_completed?: boolean
    phase_id?: string
    imported_from_excel?: boolean
  }) => Promise<ClassRecord | undefined>
  updateClassRecord: (id: string, data: Partial<ClassRecord>) => Promise<ClassRecord | undefined>
  deleteClassRecord: (id: string) => Promise<void>
  batchImportClassRecords: (records: Array<{
    student_id: string
    class_date: string
    duration_hours?: number
    teacher_name?: string
    attendance?: 'present' | 'absent' | 'late'
    tasks: TaskBlock[]
    task_completed?: 'completed' | 'partial' | 'not_completed'
    incomplete_reason?: string
    performance?: 'excellent' | 'good' | 'needs_improvement'
    detail_feedback?: string
    highlights?: string
    issues?: string
    checkin_completed?: boolean
    phase_id?: string
    imported_from_excel?: boolean
  }>) => Promise<number>
}

// ===== 课程计划 Slice 类型 =====
export interface LessonPlanSlice {
  lessonPlans: LessonPlan[]
  expiredPlans: LessonPlan[]
  recentRecords: ClassRecord[]
  aiConfig: AIConfig | null
  lessonPlansLoading: boolean
  loadLessonPlans: (studentId: string) => Promise<void>
  loadExpiredPlans: (studentId: string) => Promise<void>
  loadRecentRecords: (studentId: string, limit?: number) => Promise<void>
  loadAIConfig: () => Promise<void>
  getLastPlanSummary: (studentId: string) => Promise<string | null>
  createLessonPlan: (data: {
    student_id: string
    phase_id?: string
    plan_date?: string
    tasks: TaskBlock[]
    notes?: string
    ai_reason?: string
    generated_by_ai?: boolean
  }) => Promise<LessonPlan | undefined>
  updateLessonPlan: (id: string, data: Partial<LessonPlan>) => Promise<LessonPlan | undefined>
  deleteLessonPlan: (id: string) => Promise<void>
}

// ===== 考试成绩 Slice 类型 =====
export interface ExamScoreSlice {
  examScores: ExamScore[]
  examScoresLoading: boolean
  loadExamScores: (studentId: string) => Promise<void>
  createExamScore: (data: {
    student_id: string
    exam_date: string
    exam_name?: string
    exam_type?: 'school_exam' | 'placement' | 'mock'
    score?: number
    full_score?: number
    notes?: string
  }) => Promise<ExamScore | undefined>
  updateExamScore: (id: string, data: Partial<ExamScore>) => Promise<ExamScore | undefined>
  deleteExamScore: (id: string) => Promise<void>
}

// ===== 词汇量测试 Slice 类型 =====
export interface VocabTestSlice {
  vocabTests: VocabTest[]
  vocabTestsLoading: boolean
  loadVocabTests: (studentId: string) => Promise<void>
  createVocabTest: (data: {
    student_id: string
    test_date: string
    vocab_count: number
    test_source?: string
    notes?: string
  }) => Promise<VocabTest | undefined>
  updateVocabTest: (id: string, data: Partial<VocabTest>) => Promise<VocabTest | undefined>
  deleteVocabTest: (id: string) => Promise<void>
}

// ===== 学习阶段 Slice 类型 =====
export interface LearningPhaseSlice {
  learningPhases: LearningPhase[]
  learningPhasesLoading: boolean
  loadLearningPhases: (studentId: string) => Promise<void>
  createLearningPhase: (data: {
    student_id: string
    phase_name?: string
    phase_type?: 'semester' | 'summer' | 'winter'
    start_date?: string
    end_date?: string
    goal?: string
    vocab_start?: number
    vocab_end?: number
    summary?: string
  }) => Promise<LearningPhase | undefined>
  updateLearningPhase: (id: string, data: Partial<LearningPhase>) => Promise<LearningPhase | undefined>
  deleteLearningPhase: (id: string) => Promise<void>
}

// ===== 学期配置 Slice 类型 =====
export interface SemesterConfigSlice {
  semesterConfig: {
    spring_start: string
    spring_end: string
    summer_start: string
    summer_end: string
    autumn_start: string
    autumn_end: string
    winter_start: string
    winter_end: string
  } | null
  loadSemesterConfig: () => Promise<void>
}

// ===== Dashboard 配置 =====
export interface DashboardConfig {
  left: string[]
  right: string[]
  hidden: string[]
}

// ===== UI Slice 类型 =====
export interface UISlice {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  recentStudents: Array<{ id: string; name: string }>
  dashboardConfig: DashboardConfig
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
  addRecentStudent: (id: string, name: string) => void
  setDashboardConfig: (config: DashboardConfig) => void
  resetDashboardConfig: () => void
  // Dashboard→批量生成计划联动
  generateDrawerOpen: boolean
  generateDrawerPreselectedIds: string[]
  openGenerateDrawer: (preselectedIds?: string[]) => void
  closeGenerateDrawer: () => void
}

// ===== Dashboard 缓存 Slice 类型 =====
export interface DashboardSlice {
  dashboardData: DashboardData | null
  dashboardLoadedAt: number | null
  dashboardDateKey: string | null
  setDashboardCache: (data: DashboardData, dateKey: string) => void
  clearDashboardCache: () => void
  isDashboardCacheValid: (staleTime: number) => boolean
}

// ===== 朗读打卡行数据类型 =====
export interface CheckinStudent {
  id: string
  studentNo: string | null
  name: string
  monthlyCount: number
  checkedYesterday: boolean
  fullAttendance: boolean
  daysInMonth: number
}

// ===== 每日打卡统计项 =====
export interface DailyCheckinCount {
  date: string
  count: number
}

// ===== 朗读打卡 Slice 类型 =====
export interface ReadingCheckinSlice {
  // 状态
  selectedYear: number
  selectedMonth: number
  checkinStudents: CheckinStudent[]
  totalStudents: number
  yesterdayCheckedCount: number
  yesterdayDate: string
  todayDate: string
  checkinLoading: boolean

  // 目标日期（点击日历切换，默认为昨日）
  targetDate: string

  // 每日打卡人数统计
  dailyCheckinCounts: DailyCheckinCount[]
  showDailyView: boolean

  // 搜索和过滤
  searchQuery: string
  showOnlyUnchecked: boolean

  // 批量选择
  selectedStudentIds: Set<string>

  // 操作
  setSelectedMonth: (year: number, month: number) => void
  setTargetDate: (date: string) => void
  resetTargetDate: () => void
  fetchMonthSummary: () => Promise<void>
  fetchDailyCheckinCounts: () => Promise<void>
  toggleDailyView: () => void
  checkYesterday: (studentId: string, studentName: string) => Promise<void>
  uncheckYesterday: (studentId: string, studentName: string) => Promise<void>
  batchCheckYesterday: () => Promise<void>
  toggleSelectStudent: (studentId: string) => void
  selectAllUnchecked: (filteredIds: string[]) => void
  clearSelection: () => void
  setSearchQuery: (query: string) => void
  toggleShowOnlyUnchecked: () => void
}

// ===== 批量生成 Slice 类型 =====
export interface GenerationTask {
  studentId: string
  studentName: string
  status: 'pending' | 'generating' | 'success' | 'failed' | 'saved' | 'skipped'
  plan?: { tasks: TaskBlock[]; notes: string; reason: string }
  error?: string
  extraNote?: string
}

export interface GenerationSlice {
  generationTasks: GenerationTask[]
  generationRunning: boolean
  generationPaused: boolean
  generationProgress: { done: number; total: number }
  startGeneration: (tasks: GenerationTask[], extraInstruction?: string) => Promise<void>
  pauseGeneration: () => void
  resumeGeneration: () => void
  cancelGeneration: () => void
  updateGenerationTask: (studentId: string, updates: Partial<GenerationTask>) => void
  clearGenerationResults: () => void
}

// ===== 完整 AppState 类型 =====
// 注意：ReadingCheckinSlice 已拆分为独立的 useReadingCheckinStore
export type AppState = StudentSlice &
  WordbankSlice &
  ClassRecordSlice &
  LessonPlanSlice &
  ExamScoreSlice &
  VocabTestSlice &
  LearningPhaseSlice &
  SemesterConfigSlice &
  UISlice &
  DashboardSlice &
  GenerationSlice
