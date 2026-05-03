import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Zap, Loader2, ChevronDown, ChevronUp, RefreshCw, Edit, Save, SkipForward, CheckCheck, Plus, FileText, BookOpen } from 'lucide-react'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { SortableTaskList } from '@/components/TaskBlock/SortableTaskList'
import type { Student, GradeType, TaskBlock as TaskBlockType, Wordbank, ClassRecord } from '@/types'
import { GRADE_OPTIONS } from '@/types'

// ===== Types =====

export type GenerationStatus = 'pending' | 'generating' | 'success' | 'failed' | 'saved' | 'skipped'

export interface StudentContext {
  lastRecord: ClassRecord | null
  lastRecordSummary: string | null
}

export interface StudentPlanState {
  student: Student
  status: GenerationStatus
  plan: {
    tasks: TaskBlockType[]
    notes: string
    reason: string
  } | null
  error: string | null
  expanded: boolean
  editing: boolean
  extraNote: string
  context?: StudentContext
}

// ===== StudentSelector =====

/** 智能筛选结果：有排课但无计划的学员 ID 集合 */
export interface SmartFilterResult {
  scheduledWithoutPlan: Set<string>
  loading: boolean
}

interface StudentSelectorProps {
  students: Student[]
  selectedStudents: StudentPlanState[]
  onSelectionChange: (selected: StudentPlanState[]) => void | Promise<void>
  onSmartFilter?: () => Promise<Student[]>
  smartFilterLoading?: boolean
  studentContextMap?: Map<string, StudentContext>
}

