import { useState } from 'react'
import { Plus, Settings, Sparkles, AlertCircle, Check, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Student, Teacher, Billing, StudentSchedulePreference, TeacherAvailability } from '@/types'
import type { AIScheduleResult, ScheduleDateConfig } from '@/ai/schedulePrompts'
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
  // AI 排课
  aiScheduling: boolean
  aiResults: AIScheduleResult[]
  aiConflicts: AIScheduleResult[]
  aiError: string | null
  selectedAiResults: Set<string>
  extraInstructions: string
  setExtraInstructions: React.Dispatch<React.SetStateAction<string>>
  onAISchedule: () => Promise<void>
  onSelectAllAiResults: () => void
  onClearAiResultSelection: () => void
  onToggleAiResult: (studentId: string) => void
  onConfirmAISchedule: () => Promise<void>
  saving: boolean
}

function getTeacherName(teachers: TeacherWithAvail[], teacherId?: string) {
  if (!teacherId) return '未指定'
  const teacher = teachers.find(t => t.id === teacherId)
  return teacher?.name || '未知'
}

function getDateIcon(type: ScheduleDateConfig['type']) {
  switch (type) {
    case 'friday_evening': return '🌙'
    default: return '☀️'
  }
}

function formatDisplayDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
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
  aiScheduling,
  aiResults,
  aiConflicts,
  aiError,
  selectedAiResults,
  extraInstructions,
  setExtraInstructions,
  onAISchedule,
  onSelectAllAiResults,
  onClearAiResultSelection,
  onToggleAiResult,
  onConfirmAISchedule,
  saving
}: ScheduleSidebarProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'ai'>('students')

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
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center" title="待排课学员">
            <Users className="h-3 w-3 text-primary" />
          </div>
          <span className="text-[10px] text-primary font-medium">{unscheduledStudents.length}</span>
        </div>
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center" title="AI 排课">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 border-l bg-card flex flex-col flex-shrink-0">
      {/* 头部 */}
      <div className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex bg-muted rounded p-0.5">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeTab === 'students' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3 w-3 inline mr-1" />
            待排课 ({unscheduledStudents.length})
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeTab === 'ai' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-3 w-3 inline mr-1" />
            AI 排课
          </button>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="收起面板"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'students' ? (
          <StudentsList
            students={students}
            teachers={teachers}
            scheduleDates={scheduleDates}
            unscheduledStudents={unscheduledStudents}
            onOpenPreferenceDialog={onOpenPreferenceDialog}
            onCreateClass={onCreateClass}
          />
        ) : (
          <AISchedulePanel
            students={students}
            teachers={teachers}
            scheduleDates={scheduleDates}
            unscheduledStudents={unscheduledStudents}
            aiScheduling={aiScheduling}
            aiResults={aiResults}
            aiConflicts={aiConflicts}
            aiError={aiError}
            selectedAiResults={selectedAiResults}
            extraInstructions={extraInstructions}
            setExtraInstructions={setExtraInstructions}
            onAISchedule={onAISchedule}
            onSelectAllAiResults={onSelectAllAiResults}
            onClearAiResultSelection={onClearAiResultSelection}
            onToggleAiResult={onToggleAiResult}
            onConfirmAISchedule={onConfirmAISchedule}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}

// 待排课学员列表
function StudentsList({
  students,
  teachers,
  scheduleDates,
  unscheduledStudents,
  onOpenPreferenceDialog,
  onCreateClass
}: {
  students: StudentWithPrefs[]
  teachers: TeacherWithAvail[]
  scheduleDates: ScheduleDateConfig[]
  unscheduledStudents: StudentWithPrefs[]
  onOpenPreferenceDialog: (student: StudentWithPrefs) => void
  onCreateClass: (studentId: string, schedules: ScheduleItem[]) => void
}) {
  if (unscheduledStudents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        当前日期所有在读学员已排课 ✅
      </p>
    )
  }

  return (
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
                  const matchingDate = scheduleDates.find(d => {
                    const dayOfWeek = getDayOfWeek(d.date)
                    return dayOfWeek === pref.day_of_week
                  })
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
  )
}

