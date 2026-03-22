import { create } from 'zustand'
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
  LevelType,
  StudentStatus,
  StudentType,
  TaskBlock
} from '@/types'
import { studentDb, billingDb, wordbankDb, progressDb, classRecordDb, lessonPlanDb, examScoreDb, learningPhaseDb, trialConversionDb } from '@/db'

interface AppState {
  // 学员列表
  students: StudentWithBilling[]
  studentsLoading: boolean
  filters: FilterOptions
  sort: SortOptions
  
  // 当前选中的学员
  currentStudent: Student | null
  currentBilling: Billing | null
  currentProgress: StudentWordbankProgress[]
  
  // 词库配置
  wordbanks: Wordbank[]
  
  // UI状态
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  
  // 操作方法
  loadStudents: () => Promise<void>
  setFilters: (filters: Partial<FilterOptions>) => void
  setSort: (sort: SortOptions) => void
  createStudent: (student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => Promise<Student>
  updateStudent: (id: string, data: Partial<Student>) => Promise<Student | undefined>
  deleteStudent: (id: string) => Promise<void>
  selectStudent: (id: string | null) => Promise<void>
  
  // 课时操作
  updateBilling: (studentId: string, data: Partial<Billing>) => Promise<Billing | undefined>
  addHours: (studentId: string, hours: number) => Promise<Billing | undefined>
  
  // 词库操作
  loadWordbanks: () => Promise<void>
  createWordbank: (wordbank: Omit<Wordbank, 'id'>) => Promise<Wordbank>
  updateWordbank: (id: string, data: Partial<Wordbank>) => Promise<Wordbank | undefined>
  deleteWordbank: (id: string) => Promise<void>
  
  // 进度操作
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
  
  // 课堂记录操作
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
  
  // 课程计划操作
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
  
  // 考试成绩操作
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
  
  // 学习阶段操作
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
  
  // UI操作
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  students: [],
  studentsLoading: false,
  filters: {
    status: 'all',
    student_type: 'all',
    level: 'all',
    grade: 'all',
    search: ''
  },
  sort: {
    field: 'student_no',
    direction: 'asc'
  },
  currentStudent: null,
  currentBilling: null,
  currentProgress: [],
  wordbanks: [],
  sidebarCollapsed: false,
  theme: 'light',
  classRecords: [],
  lessonPlans: [],
  examScores: [],
  learningPhases: [],
  
  // 加载学员列表
  loadStudents: async () => {
    set({ studentsLoading: true })
    try {
      const { filters, sort } = get()
      const students = await studentDb.getAllWithBilling(filters, sort)
      set({ students, studentsLoading: false })
    } catch (error) {
      console.error('Failed to load students:', error)
      set({ studentsLoading: false })
    }
  },
  
  // 设置筛选条件
  setFilters: (filters) => {
    set(state => ({
      filters: { ...state.filters, ...filters }
    }))
    get().loadStudents()
  },
  
  // 设置排序
  setSort: (sort) => {
    set({ sort })
    get().loadStudents()
  },
  
  // 创建学员
  createStudent: async (studentData) => {
    const student = await studentDb.create(studentData)
    
    // 如果是体验生，自动创建trial_conversion记录
    if (studentData.student_type === 'trial') {
      await trialConversionDb.create({
        student_id: student.id,
        trial_date: studentData.enroll_date || new Date().toISOString().split('T')[0],
        converted: false
      })
    }
    
    await get().loadStudents()
    return student
  },
  
  // 更新学员
  updateStudent: async (id, data) => {
    const student = await studentDb.update(id, data)
    await get().loadStudents()
    if (get().currentStudent?.id === id) {
      set({ currentStudent: student ?? null })
    }
    return student
  },
  
  // 删除学员
  deleteStudent: async (id) => {
    await studentDb.delete(id)
    await get().loadStudents()
    if (get().currentStudent?.id === id) {
      set({ currentStudent: null, currentBilling: null, currentProgress: [] })
    }
  },
  
  // 选中学员
  selectStudent: async (id) => {
    if (!id) {
      set({ currentStudent: null, currentBilling: null, currentProgress: [] })
      return
    }
    const student = await studentDb.getById(id)
    const billing = await billingDb.getByStudentId(id)
    const progress = await progressDb.getByStudentId(id)
    set({ 
      currentStudent: student ?? null, 
      currentBilling: billing ?? null,
      currentProgress: progress
    })
  },
  
  // 更新课时
  updateBilling: async (studentId, data) => {
    const billing = await billingDb.update(studentId, data)
    await get().loadStudents()
    if (get().currentStudent?.id === studentId) {
      set({ currentBilling: billing ?? null })
    }
    return billing
  },
  
  // 增加课时
  addHours: async (studentId, hours) => {
    const billing = await billingDb.addHours(studentId, hours)
    await get().loadStudents()
    if (get().currentStudent?.id === studentId) {
      set({ currentBilling: billing ?? null })
    }
    return billing
  },
  
  // 加载词库配置
  loadWordbanks: async () => {
    const wordbanks = await wordbankDb.getAll()
    set({ wordbanks })
  },
  
  // 创建词库
  createWordbank: async (wordbank) => {
    const newWordbank = await wordbankDb.create(wordbank)
    await get().loadWordbanks()
    return newWordbank
  },
  
  // 更新词库
  updateWordbank: async (id, data) => {
    const wordbank = await wordbankDb.update(id, data)
    await get().loadWordbanks()
    return wordbank
  },
  
  // 删除词库
  deleteWordbank: async (id) => {
    await wordbankDb.delete(id)
    await get().loadWordbanks()
  },
  
  // 加载进度
  loadProgress: async (studentId) => {
    const progress = await progressDb.getByStudentId(studentId)
    set({ currentProgress: progress })
  },
  
  // 更新进度
  upsertProgress: async (data) => {
    await progressDb.upsert(data)
    await get().loadProgress(data.student_id)
  },
  
  // 删除进度
  deleteProgress: async (studentId, wordbankId) => {
    await progressDb.delete(studentId, wordbankId)
    await get().loadProgress(studentId)
  },
  
  // 加载课堂记录
  loadClassRecords: async (studentId) => {
    const records = await classRecordDb.getByStudentId(studentId)
    set({ classRecords: records })
  },
  
  // 创建课堂记录
  createClassRecord: async (data) => {
    const record = await classRecordDb.create(data)
    
    // 更新课时（扣减）
    const billing = await billingDb.getByStudentId(data.student_id)
    if (billing && data.duration_hours) {
      await billingDb.update(data.student_id, {
        used_hours: billing.used_hours + data.duration_hours
      })
    }
    
    // 同步词库进度
    for (const task of data.tasks) {
      if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
          task.wordbank_label && task.level_reached) {
        // 查找对应的词库
        const wordbanks = await wordbankDb.getAll()
        const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
        if (wordbank) {
          const existingProgress = await progressDb.getByStudentId(data.student_id)
          const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
          
          // 只有新关数大于当前关数才更新
          if (!currentProgress || task.level_reached > currentProgress.current_level) {
            await progressDb.upsert({
              student_id: data.student_id,
              wordbank_id: wordbank.id,
              current_level: task.level_reached
            })
          }
        }
      }
    }
    
    // 刷新数据
    await get().loadClassRecords(data.student_id)
    if (get().currentStudent?.id === data.student_id) {
      const billing = await billingDb.getByStudentId(data.student_id)
      set({ currentBilling: billing ?? null })
      await get().loadProgress(data.student_id)
    }
    await get().loadStudents()
    
    return record
  },
  
