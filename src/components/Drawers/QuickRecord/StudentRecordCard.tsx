import { Check, Copy, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { TaskBlock, createEmptyTask } from '@/components/TaskBlock/TaskBlock'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type {
  TaskBlock as TaskBlockType,
  AttendanceType,
  TaskCompletedType,
  PerformanceType,
  Student,
  Teacher,
  LessonPlan,
  ScheduledClass,
  Wordbank
} from '@/types'

export interface StudentScheduleInfo {
  student: Student
  schedule: ScheduledClass & { student?: Student; teacher?: Teacher }
  plan?: LessonPlan
  selected: boolean
  attendance: AttendanceType
  taskCompleted: TaskCompletedType
  performance: PerformanceType
  durationHours: number
  teacherName: string
  tasks: TaskBlockType[]
  hasPlan: boolean
}

interface StudentRecordCardProps {
  info: StudentScheduleInfo
  index: number
  isExpanded: boolean
  wordbanks: Wordbank[]
  onToggleSelect: (index: number) => void
  onToggleExpand: (studentId: string) => void
  onCopyFromPlan: (index: number) => void
  onUpdateTasks: (index: number, tasks: TaskBlockType[]) => void
  onUpdateInfo: (index: number, updates: Partial<StudentScheduleInfo>) => void
}

function getTasksSummary(tasks: TaskBlockType[]) {
  if (tasks.length === 0) return '暂无任务'
  return tasks.map(t => {
    const label = TASK_TYPE_LABELS[t.type] || t.type
    const content = t.content ? `·${t.content.slice(0, 15)}${t.content.length > 15 ? '…' : ''}` : ''
    return `${label}${content}`
  }).join(' | ')
}

export function StudentRecordCard({
  info, index, isExpanded, wordbanks,
  onToggleSelect, onToggleExpand, onCopyFromPlan, onUpdateTasks, onUpdateInfo
}: StudentRecordCardProps) {
  return (
    <Card className={cn("transition-all", info.selected && "border-primary")}>
      <CardContent className={cn("p-4", isExpanded ? "space-y-4" : "space-y-2")}>
        {/* 学员标题行 */}
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => onToggleSelect(index)}
          >
            <div className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
              info.selected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground"
            )}>
              {info.selected && <Check className="w-3 h-3" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{info.student.name}</span>
              <span className="text-sm text-muted-foreground">{info.student.grade}</span>
              {info.hasPlan && (
                <span className="text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">
                  📋有计划
                </span>
              )}
              {info.schedule.start_time && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {info.schedule.start_time}
                  {info.schedule.end_time && `-${info.schedule.end_time}`}
                </span>
              )}
            </div>
          </div>

          {info.hasPlan && !isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 shrink-0"
              onClick={() => onCopyFromPlan(index)}
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              复制计划
            </Button>
          )}
        </div>

        {/* 折叠态 */}
        {!isExpanded && (
          <>
            <div className="pl-8 text-xs text-muted-foreground truncate">
              {getTasksSummary(info.tasks)}
            </div>
            <div className="flex items-center gap-2 pl-8">
              <Select
                value={info.durationHours.toString()}
                options={[
                  { value: '0.5', label: '0.5h' },
                  { value: '1', label: '1h' },
                  { value: '1.5', label: '1.5h' },
                  { value: '2', label: '2h' }
                ]}
                onChange={(e) => onUpdateInfo(index, { durationHours: parseFloat(e.target.value) })}
              />
              <Select
                value={info.attendance}
                options={[
                  { value: 'present', label: '到课' },
                  { value: 'late', label: '迟到' },
                  { value: 'absent', label: '缺课' }
                ]}
                onChange={(e) => onUpdateInfo(index, { attendance: e.target.value as AttendanceType })}
              />
              <Select
                value={info.taskCompleted}
                options={[
                  { value: 'completed', label: '全部完成' },
                  { value: 'partial', label: '部分完成' },
                  { value: 'not_completed', label: '未完成' }
                ]}
                onChange={(e) => onUpdateInfo(index, { taskCompleted: e.target.value as TaskCompletedType })}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 ml-auto shrink-0"
                onClick={() => onToggleExpand(info.student.id)}
              >
                <ChevronDown className="w-4 h-4 mr-1" />
                展开
              </Button>
            </div>
          </>
        )}

        {/* 展开态 */}
        {isExpanded && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted-foreground">学习任务</label>
                <div className="flex items-center gap-1">
                  {info.hasPlan && (
                    <Button variant="ghost" size="sm" onClick={() => onCopyFromPlan(index)}>
                      <Copy className="w-4 h-4 mr-1" />
                      从计划复制
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateTasks(index, [...info.tasks, createEmptyTask()])}
                    disabled={info.tasks.length >= 4}
                  >
                    添加任务
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {info.tasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">
                    暂无任务，点击"从计划复制"或"添加任务"
                  </div>
                ) : (
                  info.tasks.map((task, taskIndex) => (
                    <TaskBlock
                      key={taskIndex}
                      task={task}
                      index={taskIndex}
                      editable
                      compact
                      wordbanks={wordbanks}
                      onChange={(updated) => {
                        const newTasks = [...info.tasks]
                        newTasks[taskIndex] = updated
                        onUpdateTasks(index, newTasks)
                      }}
                      onDelete={info.tasks.length > 1 ? () => {
                        onUpdateTasks(index, info.tasks.filter((_, i) => i !== taskIndex))
                      } : undefined}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">课时时长</label>
                <Select
                  value={info.durationHours.toString()}
                  options={[
                    { value: '0.5', label: '0.5小时' },
                    { value: '1', label: '1小时' },
                    { value: '1.5', label: '1.5小时' },
                    { value: '2', label: '2小时' }
                  ]}
                  onChange={(e) => onUpdateInfo(index, { durationHours: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">出勤状态</label>
                <Select
                  value={info.attendance}
                  options={[
                    { value: 'present', label: '到课' },
                    { value: 'late', label: '迟到' },
                    { value: 'absent', label: '缺课' }
                  ]}
                  onChange={(e) => onUpdateInfo(index, { attendance: e.target.value as AttendanceType })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">完成状态</label>
                <Select
                  value={info.taskCompleted}
                  options={[
                    { value: 'completed', label: '全部完成' },
                    { value: 'partial', label: '部分完成' },
                    { value: 'not_completed', label: '未完成' }
                  ]}
                  onChange={(e) => onUpdateInfo(index, { taskCompleted: e.target.value as TaskCompletedType })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => onToggleExpand(info.student.id)}
              >
                <ChevronUp className="w-4 h-4 mr-1" />
                收起
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
