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
import type { DashboardData } from '@/hooks/useDashboard'
import { studentDb, billingDb, wordbankDb, progressDb, classRecordDb, lessonPlanDb, examScoreDb, learningPhaseDb, trialConversionDb, settingsDb, teacherDb } from '@/db'
import { matchTeacherByName } from '@/lib/utils'

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
  
  // 过期计划状态
  expiredPlansMap: Map<string, number> // student_id -> expired count
  expiredPlansLoading: boolean
  
  // 学期配置
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
  
  // UI状态
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  
  // Dashboard 缓存状态
  dashboardData: DashboardData | null
  dashboardLoadedAt: number | null
  dashboardDateKey: string | null
  
  // 操作方法
  loadStudents: () => Promise<void>
  loadExpiredPlansCount: () => Promise<void>
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
  
  // Dashboard 缓存操作
  setDashboardCache: (data: DashboardData, dateKey: string) => void
  clearDashboardCache: () => void
  isDashboardCacheValid: (staleTime: number) => boolean
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
    search: '',
    day_of_week: 'all'
  },
  sort: {
    field: 'student_no',
    direction: 'asc'
  },
  currentStudent: null,
  currentBilling: null,
  currentProgress: [],
  wordbanks: [],
  semesterConfig: null,
  sidebarCollapsed: false,
  theme: 'light',
  classRecords: [],
  lessonPlans: [],
  examScores: [],
  learningPhases: [],
  expiredPlansMap: new Map(),
  expiredPlansLoading: false,
  
  // Dashboard 缓存初始状态
  dashboardData: null,
  dashboardLoadedAt: null,
  dashboardDateKey: null,
  
  // 加载学员列表（不含过期计划查询，提高性能）
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
  
  // 单独加载过期计划数量（仅在首页挂载时调用一次）
  loadExpiredPlansCount: async () => {
    set({ expiredPlansLoading: true })
    try {
      const { students } = get()
      const activeStudentIds = students
        .filter(s => s.status === 'active')
        .map(s => s.id)
      const expiredPlansMap = await lessonPlanDb.getExpiredPlansCount(activeStudentIds)
      
      set({ expiredPlansMap, expiredPlansLoading: false })
    } catch (error) {
      console.error('Failed to load expired plans count:', error)
      set({ expiredPlansLoading: false })
    }
  },
  
  // 设置筛选条件
  setFilters: (newFilters) => {
    const current = get().filters
    const updated: FilterOptions = {
      status: newFilters.status ?? current.status,
      student_type: newFilters.student_type ?? current.student_type,
      level: newFilters.level ?? current.level,
      grade: newFilters.grade ?? current.grade,
      search: newFilters.search ?? current.search,
      day_of_week: newFilters.day_of_week ?? current.day_of_week
    }
    set({ filters: updated })
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
      const effectiveLevel = task.level_reached ?? task.level_to
      if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
          task.wordbank_label && effectiveLevel) {
        // 查找对应的词库
        const wordbanks = await wordbankDb.getAll()
        const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
        if (wordbank) {
          const existingProgress = await progressDb.getByStudentId(data.student_id)
          const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
          
          // 只有新关数大于当前关数才更新
          if (!currentProgress || effectiveLevel > currentProgress.current_level) {
            await progressDb.upsert({
              student_id: data.student_id,
              wordbank_id: wordbank.id,
              current_level: effectiveLevel
            })
          }
        }
      }
      
      // 九宫格进度同步
      if (task.type === 'nine_grid' && task.wordbank_label) {
        const wordbanks = await wordbankDb.getAll()
        const wordbank = wordbanks.find(w => w.name === task.wordbank_label)
        if (wordbank) {
          const existingProgress = await progressDb.getByStudentId(data.student_id)
          const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
          if (currentProgress) {
            await progressDb.upsert({
              student_id: data.student_id,
              wordbank_id: wordbank.id,
              current_level: currentProgress.current_level,
              last_nine_grid_level: currentProgress.current_level  // 记录本次九宫格完成到的关
            })
          }
        }
      }
    }
    
    // 同步助教累计课时（使用精确匹配优先的匹配函数）
    if (data.teacher_name && data.duration_hours) {
      const allTeachers = await teacherDb.getAll()
      const matchedTeacher = matchTeacherByName(data.teacher_name, allTeachers)
      if (matchedTeacher) {
        await teacherDb.addTeachingHours(matchedTeacher.id, data.duration_hours)
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
    // 获取原记录用于课时调整
    const oldRecord = await classRecordDb.getById(id)
    if (!oldRecord) return undefined
    
    // 更新记录
    const record = await classRecordDb.update(id, data)
    if (!record) return undefined
    
    // 处理课时调整：如果时长变化，需要先减旧值再加新值
    if (data.duration_hours !== undefined && oldRecord.duration_hours !== data.duration_hours) {
      const billing = await billingDb.getByStudentId(record.student_id)
      if (billing) {
        // 先减去旧课时，再加上新课时
        const newUsedHours = Math.max(0, billing.used_hours - oldRecord.duration_hours + data.duration_hours)
        await billingDb.update(record.student_id, {
          used_hours: newUsedHours
        })
      }
    }
    
    // 处理助教课时调整：如果助教或时长变化
    if (data.duration_hours !== undefined || data.teacher_name !== undefined) {
      const oldTeacherName = oldRecord.teacher_name
      // 如果没有指定新的助教，则使用原助教（处理只更新时长的情况）
      const newTeacherName = data.teacher_name !== undefined ? data.teacher_name : oldRecord.teacher_name
      const oldDuration = oldRecord.duration_hours
      const newDuration = data.duration_hours ?? oldRecord.duration_hours
      
      const allTeachers = await teacherDb.getAll()
      
      // 如果助教变更或时长变更，需要调整课时
      if (oldTeacherName !== newTeacherName || oldDuration !== newDuration) {
        // 回退原助教课时
        if (oldTeacherName && oldDuration) {
          const oldTeacher = allTeachers.find(t => t.name === oldTeacherName)
          if (oldTeacher) {
            await teacherDb.update(oldTeacher.id, {
              total_teaching_hours: Math.max(0, oldTeacher.total_teaching_hours - oldDuration)
            })
          }
        }
        
        // 累加新助教课时
        if (newTeacherName && newDuration) {
          // 重新获取最新数据（因为上面的回退操作可能已修改）
          const updatedTeachers = await teacherDb.getAll()
          const newTeacher = updatedTeachers.find(t => t.name === newTeacherName)
          if (newTeacher) {
            await teacherDb.addTeachingHours(newTeacher.id, newDuration)
          }
        }
      }
    }
    
    // 刷新数据
    if (get().currentStudent?.id === record.student_id) {
      await get().loadClassRecords(record.student_id)
      const billing = await billingDb.getByStudentId(record.student_id)
      set({ currentBilling: billing ?? null })
    }
    await get().loadStudents()
    
    return record
  },
  
  // 删除课堂记录
  deleteClassRecord: async (id) => {
    const record = await classRecordDb.getById(id)
    if (record) {
      // 回退学员课时
      if (record.duration_hours) {
        const billing = await billingDb.getByStudentId(record.student_id)
        if (billing) {
          await billingDb.update(record.student_id, {
            used_hours: Math.max(0, billing.used_hours - record.duration_hours)
          })
        }
      }
      
      // 回退助教课时
      if (record.teacher_name && record.duration_hours) {
        const allTeachers = await teacherDb.getAll()
        const teacher = allTeachers.find(t => t.name === record.teacher_name)
        if (teacher) {
          await teacherDb.update(teacher.id, {
            total_teaching_hours: Math.max(0, teacher.total_teaching_hours - record.duration_hours)
          })
        }
      }
      
      await classRecordDb.delete(id)
      
      // 刷新数据
      if (get().currentStudent?.id === record.student_id) {
        await get().loadClassRecords(record.student_id)
        const billing = await billingDb.getByStudentId(record.student_id)
        set({ currentBilling: billing ?? null })
      }
      await get().loadStudents()
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
    
    // ✅ 性能优化：在循环前批量获取词库（避免 N+1 查询）
    const wordbanks = await wordbankDb.getAll()
    const wordbankMap = new Map(wordbanks.map(w => [w.name, w]))
    
    // ✅ 性能优化：预加载所有涉及学员的进度（避免 N+1 查询）
    const uniqueStudentIds = [...new Set(records.map(r => r.student_id))]
    const progressMap = new Map<string, StudentWordbankProgress[]>()
    for (const sid of uniqueStudentIds) {
      progressMap.set(sid, await progressDb.getByStudentId(sid))
    }
    
    // 同步词库进度（使用预加载的数据）
    for (const record of records) {
      for (const task of record.tasks) {
        const effectiveLevel = task.level_reached ?? task.level_to
        if ((task.type === 'vocab_new' || task.type === 'vocab_review') && 
            task.wordbank_label && effectiveLevel) {
          // ✅ 使用预加载的词库 Map
          const wordbank = wordbankMap.get(task.wordbank_label)
          if (wordbank) {
            // ✅ 使用预加载的进度 Map
            const existingProgress = progressMap.get(record.student_id) || []
            const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
            
            if (!currentProgress || effectiveLevel > currentProgress.current_level) {
              await progressDb.upsert({
                student_id: record.student_id,
                wordbank_id: wordbank.id,
                current_level: effectiveLevel
              })
            }
          }
        }
        
        // 九宫格进度同步
        if (task.type === 'nine_grid' && task.wordbank_label) {
          // ✅ 使用预加载的词库 Map
          const wordbank = wordbankMap.get(task.wordbank_label)
          if (wordbank) {
            // ✅ 使用预加载的进度 Map
            const existingProgress = progressMap.get(record.student_id) || []
            const currentProgress = existingProgress.find(p => p.wordbank_id === wordbank.id)
            if (currentProgress) {
              await progressDb.upsert({
                student_id: record.student_id,
                wordbank_id: wordbank.id,
                current_level: currentProgress.current_level,
                last_nine_grid_level: currentProgress.current_level  // 记录本次九宫格完成到的关
              })
            }
          }
        }
      }
    }
    
    // 按助教姓名汇总需要累加的课时
    const teacherHoursMap = new Map<string, number>()
    for (const record of records) {
      if (record.teacher_name && record.duration_hours) {
        const current = teacherHoursMap.get(record.teacher_name) || 0
        teacherHoursMap.set(record.teacher_name, current + record.duration_hours)
      }
    }
    
    // 批量更新助教课时（使用精确匹配优先的匹配函数）
    if (teacherHoursMap.size > 0) {
      const allTeachers = await teacherDb.getAll()
      for (const [teacherName, hours] of teacherHoursMap) {
        const matchedTeacher = matchTeacherByName(teacherName, allTeachers)
        if (matchedTeacher) {
          await teacherDb.addTeachingHours(matchedTeacher.id, hours)
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
    if (plan && plan.student_id) {
      await lessonPlanDb.delete(id)
      if (get().currentStudent?.id === plan.student_id) {
        await get().loadLessonPlans(plan.student_id)
      }
      // 刷新过期计划数量
      await get().loadStudents()
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
  },
  
  // 切换侧边栏
  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },
  
  // 设置主题
  setTheme: (theme) => {
    set({ theme })
    document.documentElement.classList.toggle('dark', theme === 'dark')
  },
  
  // Dashboard 缓存操作
  setDashboardCache: (data, dateKey) => {
    set({
      dashboardData: data,
      dashboardLoadedAt: Date.now(),
      dashboardDateKey: dateKey
    })
  },
  
  clearDashboardCache: () => {
    set({
      dashboardData: null,
      dashboardLoadedAt: null,
      dashboardDateKey: null
    })
  },
  
  isDashboardCacheValid: (staleTime) => {
    const state = get()
    if (!state.dashboardData || !state.dashboardLoadedAt || !state.dashboardDateKey) {
      return false
    }
    
    // 格式化本地日期为 YYYY-MM-DD 格式
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    
    // 如果日期变化（跨天），缓存失效
    if (state.dashboardDateKey !== today) return false
    
    // 如果超过新鲜时间，缓存失效
    if (Date.now() - state.dashboardLoadedAt > staleTime) return false
    
    return true
  }
}))