  // 更新课堂记录
  updateClassRecord: async (id, data) => {
    const record = await classRecordDb.update(id, data)
    if (record && get().currentStudent?.id === record.student_id) {
      await get().loadClassRecords(record.student_id)
    }
    return record
  },
  
  // 删除课堂记录
  deleteClassRecord: async (id) => {
    const record = await classRecordDb.getById(id)
    if (record) {
      await classRecordDb.delete(id)
      if (get().currentStudent?.id === record.student_id) {
        await get().loadClassRecords(record.student_id)
      }
    }
  },
  
  // 批量导入课堂记录
  batchImportClassRecords: async (records) => {
    const count = await classRecordDb.batchCreate(records)
    
    // 更新课时（扣减）- 按学员汇总课时
    const studentHoursMap = new Map<string, number>()
    for (const record of records) {
      if (record.duration_hours && record.student_id) {
        const current = studentHoursMap.get(record.student_id) || 0
        studentHoursMap.set(record.student_id, current + record.duration_hours)
      }
    }
    
    // 批量更新每个学员的课时
    for (const [studentId, hours] of studentHoursMap) {
      const billing = await billingDb.getByStudentId(studentId)
      if (billing) {
        await billingDb.update(studentId, {
          used_hours: billing.used_hours + hours
        })
      }
    }
    
    // 同步词库进度
    for (const record of records) {
      for (const task of record.tasks) {
        if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
            task.wordbank_label && task.level_reached) {
          const wordbanks = await wordbankDb.getAll()
          const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
          if (wordbank) {
            const existingProgress = await progressDb.getByStudentId(record.student_id)
            const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
            
            if (!currentProgress || task.level_reached > currentProgress.current_level) {
              await progressDb.upsert({
                student_id: record.student_id,
                wordbank_id: wordbank.id,
                current_level: task.level_reached
              })
            }
          }
        }
      }
    }
    
