import { useState } from 'react'
import { Plus, Settings, Sparkles, AlertCircle, Check, BookOpen, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Student, Teacher, Billing, StudentSchedulePreference, TeacherAvailability, DayOfWeek } from '@/types'
import type { AIScheduleResult, ScheduleDateConfig } from '@/ai/schedulePrompts'
import { DAY_LABELS, formatDate, formatDisplayDate, getDayOfWeek, type ScheduleItem } from './types'
import { generateId } from '@/db/utils'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
type TeacherWithAvail = Teacher & { availabilities: TeacherAvailability[] }

interface ArrangeViewProps {
  students: StudentWithPrefs[]
  teachers: TeacherWithAvail[]
  scheduleDates: ScheduleDateConfig[]
  unscheduledStudents: StudentWithPrefs[]
  onOpenPreferenceDialog: (student: StudentWithPrefs) => void
  onCreateClass: (studentId: string, schedules: ScheduleItem[]) => void
  // AI排课相关
  aiScheduling: boolean
  aiResults: AIScheduleResult[]
  aiConflicts: AIScheduleResult[]
  aiError: string | null
  selectedAiResults: Set<string>
  extraInstructions: string
  setExtraInstructions: React.Dispatch<React.SetStateAction<string>>
  onAISchedule: () => Promise<void>
  onToggleAiResultSelection: (studentId: string) => void
  onConfirmAISchedule: () => Promise<void>
  saving: boolean
}

// 获取日期显示图标
function getDateIcon(type: ScheduleDateConfig['type']) {
  switch (type) {
    case 'friday_evening':
      return '🌙'
    case 'holiday':
      return '☀️'
    default:
      return '☀️'
  }
}

// 根据老师ID获取名字
function getTeacherName(teachers: TeacherWithAvail[], teacherId?: string) {
  if (!teacherId) return '未指定'
  const teacher = teachers.find(t => t.id === teacherId)
  return teacher?.name || '未知'
}

export function ArrangeView({
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
  onToggleAiResultSelection,
  onConfirmAISchedule,
  saving
}: ArrangeViewProps) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" /> 待排课学员
            </h2>
            <span className="text-sm text-muted-foreground">共 {unscheduledStudents.length} 人</span>
          </div>

          {unscheduledStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">当前日期所有在读学员已排课</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {unscheduledStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {student.grade} · {student.level === 'weak' ? '基础薄弱' : student.level === 'medium' ? '基础较好' : '非常优秀'}
                      {student.billing && ` · 剩余${student.billing.remaining_hours}课时`}
                    </div>
                    {student.preferences.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {student.preferences.map(p => (
                          <span key={p.id} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            {DAY_LABELS[p.day_of_week]} {p.preferred_start?.slice(0, 5)}-{p.preferred_end?.slice(0, 5)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenPreferenceDialog(student)}>
                      <Settings className="h-4 w-4 mr-1" /> 时段
                    </Button>
                    <Button size="sm" onClick={() => {
                      // 根据学生偏好生成排课项
                      let schedules: ScheduleItem[] = []

                      if (student.preferences.length > 0) {
                        // 有偏好：为每个偏好创建一个排课项，匹配对应的日期
                        student.preferences.forEach(pref => {
                          // 找到匹配的排课日期（根据星期几）
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

                      // 如果没有匹配到任何偏好日期，使用第一个排课日期
                      if (schedules.length === 0) {
                        schedules = [{
                          id: generateId(),
                          date: scheduleDates[0]?.date || formatDate(new Date()),
                          start_time: '09:00',
                          end_time: '11:00',
                          duration_hours: 2
                        }]
                      }

                      onCreateClass(student.id, schedules)
                    }}>
                      <Plus className="h-4 w-4 mr-1" /> 排课
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI 智能排课
            </h2>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-primary/5 rounded-lg text-sm">
              <p className="text-muted-foreground">
                AI 将根据学员时段偏好和助教可用时段，自动生成最优排课方案。
              </p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium mb-2">排课日期</div>
              {scheduleDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">请先添加排课日期</p>
              ) : (
                <div className="space-y-1">
                  {scheduleDates.map(d => (
                    <div key={d.date} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{getDateIcon(d.type)}</span>
                      <span>{d.label} ({formatDisplayDate(new Date(d.date))})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">额外说明（可选）</label>
              <textarea
                className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                value={extraInstructions}
                onChange={e => setExtraInstructions(e.target.value)}
                placeholder="例如：优先安排初二学生..."
              />
            </div>

            <Button className="w-full" onClick={onAISchedule} disabled={aiScheduling || unscheduledStudents.length === 0 || scheduleDates.length === 0}>
              {aiScheduling ? (
                <><Sparkles className="h-4 w-4 mr-2 animate-pulse" /> AI 正在排课...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> 开始 AI 排课</>
              )}
            </Button>

            {aiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {aiError}
              </div>
            )}

            {aiResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">排课结果</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onToggleAiResultSelection('all')}>全选</Button>
                    <Button variant="outline" size="sm" onClick={() => onToggleAiResultSelection('none')}>清空</Button>
                  </div>
                </div>

                {aiConflicts.length > 0 && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    ⚠️ {aiConflicts.length} 个结果存在时段冲突，已自动排除
                  </div>
                )}

                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {aiResults.map((result, index) => {
                    const student = students.find(s => s.id === result.student_id)
                    const isSelected = selectedAiResults.has(result.student_id)

                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          result.unmatched ? 'bg-red-50 border-red-200' : isSelected ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-transparent'
                        } ${!result.unmatched ? 'cursor-pointer' : ''}`}
                        onClick={() => !result.unmatched && onToggleAiResultSelection(result.student_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {!result.unmatched && (
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                            )}
                            <span className="font-medium">{student?.name || '未知学员'}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${result.unmatched ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {result.unmatched ? '无法匹配' : '已匹配'}
                          </span>
                        </div>
                        {!result.unmatched && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            <div>{result.date} · {result.start_time.slice(0, 5)}-{result.end_time.slice(0, 5)}</div>
                            <div>助教：{getTeacherName(teachers, result.teacher_id)} · {result.duration_hours}小时</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <Button className="w-full" onClick={onConfirmAISchedule} disabled={selectedAiResults.size === 0 || saving}>
                  {saving ? <><Sparkles className="h-4 w-4 mr-2 animate-pulse" /> 保存中...</> : <><Check className="h-4 w-4 mr-2" /> 确认保存 {selectedAiResults.size} 个排课</>}
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5" /> 助教可用时段
          </h2>

          {teachers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无在职助教</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map(teacher => (
                <div key={teacher.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{teacher.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      teacher.training_stage === 'formal' ? 'bg-green-100 text-green-700' :
                      teacher.training_stage === 'intern' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {teacher.training_stage === 'formal' ? '正式' : teacher.training_stage === 'intern' ? '实习' : '实训'}
                    </span>
                  </div>
                  {teacher.availabilities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">未设置可用时段</p>
                  ) : (
                    <div className="space-y-1">
                      {teacher.availabilities.map(a => (
                        <div key={a.id} className="text-xs text-muted-foreground">
                          {DAY_LABELS[a.day_of_week]} {a.start_time?.slice(0, 5)}-{a.end_time?.slice(0, 5)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}