// AI 排课面板
function AISchedulePanel({
  students,
  teachers,
  scheduleDates,
  unscheduledStudents,
  aiScheduling,
  aiResults,
  aiConflicts,
  aiError,
  selectedAiResults,
  extraInstructions,
  setExtraInstructions,
  onAISchedule,
  onSelectAllAiResults,
  onClearAiResultSelection,
  onToggleAiResult,
  onConfirmAISchedule,
  saving
}: {
  students: StudentWithPrefs[]
  teachers: TeacherWithAvail[]
  scheduleDates: ScheduleDateConfig[]
  unscheduledStudents: StudentWithPrefs[]
  aiScheduling: boolean
  aiResults: AIScheduleResult[]
  aiConflicts: AIScheduleResult[]
  aiError: string | null
  selectedAiResults: Set<string>
  extraInstructions: string
  setExtraInstructions: React.Dispatch<React.SetStateAction<string>>
  onAISchedule: () => Promise<void>
  onSelectAllAiResults: () => void
  onClearAiResultSelection: () => void
  onToggleAiResult: (studentId: string) => void
  onConfirmAISchedule: () => Promise<void>
  saving: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="p-2.5 bg-primary/5 rounded-lg text-xs text-muted-foreground">
        AI 将根据学员时段偏好和助教可用时段，自动生成最优排课方案。
      </div>

      <div className="p-2.5 bg-muted/50 rounded-lg">
        <div className="text-xs font-medium mb-1.5">排课日期</div>
        {scheduleDates.length === 0 ? (
          <p className="text-xs text-muted-foreground">请先添加排课日期</p>
        ) : (
          <div className="space-y-0.5">
            {scheduleDates.map(d => (
              <div key={d.date} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>{getDateIcon(d.type)}</span>
                <span>{d.label} ({formatDisplayDate(new Date(d.date))})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium">额外说明（可选）</label>
        <textarea
          className="w-full min-h-[50px] px-2.5 py-2 rounded-md border border-input bg-background text-xs resize-none"
          value={extraInstructions}
          onChange={e => setExtraInstructions(e.target.value)}
          placeholder="例如：优先安排初二学生..."
        />
      </div>

      <Button
        className="w-full h-8 text-xs"
        onClick={onAISchedule}
        disabled={aiScheduling || unscheduledStudents.length === 0 || scheduleDates.length === 0}
      >
        {aiScheduling ? (
          <><Sparkles className="h-3 w-3 mr-1.5 animate-pulse" /> AI 正在排课...</>
        ) : (
          <><Sparkles className="h-3 w-3 mr-1.5" /> 开始 AI 排课</>
        )}
      </Button>

      {aiError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          {aiError}
        </div>
      )}

      {aiResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium">排课结果</h3>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={onSelectAllAiResults}>全选</Button>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={onClearAiResultSelection}>清空</Button>
            </div>
          </div>

          {aiConflicts.length > 0 && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-[11px] text-yellow-700">
              ⚠️ {aiConflicts.length} 个结果存在时段冲突，已自动排除
            </div>
          )}

          <div className="space-y-1.5 max-h-[250px] overflow-auto">
            {aiResults.map((result, index) => {
              const student = students.find(s => s.id === result.student_id)
              const isSelected = selectedAiResults.has(result.student_id)

              return (
                <div
                  key={index}
                  className={`p-2.5 rounded-lg border text-xs ${
                    result.unmatched ? 'bg-red-50 border-red-200' : isSelected ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-transparent'
                  } ${!result.unmatched ? 'cursor-pointer' : ''}`}
                  onClick={() => !result.unmatched && onToggleAiResult(result.student_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {!result.unmatched && (
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                      )}
                      <span className="font-medium">{student?.name || '未知学员'}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${result.unmatched ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {result.unmatched ? '无法匹配' : '已匹配'}
                    </span>
                  </div>
                  {!result.unmatched && (
                    <div className="mt-1 text-muted-foreground">
                      <div>{result.date} · {result.start_time.slice(0, 5)}-{result.end_time.slice(0, 5)}</div>
                      <div>助教：{getTeacherName(teachers, result.teacher_id)} · {result.duration_hours}h</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <Button
            className="w-full h-8 text-xs"
            onClick={onConfirmAISchedule}
            disabled={selectedAiResults.size === 0 || saving}
          >
            {saving ? (
              <><Sparkles className="h-3 w-3 mr-1.5 animate-pulse" /> 保存中...</>
            ) : (
              <><Check className="h-3 w-3 mr-1.5" /> 确认保存 {selectedAiResults.size} 个排课</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