export function StudentSelector({ students, selectedStudents, onSelectionChange, onSmartFilter, smartFilterLoading, studentContextMap }: StudentSelectorProps) {
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [searchName, setSearchName] = useState('')

  const filteredStudents = students.filter(s => {
    if (s.status !== 'active') return false
    if (filterGrade !== 'all' && s.grade !== filterGrade) return false
    if (searchName && !s.name.includes(searchName)) return false
    return true
  })

  const toggleStudent = (student: Student) => {
    const exists = selectedStudents.find(s => s.student.id === student.id)
    if (exists) {
      onSelectionChange(selectedStudents.filter(s => s.student.id !== student.id))
    } else {
      onSelectionChange([...selectedStudents, {
        student,
        status: 'pending',
        plan: null,
        error: null,
        expanded: false,
        editing: false,
        extraNote: ''
      }])
    }
  }

  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(filteredStudents.map(student => ({
        student,
        status: 'pending',
        plan: null,
        error: null,
        expanded: false,
        editing: false,
        extraNote: ''
      })))
    }
  }

  const selectByGrade = (grade: string) => {
    const gradeStudents = filteredStudents.filter(s => s.grade === grade)
    const allGradeSelected = gradeStudents.every(student =>
      selectedStudents.some(s => s.student.id === student.id)
    )

    if (allGradeSelected) {
      onSelectionChange(selectedStudents.filter(s =>
        !gradeStudents.some(gs => gs.id === s.student.id)
      ))
    } else {
      const newSelection = [...selectedStudents]
      gradeStudents.forEach(student => {
        if (!newSelection.find(s => s.student.id === student.id)) {
          newSelection.push({
            student,
            status: 'pending',
            plan: null,
            error: null,
            expanded: false,
            editing: false,
            extraNote: ''
          })
        }
      })
      onSelectionChange(newSelection)
    }
  }

  const isGradeFullySelected = (grade: string) => {
    const gradeStudents = filteredStudents.filter(s => s.grade === grade)
    if (gradeStudents.length === 0) return false
    return gradeStudents.every(student =>
      selectedStudents.some(s => s.student.id === student.id)
    )
  }

  const isGradePartiallySelected = (grade: string) => {
    const gradeStudents = filteredStudents.filter(s => s.grade === grade)
    if (gradeStudents.length === 0) return false
    const selectedCount = gradeStudents.filter(student =>
      selectedStudents.some(s => s.student.id === student.id)
    ).length
    return selectedCount > 0 && selectedCount < gradeStudents.length
  }

  return (
    <div className="p-6 border-b">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">选择学员</h3>
        <div className="flex gap-2">
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="搜索姓名..."
            className="w-32"
          />
          <Select
            value={filterGrade}
            options={[
              { value: 'all', label: '全部年级' },
              ...GRADE_OPTIONS.map(g => ({ value: g, label: g }))
            ]}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="w-28"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={toggleSelectAll}>
          {selectedStudents.length === filteredStudents.length ? '取消全选' : '全选'}
        </Button>
        {onSmartFilter && (
          <Button variant="outline" size="sm" onClick={async () => {
              const matched = await onSmartFilter()
              if (matched.length === 0) return
              const newSelection: StudentPlanState[] = matched.map(student => ({
                student,
                status: 'pending',
                plan: null,
                error: null,
                expanded: false,
                editing: false,
                extraNote: '',
                context: studentContextMap?.get(student.id)
              }))
              onSelectionChange(newSelection)
            }}
            disabled={smartFilterLoading}
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            {smartFilterLoading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Zap className="w-3 h-3 mr-1" />
            )}
            有排课无计划
          </Button>
        )}
        {GRADE_OPTIONS.map(grade => {
          const fullySelected = isGradeFullySelected(grade)
          const partiallySelected = isGradePartiallySelected(grade)
          const gradeCount = filteredStudents.filter(s => s.grade === grade).length
          return (
            <button key={grade} onClick={() => selectByGrade(grade)}
              className={cn("px-3 py-1.5 rounded-md text-sm transition-colors relative",
                fullySelected ? "bg-primary text-primary-foreground"
                  : partiallySelected ? "bg-primary/20 text-primary border border-primary/50"
                  : "bg-muted hover:bg-muted/80",
                gradeCount === 0 && "opacity-40 cursor-not-allowed"
              )}
              disabled={gradeCount === 0}
            >
              {grade}
              {gradeCount > 0 && <span className={cn("ml-1 text-xs", fullySelected ? "text-primary-foreground/70" : "text-muted-foreground")}>({gradeCount})</span>}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-auto">
        {filteredStudents.map(student => {
          const isSelected = selectedStudents.some(s => s.student.id === student.id)
          return (
            <button key={student.id} onClick={() => toggleStudent(student)}
              className={cn("px-3 py-2 rounded-lg text-sm text-left transition-colors",
                isSelected ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted hover:bg-muted/80"
              )}
            >
              {student.name}
              <span className="text-xs text-muted-foreground ml-1">{student.grade}</span>
            </button>
          )
        })}
      </div>

      {selectedStudents.length > 0 && (
        <p className="text-sm text-muted-foreground mt-3">
          已选择 <span className="text-primary font-medium">{selectedStudents.length}</span> 名学员
        </p>
      )}
    </div>
  )
}

// ===== PlanResultCard =====

interface PlanResultCardProps {
  item: StudentPlanState
  wordbanks: Wordbank[]
  onToggleExpand: (studentId: string) => void
  onToggleEditing: (studentId: string) => void
  onRegenerate: (studentId: string) => void
  onSave: (studentId: string) => void
  onSkip: (studentId: string) => void
  onUpdateExtraNote: (studentId: string, note: string) => void
  onUpdateTask: (studentId: string, taskIndex: number, updatedTask: TaskBlockType) => void
  onDeleteTask: (studentId: string, taskIndex: number) => void
  onAddTask: (studentId: string) => void
  onReorderTasks: (studentId: string, tasks: TaskBlockType[]) => void
  onUpdateNotes: (studentId: string, notes: string) => void
  onUpdateReason: (studentId: string, reason: string) => void
}

export function PlanResultCard({
  item, wordbanks, onToggleExpand, onToggleEditing, onRegenerate, onSave, onSkip,
  onUpdateExtraNote, onUpdateTask, onDeleteTask, onAddTask, onReorderTasks, onUpdateNotes, onUpdateReason
}: PlanResultCardProps) {
  return (
    <Card className={cn(
      item.status === 'failed' && "border-red-300",
      item.status === 'saved' && "border-green-300"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              item.status === 'pending' && "bg-gray-400",
              item.status === 'generating' && "bg-blue-500 animate-pulse",
              item.status === 'success' && "bg-green-500",
              item.status === 'failed' && "bg-red-500",
              item.status === 'saved' && "bg-green-600",
              item.status === 'skipped' && "bg-gray-300"
            )} />
            <span className="font-medium">{item.student.name}</span>
            <span className="text-sm text-muted-foreground">{item.student.grade}</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded",
              item.status === 'pending' && "bg-gray-100 text-gray-600",
              item.status === 'generating' && "bg-blue-100 text-blue-600",
              item.status === 'success' && "bg-green-100 text-green-600",
              item.status === 'failed' && "bg-red-100 text-red-600",
              item.status === 'saved' && "bg-green-200 text-green-700",
              item.status === 'skipped' && "bg-gray-100 text-gray-500"
            )}>
              {item.status === 'pending' && '等待中'}
              {item.status === 'generating' && '生成中...'}
              {item.status === 'success' && '已完成'}
              {item.status === 'failed' && '失败'}
              {item.status === 'saved' && '已保存'}
              {item.status === 'skipped' && '已跳过'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(item.status === 'pending' || item.status === 'failed') && (
              <div className="flex items-center gap-2 flex-1 max-w-[300px]">
                <span className="text-xs text-muted-foreground whitespace-nowrap">附加提示：</span>
                <Input value={item.extraNote} onChange={(e) => onUpdateExtraNote(item.student.id, e.target.value)}
                  placeholder="可选，如：本次重点推进词库" className="h-7 text-xs"
                  onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
              </div>
            )}
            {item.status === 'success' && (
              <>
                <Button variant="ghost" size="sm" onClick={() => onToggleExpand(item.student.id)}>
                  {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                {item.expanded && !item.editing && (
                  <Button variant="outline" size="sm" onClick={() => onToggleEditing(item.student.id)}>
                    <Edit className="w-3 h-3 mr-1" />编辑
                  </Button>
                )}
                {item.expanded && item.editing && (
                  <Button variant="outline" size="sm" onClick={() => onToggleEditing(item.student.id)}>
                    <CheckCheck className="w-3 h-3 mr-1" />完成编辑
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => onRegenerate(item.student.id)}>
                  <RefreshCw className="w-3 h-3 mr-1" />重新生成
                </Button>
                <Button size="sm" onClick={() => onSave(item.student.id)}>
                  <Save className="w-3 h-3 mr-1" />保存
                </Button>
              </>
            )}
            {item.status === 'failed' && (
              <>
                <span className="text-xs text-red-600">{item.error}</span>
                <Button variant="outline" size="sm" onClick={() => onRegenerate(item.student.id)}>
                  <RefreshCw className="w-3 h-3 mr-1" />重试
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSkip(item.student.id)}>
                  <SkipForward className="w-3 h-3 mr-1" />跳过
                </Button>
              </>
            )}
            {item.status === 'generating' && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>
        </div>

        {(item.student.notes || item.context?.lastRecordSummary) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.student.notes && (
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{item.student.notes}</span>
            )}
            {item.context?.lastRecordSummary && (
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{item.context.lastRecordSummary}</span>
            )}
          </div>
        )}

        {item.expanded && item.plan && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">任务列表：</p>
                {item.editing && (
                  <Button variant="outline" size="sm" onClick={() => onAddTask(item.student.id)}>
                    <Plus className="w-3 h-3 mr-1" />添加任务
                  </Button>
                )}
              </div>
              {item.editing ? (
                <>
                  {item.plan.tasks.length > 0 ? (
                    <SortableTaskList
                      tasks={item.plan.tasks} compact wordbanks={wordbanks}
                      onTasksChange={(newTasks) => onReorderTasks(item.student.id, newTasks)}
                      onUpdateTask={(idx, updatedTask) => onUpdateTask(item.student.id, idx, updatedTask)}
                      onDeleteTask={(idx) => onDeleteTask(item.student.id, idx)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无任务，点击上方按钮添加</p>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {item.plan.tasks.map((task, idx) => (
                    <TaskBlock key={idx} task={task} index={idx} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">助教提示：</p>
              {item.editing ? (
                <textarea className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-y"
                  value={item.plan.notes || ''} onChange={(e) => onUpdateNotes(item.student.id, e.target.value)}
                  placeholder="输入助教提示..." />
              ) : (
                <p className="text-sm">{item.plan.notes || '无'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">计划说明：</p>
              {item.editing ? (
                <textarea className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-y"
                  value={item.plan.reason || ''} onChange={(e) => onUpdateReason(item.student.id, e.target.value)}
                  placeholder="输入计划说明..." />
              ) : (
                <p className="text-sm">{item.plan.reason || '无'}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
