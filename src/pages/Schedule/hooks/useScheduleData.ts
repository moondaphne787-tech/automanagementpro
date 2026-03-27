import { useState, useEffect, useMemo } from 'react'
import { studentDb, teacherDb, scheduledClassDb, studentSchedulePreferenceDb, teacherAvailabilityDb } from '@/db'
import type { Student, Teacher, ScheduledClass, Billing, StudentSchedulePreference, TeacherAvailability } from '@/types'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'

export type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
export type TeacherWithAvail = Teacher & { availabilities: TeacherAvailability[] }
export type ClassWithDetails = ScheduledClass & { student?: Student; teacher?: Teacher }

interface UseScheduleDataProps {
  scheduleDates: ScheduleDateConfig[]
}

interface UseScheduleDataReturn {
  students: StudentWithPrefs[]
  teachers: TeacherWithAvail[]
  classes: ClassWithDetails[]
  loading: boolean
  loadData: () => Promise<void>
  unscheduledStudents: StudentWithPrefs[]
}

export function useScheduleData({ scheduleDates }: UseScheduleDataProps): UseScheduleDataReturn {
  const [students, setStudents] = useState<StudentWithPrefs[]>([])
  const [teachers, setTeachers] = useState<TeacherWithAvail[]>([])
  const [classes, setClasses] = useState<ClassWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const [studentsData, teachersData] = await Promise.all([
        studentDb.getAllWithBilling({ status: 'active', student_type: 'all', level: 'all', grade: 'all', search: '' }, { field: 'student_no', direction: 'asc' }),
        teacherDb.getActive()
      ])

      const studentsWithPrefs = await Promise.all(
        studentsData.map(async (s) => {
          const prefs = await studentSchedulePreferenceDb.getByStudentId(s.id)
          return { ...s, preferences: prefs }
        })
      )

      const teachersWithAvail = await Promise.all(
        teachersData.map(async (t) => {
          const avail = await teacherAvailabilityDb.getByTeacherId(t.id)
          return { ...t, availabilities: avail }
        })
      )

      setStudents(studentsWithPrefs)
      setTeachers(teachersWithAvail)

      if (scheduleDates.length > 0) {
        const startDate = scheduleDates.reduce((min, d) => d.date < min ? d.date : min, scheduleDates[0].date)
        const endDate = scheduleDates.reduce((max, d) => d.date > max ? d.date : max, scheduleDates[0].date)
        const classesData = await scheduledClassDb.getByWeek(startDate, endDate)
        setClasses(classesData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [scheduleDates])

  // 获取未排课的学生
  const unscheduledStudents = useMemo(() => {
    const scheduledStudentIds = new Set(classes.filter(c => c.status === 'scheduled').map(c => c.student_id))
    return students.filter(s => !scheduledStudentIds.has(s.id))
  }, [students, classes])

  return {
    students,
    teachers,
    classes,
    loading,
    loadData,
    unscheduledStudents
  }
}