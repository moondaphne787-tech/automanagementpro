import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Zap, Loader2 } from 'lucide-react'
import type { Student, GradeType } from '@/types'
import { GRADE_OPTIONS } from '@/types'
import type { StudentPlanState, StudentContext } from './PlanResultCard'

/** 智能筛选结果：有排课但无计划的学员 ID 集合 */
export interface SmartFilterResult {
  /** 有排课但无计划的学员 ID */
  scheduledWithoutPlan: Set<string>
  loading: boolean
}

interface StudentSelectorProps {
  students: Student[]
  selectedStudents: StudentPlanState[]
  onSelectionChange: (selected: StudentPlanState[]) => void | Promise<void>
  /** 智能筛选：自动选中有排课但无计划的学员 */
  onSmartFilter?: () => Promise<Student[]>
  smartFilterLoading?: boolean
  /** 学员上下文数据（备注+上次课堂记录），由父组件提供 */
  studentContextMap?: Map<string, StudentContext>
}

export function StudentSelector({ students, selectedStudents, onSelectionChange, onSmartFilter, smartFilterLoading, studentContextMap }: StudentSelectorProps) {
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [searchName, setSearchName] = useState('')

  // 过滤学员列表
  const filteredStudents = students.filter(s => {
    if (s.status !== 'active') return false
    if (filterGrade !== 'all' && s.grade !== filterGrade) return false
    if (searchName && !s.name.includes(searchName)) return false
    return true
  })

  // 切换学员选择
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

  // 全选/取消全选
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

  // 按年级全选/取消全选
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

  // 检查某年级是否全部选中
  const isGradeFullySelected = (grade: string) => {
    const gradeStudents = filteredStudents.filter(s => s.grade === grade)
    if (gradeStudents.length === 0) return false
    return gradeStudents.every(student =>
      selectedStudents.some(s => s.student.id === student.id)
    )
  }

  // 检查某年级是否部分选中
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

      {/* 全选按钮 + 智能筛选 */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSelectAll}
        >
          {selectedStudents.length === filteredStudents.length ? '取消全选' : '全选'}
        </Button>
        {onSmartFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
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
            <button
              key={grade}
              onClick={() => selectByGrade(grade)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors relative",
                fullySelected
                  ? "bg-primary text-primary-foreground"
                  : partiallySelected
                    ? "bg-primary/20 text-primary border border-primary/50"
                    : "bg-muted hover:bg-muted/80",
                gradeCount === 0 && "opacity-40 cursor-not-allowed"
              )}
              disabled={gradeCount === 0}
            >
              {grade}
              {gradeCount > 0 && (
                <span className={cn(
                  "ml-1 text-xs",
                  fullySelected ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  ({gradeCount})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 学员列表 */}
      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-auto">
        {filteredStudents.map(student => {
          const isSelected = selectedStudents.some(s => s.student.id === student.id)
          return (
            <button
              key={student.id}
              onClick={() => toggleStudent(student)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm text-left transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {student.name}
              <span className="text-xs text-muted-foreground ml-1">
                {student.grade}
              </span>
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