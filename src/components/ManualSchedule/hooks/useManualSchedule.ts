import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { studentDb, teacherDb, scheduledClassDb, studentSchedulePreferenceDb, teacherAvailabilityDb } from '@/db'
import { getGradesFromSuitableGrades } from '@/types'
import type { 
  Student, 
  Teacher, 
  ScheduledClass, 
  DayOfWeek, 
  Billing, 
  StudentSchedulePreference,
  TeacherAvailability,
  StudentRow,
  StudentSlot,
  TeacherWithColor,
  TeacherCardData,
  ConflictInfo,
  TimeRange
} from '../types'
import { TEACHER_COLORS, LEVEL_LABELS } from '../constants'

// 格式化日期
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// 获取日期对应的星期
export function getDayOfWeek(dateStr: string): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const date = new Date(dateStr)
  return days[date.getDay()]
}

// 将时间字符串转换为分钟数
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// 将分钟数转换为时间字符串
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// 计算时间范围
export function getTimeRange(slots: StudentSlot[]): TimeRange {
  let startMin = 8 * 60 // 默认从8点开始
  let endMin = 21 * 60 // 默认到21点结束
  
  slots.forEach(slot => {
    const slotStart = timeToMinutes(slot.preferredStart)
    const slotEnd = timeToMinutes(slot.preferredEnd)
    if (slotStart < startMin) startMin = slotStart
    if (slotEnd > endMin) endMin = slotEnd
  })
  
  // 向上取整到整点
  startMin = Math.floor(startMin / 60) * 60
  endMin = Math.ceil(endMin / 60) * 60
  
  return { start: startMin, end: endMin }
}

// 计算色块位置和宽度
export function calculateSlotStyle(start: string, end: string, timeRangeStart: number): { left: number; width: number } {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  
  const left = ((startMin - timeRangeStart) / 60) * 80 // HOUR_WIDTH
  const width = ((endMin - startMin) / 60) * 80
  
  return { left, width: Math.max(width, 60) }
}

export interface UseManualScheduleOptions {
  initialDate?: string
}

export interface UseManualScheduleReturn {
  // 状态
  selectedDate: string
  students: (Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]
  teachers: TeacherWithColor[]
  scheduledClasses: (ScheduledClass & { teacher?: Teacher })[]
  loading: boolean
  saving: boolean
  localSchedules: Map<string, string>
  studentRows: StudentRow[]
  timeRange: TimeRange
  teacherCards: TeacherCardData[]
  
  // 方法
  setSelectedDate: (date: string) => void
  goToPrevDay: () => void
  goToNextDay: () => void
  goToToday: () => void
  handleAssign: (slotId: string, teacherId: string) => void
  handleRemove: (slotId: string) => void
  handleClearDay: () => Promise<void>
  handleSave: () => Promise<void>
  getTeacherAssignStatuses: (slot: StudentSlot) => import('../types').TeacherAssignStatus[]
  checkTeacherConflict: (teacherId: string, slot: StudentSlot) => ConflictInfo
  loadSchedulesForDate: (date: string) => Promise<void>
  handleAddPreference: (studentId: string, date: string, startTime: string, endTime: string) => Promise<void>
}

