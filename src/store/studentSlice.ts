import type { StateCreator } from 'zustand'
import type { AppState, StudentSlice } from './types'
import { studentDb, billingDb, progressDb, lessonPlanDb, trialConversionDb } from '@/db'

export const createStudentSlice: StateCreator<AppState, [], [], StudentSlice> = (set, get) => ({
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
  expiredPlansMap: new Map(),
  expiredPlansLoading: false,

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
    const updated = {
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
  }
})