    await get().loadStudents()
    return count
  },
  
  // 加载课程计划
  loadLessonPlans: async (studentId) => {
    const plans = await lessonPlanDb.getByStudentId(studentId)
    set({ lessonPlans: plans })
  },
  
  // 创建课程计划
  createLessonPlan: async (data) => {
    const plan = await lessonPlanDb.create(data)
    await get().loadLessonPlans(data.student_id)
    return plan
  },
  
  // 更新课程计划
  updateLessonPlan: async (id, data) => {
    const plan = await lessonPlanDb.update(id, data)
    if (plan && get().currentStudent?.id === plan.student_id) {
      await get().loadLessonPlans(plan.student_id)
    }
    return plan
  },
  
  // 删除课程计划
  deleteLessonPlan: async (id) => {
    const plan = await lessonPlanDb.getById(id)
    if (plan) {
      await lessonPlanDb.delete(id)
      if (get().currentStudent?.id === plan.student_id) {
        await get().loadLessonPlans(plan.student_id)
      }
    }
  },
  
  // 加载考试成绩
  loadExamScores: async (studentId) => {
    const scores = await examScoreDb.getByStudentId(studentId)
    set({ examScores: scores })
  },
  
  // 创建考试成绩
  createExamScore: async (data) => {
    const score = await examScoreDb.create(data)
    await get().loadExamScores(data.student_id)
    return score
  },
  
  // 更新考试成绩
  updateExamScore: async (id, data) => {
    const score = await examScoreDb.update(id, data)
    if (score && get().currentStudent?.id === score.student_id) {
      await get().loadExamScores(score.student_id)
    }
    return score
  },
  
  // 删除考试成绩
  deleteExamScore: async (id) => {
    const score = await examScoreDb.getById(id)
    if (score) {
      await examScoreDb.delete(id)
      if (get().currentStudent?.id === score.student_id) {
        await get().loadExamScores(score.student_id)
      }
    }
  },
  
  // 加载学习阶段
  loadLearningPhases: async (studentId) => {
    const phases = await learningPhaseDb.getByStudentId(studentId)
    set({ learningPhases: phases })
  },
  
  // 创建学习阶段
  createLearningPhase: async (data) => {
    const phase = await learningPhaseDb.create(data)
    await get().loadLearningPhases(data.student_id)
    return phase
  },
  
  // 更新学习阶段
  updateLearningPhase: async (id, data) => {
    const phase = await learningPhaseDb.update(id, data)
    if (phase && get().currentStudent?.id === phase.student_id) {
      await get().loadLearningPhases(phase.student_id)
    }
    return phase
  },
  
  // 删除学习阶段
  deleteLearningPhase: async (id) => {
    const phase = await learningPhaseDb.getById(id)
    if (phase) {
      await learningPhaseDb.delete(id)
      if (get().currentStudent?.id === phase.student_id) {
        await get().loadLearningPhases(phase.student_id)
      }
    }
  },
  
  // 切换侧边栏
  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },
  
  // 设置主题
  setTheme: (theme) => {
    set({ theme })
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}))