import { Plus, X } from 'lucide-react'
import type { ScheduledClass, Student, Teacher, Billing, StudentSchedulePreference } from '@/types'
import type { ScheduleDateConfig } from '../types'
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
import { generateId } from '@/db/utils'
import type { ScheduleItem } from '../types'
import { formatDisplayDate } from '../types'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

interface ClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingClass: ScheduledClass | null
  classForm: {
    student_id: string
    teacher_id: string
    schedules: ScheduleItem[]
    notes: string
  }
  setClassForm: React.Dispatch<React.SetStateAction<{
    student_id: string
    teacher_id: string
    schedules: ScheduleItem[]
    notes: string
  }>>
  students: StudentWithPrefs[]
  teachers: Teacher[]
  scheduleDates: ScheduleDateConfig[]
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
  scheduleDates,
  saving,
  onSave
}: ClassDialogProps) {
  // 构建学员选项
  const studentOptions = students.map(s => ({
    value: s.id,
    label: `${s.name} (${s.grade || '未设年级'})${s.billing ? ` - 剩余${s.billing.remaining_hours}课时` : ''}`
  }))

  // 构建助教选项
  const teacherOptions = [
    { value: '', label: '不指定助教' },
    ...teachers.map(t => ({ value: t.id, label: t.name }))
  ]

  // 添加排课项
  const handleAddScheduleItem = () => {
    // 新时段的开始时间 = 上一个时段的结束时间
    const lastSchedule = classForm.schedules[classForm.schedules.length - 1]
    const startTime = lastSchedule ? lastSchedule.end_time : '09:00'
    const [hours, minutes] = startTime.split(':').map(Number)
    const endHours = hours + 2
    const endTime = `${endHours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`

    const newItem: ScheduleItem = {
      id: generateId(),
      date: scheduleDates.find(d => !classForm.schedules.some(s => s.date === d.date))?.date || scheduleDates[0]?.date || new Date().toISOString().split('T')[0],
      start_time: startTime,
      end_time: endTime,
      duration_hours: 2
    }
    setClassForm(prev => ({
      ...prev,
      schedules: [...prev.schedules, newItem]
    }))
  }

  // 删除排课项
  const handleRemoveScheduleItem = (id: string) => {
    setClassForm(prev => ({
      ...prev,
      schedules: prev.schedules.filter(s => s.id !== id)
    }))
  }

  // 计算结束时间（开始时间 + 2小时）
  const calcEndTime = (startTime: string) => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const endHours = hours + 2
    return `${endHours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`
  }

  // 更新排课项，并联动后续时段的开始时间
  const handleUpdateScheduleItem = (id: string, field: keyof ScheduleItem, value: string | number) => {
    setClassForm(prev => {
      const index = prev.schedules.findIndex(s => s.id === id)
      if (index === -1) return prev

      let newSchedules = [...prev.schedules]

      if (field === 'start_time') {
        const startTime = value as string
        const endTime = calcEndTime(startTime)
        newSchedules[index] = { ...newSchedules[index], start_time: startTime, end_time: endTime, duration_hours: 2 }
        // 联动更新后续时段
        let prevEnd = endTime
        for (let i = index + 1; i < newSchedules.length; i++) {
          const nextEnd = calcEndTime(prevEnd)
          newSchedules[i] = { ...newSchedules[i], start_time: prevEnd, end_time: nextEnd, duration_hours: 2 }
          prevEnd = nextEnd
        }
      } else if (field === 'end_time') {
        newSchedules[index] = { ...newSchedules[index], end_time: value as string }
        // 联动更新后续时段
        let prevEnd = value as string
        for (let i = index + 1; i < newSchedules.length; i++) {
          const nextEnd = calcEndTime(prevEnd)
          newSchedules[i] = { ...newSchedules[i], start_time: prevEnd, end_time: nextEnd, duration_hours: 2 }
          prevEnd = nextEnd
        }
      } else {
        newSchedules[index] = { ...newSchedules[index], [field]: value }
      }

      return { ...prev, schedules: newSchedules }
    })
  }

  // 获取日期配置
  const getDateConfig = (date: string) => scheduleDates.find(d => d.date === date)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingClass ? '编辑课程' : '新增排课'}</DialogTitle></DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* 排课项列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">排课时间</label>
              {!editingClass && (
                <Button variant="outline" size="sm" onClick={handleAddScheduleItem}>
                  <Plus className="h-4 w-4 mr-1" /> 添加时段
                </Button>
              )}
            </div>

            {classForm.schedules.map((schedule, index) => {
              const dateConfig = getDateConfig(schedule.date)
              return (
                <div key={schedule.id} className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">排课 {index + 1}</span>
                    {classForm.schedules.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveScheduleItem(schedule.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">日期</label>
                      <Select
                        value={schedule.date}
                        onChange={e => handleUpdateScheduleItem(schedule.id, 'date', e.target.value)}
                        options={scheduleDates.map(d => ({ value: d.date, label: `${d.label} (${formatDisplayDate(new Date(d.date))})` }))}
                        placeholder="选择日期"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">开始时间</label>
                      <Input
                        type="time"
                        value={schedule.start_time}
                        onChange={e => handleUpdateScheduleItem(schedule.id, 'start_time', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">结束时间</label>
                      <Input
                        type="time"
                        value={schedule.end_time}
                        onChange={e => handleUpdateScheduleItem(schedule.id, 'end_time', e.target.value)}
                      />
                    </div>
                  </div>

                  {dateConfig && (
                    <div className="text-xs text-muted-foreground">
                      {dateConfig.label} · 时长 {schedule.duration_hours} 小时
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">备注</label>
            <Input value={classForm.notes} onChange={e => setClassForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="可选备注" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}