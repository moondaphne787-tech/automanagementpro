import { useState, useEffect, useCallback } from 'react'
import { studentDb, teacherDb, scheduledClassDb, studentSchedulePreferenceDb } from '@/db'
import type { Student, Teacher, ScheduledClass, Billing, StudentSchedulePreference } from '@/types'

export type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

export function useScheduleData(date: string) {
  const [students, setStudents] = useState<StudentWithPrefs[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<(ScheduledClass & { student?: Student; teacher?: Teacher })[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [studentsData, teachersData] = await Promise.all([
        studentDb.getAllWithBilling(
          { status: 'active', student_type: 'all', level: 'all', grade: 'all', search: '', day_of_week: 'all' },
          { field: 'student_no', direction: 'asc' }
        ),
        teacherDb.getActive()
      ])

      const studentsWithPrefs = await Promise.all(
        studentsData.map(async (s) => {
          const prefs = await studentSchedulePreferenceDb.getByStudentId(s.id)
          return { ...s, preferences: prefs }
        })
      )

      setStudents(studentsWithPrefs)
      setTeachers(teachersData)

      if (date) {
        const classesData = await scheduledClassDb.getByDate(date)
        setClasses(classesData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    loadData()
  }, [loadData])

  return { students, teachers, classes, loading, loadData }
}