export function useManualSchedule(options: UseManualScheduleOptions = {}): UseManualScheduleReturn {
  const { initialDate } = options
  
  // 日期状态
  const [selectedDate, setSelectedDate] = useState(initialDate || formatDate(new Date()))
  
  // 监听初始日期变化
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate)
    }
  }, [initialDate])
  
  // 数据状态
  const [students, setStudents] = useState<(Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]>([])
  const [teachers, setTeachers] = useState<TeacherWithColor[]>([])
  const [scheduledClasses, setScheduledClasses] = useState<(ScheduledClass & { teacher?: Teacher })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [staticDataLoaded, setStaticDataLoaded] = useState(false)
  
  // 本地排课状态（未保存）
  const [localSchedules, setLocalSchedules] = useState<Map<string, string>>(new Map())
  
  // 加载静态数据（学员和助教）- 只在组件挂载时加载一次
  const loadStaticData = async () => {
    try {
      setLoading(true)
      
      // 加载学生（带偏好）
      const studentsData = await studentDb.getAllWithBilling(
        { status: 'active', student_type: 'all', level: 'all', grade: 'all', search: '', day_of_week: 'all' },
        { field: 'student_no', direction: 'asc' }
      )
      
      const studentsWithPrefs = await Promise.all(
        studentsData.map(async (s) => {
          const prefs = await studentSchedulePreferenceDb.getByStudentId(s.id)
          return { ...s, preferences: prefs }
        })
      )
      
      // 加载助教（带可用时段）
      const teachersData = await teacherDb.getActive()
      
      const teachersWithColor = await Promise.all(
        teachersData.map(async (t, index) => {
          // 加载每个助教的可用时段
          const availabilities = await teacherAvailabilityDb.getByTeacherId(t.id)
          return { 
            ...t, 
            color: TEACHER_COLORS[index % TEACHER_COLORS.length],
            availabilities
          }
        })
      )
      
      setStudents(studentsWithPrefs)
      setTeachers(teachersWithColor)
      setStaticDataLoaded(true)
      
    } catch (error) {
      console.error('Failed to load static data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 加载指定日期的排课数据 - 随日期切换刷新
  const loadSchedulesForDate = async (date: string) => {
    try {
      // 加载当天已排课程
      const classes = await scheduledClassDb.getByDate(date)
      setScheduledClasses(classes)
      setLocalSchedules(new Map()) // 重置本地排课
    } catch (error) {
      console.error('Failed to load schedules:', error)
    }
  }
  
  // 组件挂载时加载静态数据（只执行一次）
  useEffect(() => {
    loadStaticData()
  }, [])
  
  // 日期切换时只加载排课数据
  useEffect(() => {
    if (staticDataLoaded) {
      loadSchedulesForDate(selectedDate)
    }
  }, [selectedDate, staticDataLoaded])
  
  // 构建学生行数据
  const studentRows = useMemo((): StudentRow[] => {
    const dayOfWeek = getDayOfWeek(selectedDate)
    const rowsMap = new Map<string, StudentRow>()
    
    students.forEach(student => {
      const slots: StudentSlot[] = []
      
      // 查找当天对应的偏好时段
      const todayPrefs = student.preferences.filter(p => p.day_of_week === dayOfWeek)
      
      if (todayPrefs.length > 0) {
        todayPrefs.forEach(pref => {
          const start = pref.preferred_start || '09:00'
          const end = pref.preferred_end || '11:00'
          const [startH, startM] = start.split(':').map(Number)
          const [endH, endM] = end.split(':').map(Number)
          const durationHours = (endH * 60 + endM - startH * 60 - startM) / 60
          
          // 检查是否已排课
          const existingClass = scheduledClasses.find(c => 
            c.student_id === student.id && 
            c.status === 'scheduled' &&
            c.start_time === start
          )
          
          // 检查本地排课
          const slotId = `${student.id}-${start}`
          const localTeacherId = localSchedules.get(slotId)
          
          let teacher: TeacherWithColor | undefined
          let status: 'unscheduled' | 'scheduled' = 'unscheduled'
          
          if (localTeacherId) {
            teacher = teachers.find(t => t.id === localTeacherId)
            status = 'scheduled'
          } else if (existingClass && existingClass.teacher_id) {
            teacher = teachers.find(t => t.id === existingClass.teacher_id)
            status = 'scheduled'
          }
          
          slots.push({
            id: slotId,
            student,
            preferredStart: start,
            preferredEnd: end,
            durationHours,
            scheduledClass: existingClass,
            teacherId: teacher?.id,
            teacher,
            status
          })
        })
      } else {
        // 没有偏好时段，检查是否有已排课程
        const existingClasses = scheduledClasses.filter(c => 
          c.student_id === student.id && 
          c.status === 'scheduled'
        )
        
        existingClasses.forEach(existingClass => {
          const start = existingClass.start_time || '09:00'
          const end = existingClass.end_time || '11:00'
          const [startH, startM] = start.split(':').map(Number)
          const [endH, endM] = end.split(':').map(Number)
          const durationHours = (endH * 60 + endM - startH * 60 - startM) / 60
          
          let teacher: TeacherWithColor | undefined
          if (existingClass.teacher_id) {
            teacher = teachers.find(t => t.id === existingClass.teacher_id)
          }
          
          slots.push({
            id: `${student.id}-${start}`,
            student,
            preferredStart: start,
            preferredEnd: end,
            durationHours,
            scheduledClass: existingClass,
            teacherId: teacher?.id,
            teacher,
            status: 'scheduled'
          })
        })
      }
      
      // 只添加有时段的学生
      if (slots.length > 0) {
        rowsMap.set(student.id, { student, slots })
      }
    })
    
    // 转换为数组并按学生姓名排序
    return Array.from(rowsMap.values()).sort((a, b) => 
      a.student.name.localeCompare(b.student.name, 'zh-CN')
    )
  }, [students, scheduledClasses, localSchedules, teachers, selectedDate])
  
  // 计算时间范围
  const timeRange = useMemo(() => {
    const allSlots = studentRows.flatMap(row => row.slots)
    if (allSlots.length === 0) {
      return { start: 8 * 60, end: 21 * 60 }
    }
    return getTimeRange(allSlots)
  }, [studentRows])
  
  // 构建助教卡片数据
  const teacherCards = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate)
    
    return teachers.map(teacher => {
      // 获取今日可用时段
      const teacherAvails = (teacher as any).availabilities || []
      const todayAvail = teacherAvails.filter((a: TeacherAvailability) => a.day_of_week === dayOfWeek)
      const availabilityStr = todayAvail.map((a: TeacherAvailability) => 
        `${a.start_time?.slice(0, 5) || '00:00'}-${a.end_time?.slice(0, 5) || '23:59'}`
      ).join(', ') || '今日无可用时段'
      
      // 计算已排课时
      const teacherClasses = scheduledClasses.filter(c => 
        c.teacher_id === teacher.id && 
        c.status === 'scheduled'
      )
      const scheduledHours = teacherClasses.reduce((sum, c) => sum + c.duration_hours, 0)
      
      // 计算可用时长
      const totalAvailMinutes = todayAvail.reduce((sum: number, a: TeacherAvailability) => {
        const [startH, startM] = (a.start_time || '00:00').split(':').map(Number)
        const [endH, endM] = (a.end_time || '23:59').split(':').map(Number)
        return sum + (endH * 60 + endM - startH * 60 - startM)
      }, 0)
      const remainingHours = Math.max(0, totalAvailMinutes / 60 - scheduledHours)
      
      // 是否已满
      const isFull = remainingHours <= 0
      
      // 适合程度
      const suitableLevelsRaw = teacher.suitable_levels
      let suitableLevelsParsed: string[] = []
      try {
        if (Array.isArray(suitableLevelsRaw)) {
          suitableLevelsParsed = suitableLevelsRaw
        } else if (typeof suitableLevelsRaw === 'string' && suitableLevelsRaw) {
          const parsed = JSON.parse(suitableLevelsRaw)
          if (Array.isArray(parsed)) suitableLevelsParsed = parsed
        }
      } catch {
        suitableLevelsParsed = []
      }
      
      // 适合年级
      const suitableGrades = teacher.suitable_grades || ''
      
      return {
        teacher: teacher,
        color: teacher.color,
        todayAvailability: availabilityStr,
        suitableLevels: suitableLevelsParsed.map(l => LEVEL_LABELS[l as import('../types').LevelType] || l),
        suitableGrades,
        scheduledHours,
        remainingHours,
        isFull,
        hasAvailabilityToday: todayAvail.length > 0
      }
    })
  }, [teachers, scheduledClasses, selectedDate])
  
  // 检查助教冲突
  const checkTeacherConflict = useCallback((teacherId: string, slot: StudentSlot): ConflictInfo => {
    const teacher = teachers.find(t => t.id === teacherId)
    if (!teacher) {
      return { type: 'hard', reasons: ['助教不存在'] }
    }
    
    const dayOfWeek = getDayOfWeek(selectedDate)
    const reasons: string[] = []
    let hasHardConflict = false
    
    // 1. 检查助教可用时段（硬冲突）
    const teacherAvails = (teacher as any).availabilities || []
    const teacherAvailToday = teacherAvails.filter((a: TeacherAvailability) => a.day_of_week === dayOfWeek)
    const slotStart = slot.preferredStart
    const slotEnd = slot.preferredEnd
    
    const isAvailable = teacherAvailToday.some((avail: TeacherAvailability) => {
      const availStart = avail.start_time || '00:00'
      const availEnd = avail.end_time || '23:59'
      return availStart <= slotStart && availEnd >= slotEnd
    })
    
    if (!isAvailable) {
      reasons.push('该时段不可用')
      hasHardConflict = true
    }
    
    // 2. 检查时段冲突 - 已保存到数据库的课程（硬冲突）
    const existingClasses = scheduledClasses.filter(c => 
      c.teacher_id === teacherId && 
      c.status === 'scheduled' &&
      c.id !== slot.scheduledClass?.id
    )
    
    const hasTimeConflict = existingClasses.some(c => {
      const cStart = c.start_time || '00:00'
      const cEnd = c.end_time || '23:59'
      return !(slotEnd <= cStart || slotStart >= cEnd)
    })
    
    if (hasTimeConflict) {
      reasons.push('该时段已有其他课程')
      hasHardConflict = true
    }
    
    // 3. 检查时段冲突 - 本地临时排课（硬冲突）
    const allSlots = studentRows.flatMap(row => row.slots)
    localSchedules.forEach((localTeacherId, localSlotId) => {
      // 只检查同一助教的分配
      if (localTeacherId !== teacherId) return
      // 不检查当前正在编辑的时段
      if (localSlotId === slot.id) return
      
      const localSlot = allSlots.find(s => s.id === localSlotId)
      if (!localSlot) return
      
      const localStart = localSlot.preferredStart
      const localEnd = localSlot.preferredEnd
      
      // 检查时间是否重叠
      const hasOverlap = !(slotEnd <= localStart || slotStart >= localEnd)
      if (hasOverlap) {
        reasons.push(`该时段已被分配给 ${localSlot.student.name}`)
        hasHardConflict = true
      }
    })
    
    // 4. 检查程度匹配（软冲突）
    if (teacher.suitable_levels) {
      let levels: string[] = []
      if (Array.isArray(teacher.suitable_levels)) {
        levels = teacher.suitable_levels
      } else if (typeof teacher.suitable_levels === 'string' && teacher.suitable_levels) {
        try {
          const parsed = JSON.parse(teacher.suitable_levels)
          if (Array.isArray(parsed)) levels = parsed
        } catch { /* ignore */ }
      }
      
      if (levels.length > 0 && !levels.includes(slot.student.level)) {
        reasons.push(`程度不匹配(适合: ${levels.map(l => LEVEL_LABELS[l as import('../types').LevelType] || l).join('、')})`)
      }
    }
    
    // 5. 检查年级匹配（软冲突）
    if (teacher.suitable_grades && slot.student.grade) {
      const suitableGradeList = getGradesFromSuitableGrades(teacher.suitable_grades)
      if (suitableGradeList.length > 0 && !suitableGradeList.includes(slot.student.grade)) {
        reasons.push(`年级不匹配(适合: ${teacher.suitable_grades})`)
      }
    }
    
    return {
      type: hasHardConflict ? 'hard' : reasons.length > 0 ? 'soft' : 'none',
      reasons
    }
  }, [teachers, scheduledClasses, selectedDate, localSchedules, studentRows])
  
  // 获取所有助教的分配状态
  const getTeacherAssignStatuses = useCallback((slot: StudentSlot): import('../types').TeacherAssignStatus[] => {
    return teachers.map(teacher => {
      const conflict = checkTeacherConflict(teacher.id, slot)
      return {
        teacher,
        canAssign: conflict.type !== 'hard',
        conflictType: conflict.type,
        reasons: conflict.reasons
      }
    })
  }, [teachers, checkTeacherConflict])
  
  // 分配助教
  const handleAssign = useCallback((slotId: string, teacherId: string) => {
    const slot = studentRows.flatMap(row => row.slots).find(s => s.id === slotId)
    if (!slot) return
    
    const conflict = checkTeacherConflict(teacherId, slot)
    
    if (conflict.type === 'hard') {
      alert(`无法分配：${conflict.reasons.join('；')}`)
      return
    }
    
    if (conflict.type === 'soft') {
      const confirmed = confirm(`警告：${conflict.reasons.join('；')}\n\n是否仍然分配？`)
      if (!confirmed) return
    }
    
    // 本地更新
    setLocalSchedules(prev => new Map(prev).set(slotId, teacherId))
  }, [studentRows, checkTeacherConflict])
  
  // 取消分配
  const handleRemove = useCallback((slotId: string) => {
    const slot = studentRows.flatMap(row => row.slots).find(s => s.id === slotId)
    if (!slot) return
    
    if (slot.scheduledClass) {
      // 已保存到数据库的课程
      scheduledClassDb.delete(slot.scheduledClass.id).then(() => {
        loadSchedulesForDate(selectedDate)
      })
    } else {
      // 仅本地排课
      setLocalSchedules(prev => {
        const newMap = new Map(prev)
        newMap.delete(slotId)
        return newMap
      })
    }
  }, [studentRows, selectedDate])
  
  // 清空本日排课
  const handleClearDay = async () => {
    if (!confirm('确定要清空本日所有排课吗？此操作不可恢复。')) return
    
    try {
      for (const cls of scheduledClasses) {
        if (cls.status === 'scheduled') {
          await scheduledClassDb.delete(cls.id)
        }
      }
      setLocalSchedules(new Map())
      loadSchedulesForDate(selectedDate)
    } catch (error) {
      console.error('Failed to clear day:', error)
      alert('清空失败')
    }
  }
  
  // 保存排课
  const handleSave = async () => {
    if (localSchedules.size === 0) {
      alert('没有需要保存的排课')
      return
    }
    
    try {
      setSaving(true)
      
      const allSlots = studentRows.flatMap(row => row.slots)
      
      for (const [slotId, teacherId] of localSchedules) {
        const slot = allSlots.find(s => s.id === slotId)
        if (!slot) continue
        
        await scheduledClassDb.create({
          student_id: slot.student.id,
          teacher_id: teacherId,
          class_date: selectedDate,
          start_time: slot.preferredStart,
          end_time: slot.preferredEnd,
          duration_hours: slot.durationHours
        })
      }
      
      alert('保存成功')
      loadSchedulesForDate(selectedDate)
      
    } catch (error) {
      console.error('Failed to save:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 切换日期
  const goToPrevDay = () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() - 1)
    setSelectedDate(formatDate(date))
  }
  
  const goToNextDay = () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + 1)
    setSelectedDate(formatDate(date))
  }
  
  const goToToday = () => {
    setSelectedDate(formatDate(new Date()))
  }
  
  // 快速添加时段偏好
  const handleAddPreference = useCallback(async (
    studentId: string,
    date: string,
    startTime: string,
    endTime: string
  ) => {
    const dayOfWeek = getDayOfWeek(date)
    
    // 创建偏好记录
    await studentSchedulePreferenceDb.create({
      student_id: studentId,
      day_of_week: dayOfWeek,
      preferred_start: startTime,
      preferred_end: endTime,
    })
    
    // 重新加载静态数据（更新学生偏好）
    await loadStaticData()
    
    // 重新加载排课数据
    await loadSchedulesForDate(date)
  }, [])
  
  return {
    // 状态
    selectedDate,
    students,
    teachers,
    scheduledClasses,
    loading,
    saving,
    localSchedules,
    studentRows,
    timeRange,
    teacherCards,
    
    // 方法
    setSelectedDate,
    goToPrevDay,
    goToNextDay,
    goToToday,
    handleAssign,
    handleRemove,
    handleClearDay,
    handleSave,
    getTeacherAssignStatuses,
    checkTeacherConflict,
    loadSchedulesForDate,
    handleAddPreference
  }
}
