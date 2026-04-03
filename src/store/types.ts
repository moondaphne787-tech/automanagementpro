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
  LearningPhase,
  FilterOptions,
  SortOptions,
  TaskBlock,
  DashboardData
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
  
  loadStudents: () => Promise<void>
  loadExpiredPlansCount: () => Promise<void>
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
    last_nine_grid_level?: number
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
  loadLessonPlans: (studentId: string) => Promise<void>
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

// ===== 学习阶段 Slice 类型 =====
export interface LearningPhaseSlice {
  learningPhases: LearningPhase[]
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

// ===== UI Slice 类型 =====
export interface UISlice {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
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
  name: string
  monthlyCount: number
  checkedYesterday: boolean
}

// ===== 朗读打卡 Slice 类型 =====
export interface ReadingCheckinSlice {
  // 状态
  selectedYear: number
  selectedMonth: number
  checkinStudents: CheckinStudent[]
  totalStudents: number
  yesterdayCheckedCount: number  // 改为昨日打卡数
  yesterdayDate: string  // 昨日日期
  todayDate: string  // 今日日期（用于显示）
  checkinLoading: boolean
  
  // 搜索和过滤
  searchQuery: string
  showOnlyUnchecked: boolean
  
  // 批量选择
  selectedStudentIds: Set<string>
  
  // 操作
  setSelectedMonth: (year: number, month: number) => void
  fetchMonthSummary: () => Promise<void>
  checkYesterday: (studentId: string, studentName: string) => Promise<void>
  uncheckYesterday: (studentId: string, studentName: string) => Promise<void>
  batchCheckYesterday: () => Promise<void>
  toggleSelectStudent: (studentId: string) => void
  selectAllUnchecked: (filteredIds: string[]) => void
  clearSelection: () => void
  setSearchQuery: (query: string) => void
  toggleShowOnlyUnchecked: () => void
}

// ===== 完整 AppState 类型 =====
// 注意：ReadingCheckinSlice 已拆分为独立的 useReadingCheckinStore
export type AppState = StudentSlice & 
  WordbankSlice & 
  ClassRecordSlice & 
  LessonPlanSlice & 
  ExamScoreSlice & 
  LearningPhaseSlice & 
  SemesterConfigSlice &
  UISlice & 
  DashboardSlice
