import { useState } from 'react'
import { Plus, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Student, Teacher, Billing, StudentSchedulePreference, TeacherAvailability } from '@/types'
import type { ScheduleDateConfig } from '../../pages/Schedule/types'
import { DAY_LABELS } from '@/types'
import { getDayOfWeek, formatDateISO } from '@/lib/utils'
import { generateId } from '@/db/utils'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
type TeacherWithAvail = Teacher & { availabilities: TeacherAvailability[] }

export interface ScheduleItem {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
}

export interface ScheduleSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  students: StudentWithPrefs[]
  teachers: TeacherWithAvail[]
  scheduleDates: ScheduleDateConfig[]
  unscheduledStudents: StudentWithPrefs[]
  onOpenPreferenceDialog: (student: StudentWithPrefs) => void
  onCreateClass: (studentId: string, schedules: ScheduleItem[]) => void
}

function getTeacherName(teachers: TeacherWithAvail[], teacherId?: string) {
  if (!teacherId) return '未指定'
  const teacher = teachers.find(t => t.id === teacherId)
  return teacher?.name || '未知'
}

export function ScheduleSidebar({
  collapsed,
  onToggleCollapse,
  students,
  teachers,
  scheduleDates,
  unscheduledStudents,
  onOpenPreferenceDialog,
  onCreateClass,
}: ScheduleSidebarProps) {
  if (collapsed) {
    return (
      <div className="w-10 border-l bg-muted/30 flex flex-col items-center pt-3 flex-shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title="展开排课面板"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="text-[10px] text-primary font-medium">{unscheduledStudents.length}</span>
          <span className="text-[9px] text-muted-foreground">待排</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 border-l bg-card flex flex-col flex-shrink-0">
      <div className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0">
        <span className="text-xs font-medium">待排课学员 ({unscheduledStudents.length})</span>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="收起面板"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {unscheduledStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            当前日期所有在读学员已排课 ✅
          </p>
        ) : (
          <div className="space-y-2">
            {unscheduledStudents.map(student => (
              <div key={student.id} className="p-2.5 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{student.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {student.grade} · {student.level === 'weak' ? '基础薄弱' : student.level === 'medium' ? '基础较好' : '非常优秀'}
                      {student.billing && ` · ${student.billing.remaining_hours}课时`}
                    </div>
                  </div>
                </div>
                {student.preferences.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {student.preferences.map(p => (
                      <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        {DAY_LABELS[p.day_of_week]} {p.preferred_start?.slice(0, 5)}-{p.preferred_end?.slice(0, 5)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 mt-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => onOpenPreferenceDialog(student)}>
                    <Settings className="h-3 w-3 mr-1" /> 时段
                  </Button>
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={() => {
                    let schedules: ScheduleItem[] = []
                    if (student.preferences.length > 0) {
                      student.preferences.forEach(pref => {
                        const matchingDate = scheduleDates.find(d => getDayOfWeek(d.date) === pref.day_of_week)
                        if (matchingDate) {
                          schedules.push({
                            id: generateId(),
                            date: matchingDate.date,
                            start_time: pref.preferred_start || '09:00',
                            end_time: pref.preferred_end || '11:00',
                            duration_hours: 2
                          })
                        }
                      })
                    }
                    if (schedules.length === 0) {
                      schedules = [{
                        id: generateId(),
                        date: scheduleDates[0]?.date || formatDateISO(new Date()),
                        start_time: '09:00',
                        end_time: '11:00',
                        duration_hours: 2
                      }]
                    }
                    onCreateClass(student.id, schedules)
                  }}>
                    <Plus className="h-3 w-3 mr-1" /> 排课
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
