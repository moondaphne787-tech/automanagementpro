import type { Student, Teacher, Billing, StudentSchedulePreference, ScheduledClass } from '@/types'
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

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

interface ClassForm {
  student_id: string
  teacher_id: string
  class_date: string
  start_time: string
  end_time: string
  notes: string
}

interface ClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingClass: ScheduledClass | null
  classForm: ClassForm
  setClassForm: React.Dispatch<React.SetStateAction<ClassForm>>
  students: StudentWithPrefs[]
  teachers: Teacher[]
  saving: boolean
  onSave: () => Promise<void>
}

export function ClassDialog({
  open,
  onOpenChange,
  editingClass,
  classForm,
  setClassForm,
  students,
  teachers,
  saving,
  onSave
}: ClassDialogProps) {
  const studentOptions = students.map(s => ({
    value: s.id,
    label: `${s.name} (${s.grade || '未设年级'})${s.billing ? ` - 剩余${s.billing.remaining_hours}课时` : ''}`
  }))

  const teacherOptions = [
    { value: '', label: '不指定助教' },
    ...teachers.map(t => ({ value: t.id, label: t.name }))
  ]

  const handleStartTimeChange = (value: string) => {
    const [hours] = value.split(':').map(Number)
    const endTime = `${(hours + 2).toString().padStart(2, '0')}:00`
    setClassForm(prev => ({ ...prev, start_time: value, end_time: endTime }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingClass ? '编辑课程' : '新增排课'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">学员 *</label>
            <Select
              value={classForm.student_id}
              onChange={e => setClassForm(prev => ({ ...prev, student_id: e.target.value }))}
              options={studentOptions}
              placeholder="选择学员"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">助教</label>
            <Select
              value={classForm.teacher_id}
              onChange={e => setClassForm(prev => ({ ...prev, teacher_id: e.target.value }))}
              options={teacherOptions}
              placeholder="选择助教（可选）"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">日期 *</label>
            <Input
              type="date"
              value={classForm.class_date}
              onChange={e => setClassForm(prev => ({ ...prev, class_date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">开始时间</label>
              <Input
                type="time"
                value={classForm.start_time}
                onChange={e => handleStartTimeChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">结束时间</label>
              <Input
                type="time"
                value={classForm.end_time}
                onChange={e => setClassForm(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">备注</label>
            <Input
              value={classForm.notes}
              onChange={e => setClassForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="可选备注"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
