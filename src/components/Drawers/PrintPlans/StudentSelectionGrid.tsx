import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { cn } from '@/lib/utils'
import type { Student, LessonPlan } from '@/types'

export interface StudentWithPlan {
  student: Student
  plans: LessonPlan[]
  selected: boolean
}

interface StudentSelectionGridProps {
  filteredStudents: StudentWithPlan[]
  loading: boolean
  grades: (string | null)[]
  filterGrade: string
  searchName: string
  selectedCount: number
  selectedWithPlansCount: number
  onFilterGradeChange: (grade: string) => void
  onSearchNameChange: (name: string) => void
  onToggleStudent: (studentId: string) => void
  onToggleSelectAll: () => void
}

export function StudentSelectionGrid({
  filteredStudents, loading, grades, filterGrade, searchName,
  selectedCount, selectedWithPlansCount,
  onFilterGradeChange, onSearchNameChange, onToggleStudent, onToggleSelectAll
}: StudentSelectionGridProps) {
  return (
    <div className="p-6 border-b">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">选择学员</h3>
        <Input
          value={searchName}
          onChange={(e) => onSearchNameChange(e.target.value)}
          placeholder="搜索姓名..."
          className="w-32"
        />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Button
          variant={filterGrade === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onFilterGradeChange('all')}
        >
          全部
        </Button>
        {grades.map(grade => (
          <Button
            key={grade}
            variant={filterGrade === grade ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onFilterGradeChange(grade!)}
          >
            {grade}
          </Button>
        ))}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={onToggleSelectAll}>
            {filteredStudents.every(item => item.selected) ? '取消全选' : '全选'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 max-h-48 overflow-auto">
        {loading ? (
          <div className="col-span-5 flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          filteredStudents.map(item => (
            <button
              key={item.student.id}
              onClick={() => onToggleStudent(item.student.id)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm text-left transition-colors relative",
                item.selected
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted hover:bg-muted/80",
                item.plans.length === 0 && "opacity-60"
              )}
            >
              {item.selected && (
                <Check className="w-3 h-3 absolute top-1 right-1 text-primary" />
              )}
              {item.student.name}
              <span className="text-xs text-muted-foreground ml-1">{item.student.grade}</span>
              {item.plans.length === 0 && (
                <span className="text-xs text-yellow-600 block">无计划</span>
              )}
              {item.plans.length > 0 && (
                <span className="text-xs text-green-600 block">{item.plans.length}条计划</span>
              )}
            </button>
          ))
        )}
      </div>

      {selectedCount > 0 && (
        <p className="text-sm text-muted-foreground mt-3">
          已选择 <span className="text-primary font-medium">{selectedCount}</span> 名学员
          （{selectedWithPlansCount} 人有计划）
        </p>
      )}
    </div>
  )
}
