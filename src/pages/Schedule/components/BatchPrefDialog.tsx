import { Check } from 'lucide-react'
import type { DayOfWeek, Student, Billing, StudentSchedulePreference } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DAY_LABELS } from '../types'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

interface BatchPrefDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: StudentWithPrefs[]
  batchSelectedStudents: string[]
  setBatchSelectedStudents: React.Dispatch<React.SetStateAction<string[]>>
  batchPrefForm: {
    day_of_week: DayOfWeek
    preferred_start: string
    preferred_end: string
    notes: string
    grade_filter: string
  }
  setBatchPrefForm: React.Dispatch<React.SetStateAction<{
    day_of_week: DayOfWeek
    preferred_start: string
    preferred_end: string
    notes: string
    grade_filter: string
  }>>
  batchSaving: boolean
  onSave: () => Promise<void>
}

export function BatchPrefDialog({
  open,
  onOpenChange,
  students,
  batchSelectedStudents,
  setBatchSelectedStudents,
  batchPrefForm,
  setBatchPrefForm,
  batchSaving,
  onSave
}: BatchPrefDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量设置学生时段偏好</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 时段设置 */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-3">
            <p className="text-sm font-medium">要添加的时段</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">星期</label>
                <Select
                  value={batchPrefForm.day_of_week}
                  onChange={e => setBatchPrefForm(prev => ({
                    ...prev,
                    day_of_week: e.target.value as DayOfWeek
                  }))}
                  options={[
                    { value: 'monday', label: '周一' },
                    { value: 'tuesday', label: '周二' },
                    { value: 'wednesday', label: '周三' },
                    { value: 'thursday', label: '周四' },
                    { value: 'friday', label: '周五' },
                    { value: 'saturday', label: '周六' },
                    { value: 'sunday', label: '周日' },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">开始时间</label>
                <Input
                  type="time"
                  value={batchPrefForm.preferred_start}
                  onChange={e => {
                    const start = e.target.value
                    const [h, m] = start.split(':').map(Number)
                    const endH = (h + 2).toString().padStart(2, '0')
                    const endM = m.toString().padStart(2, '0')
                    setBatchPrefForm(prev => ({
                      ...prev,
                      preferred_start: start,
                      preferred_end: `${endH}:${endM}`,
                    }))
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">结束时间</label>
                <Input
                  type="time"
                  value={batchPrefForm.preferred_end}
                  onChange={e => setBatchPrefForm(prev => ({
                    ...prev,
                    preferred_end: e.target.value
                  }))}
                />
              </div>
            </div>
          </div>

          {/* 年级快速筛选 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">按年级筛选：</span>
            {['all', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三', '大学'].map(grade => (
              <button
                key={grade}
                onClick={() => setBatchPrefForm(prev => ({ ...prev, grade_filter: grade }))}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  batchPrefForm.grade_filter === grade
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {grade === 'all' ? '全部' : grade}
              </button>
            ))}
          </div>

          {/* 学生多选列表 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                选择学生（已选 {batchSelectedStudents.length} 人）
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const filtered = students
                      .filter(s => batchPrefForm.grade_filter === 'all' ||
                        s.grade === batchPrefForm.grade_filter)
                      .map(s => s.id)
                    setBatchSelectedStudents(filtered)
                  }}
                >
                  全选
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchSelectedStudents([])}
                >
                  清空
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-auto border rounded-lg divide-y">
              {students
                .filter(s => batchPrefForm.grade_filter === 'all' ||
                  s.grade === batchPrefForm.grade_filter)
                .map(student => {
                  const isSelected = batchSelectedStudents.includes(student.id)
                  const existingPrefs = student.preferences.filter(
                    p => p.day_of_week === batchPrefForm.day_of_week
                  )
                  return (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setBatchSelectedStudents(prev =>
                        isSelected ? prev.filter(id => id !== student.id) : [...prev, student.id]
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <span className="text-sm font-medium">{student.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{student.grade}</span>
                        </div>
                      </div>
                      {existingPrefs.length > 0 && (
                        <div className="flex gap-1">
                          {existingPrefs.map(p => (
                            <span key={p.id} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {p.preferred_start?.slice(0, 5)}-{p.preferred_end?.slice(0, 5)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
            <p className="text-xs text-muted-foreground">
              已有相同星期+时间偏好的学生不会重复添加
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSave} disabled={batchSaving || batchSelectedStudents.length === 0}>
            {batchSaving ? '保存中...' : `确认添加到 ${batchSelectedStudents.length} 名学生`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}