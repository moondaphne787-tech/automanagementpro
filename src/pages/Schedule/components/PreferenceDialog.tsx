import { Plus, X } from 'lucide-react'
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

interface PreferenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedStudent: StudentWithPrefs | null
  preferenceForm: {
    day_of_week: DayOfWeek
    preferred_start: string
    preferred_end: string
    notes: string
  }
  setPreferenceForm: React.Dispatch<React.SetStateAction<{
    day_of_week: DayOfWeek
    preferred_start: string
    preferred_end: string
    notes: string
  }>>
  onAddPreference: () => Promise<void>
  onDeletePreference: (prefId: string) => Promise<void>
}

export function PreferenceDialog({
  open,
  onOpenChange,
  selectedStudent,
  preferenceForm,
  setPreferenceForm,
  onAddPreference,
  onDeletePreference
}: PreferenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{selectedStudent?.name} 的时段偏好</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          {selectedStudent && selectedStudent.preferences.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">已设置的偏好</label>
              <div className="space-y-2">
                {selectedStudent.preferences.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm">{DAY_LABELS[p.day_of_week]} {p.preferred_start?.slice(0, 5)}-{p.preferred_end?.slice(0, 5)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDeletePreference(p.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">添加新偏好</label>
            <div className="space-y-2">
              <Select
                value={preferenceForm.day_of_week}
                onChange={e => setPreferenceForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                options={[
                  { value: 'monday', label: '周一' }, { value: 'tuesday', label: '周二' },
                  { value: 'wednesday', label: '周三' }, { value: 'thursday', label: '周四' },
                  { value: 'friday', label: '周五' }, { value: 'saturday', label: '周六' },
                  { value: 'sunday', label: '周日' }
                ]}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  value={preferenceForm.preferred_start}
                  onChange={e => {
                    const startTime = e.target.value
                    // 自动计算结束时间为开始时间+2小时
                    const [hours, minutes] = startTime.split(':').map(Number)
                    const endHours = hours + 2
                    const endTime = `${endHours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`
                    setPreferenceForm(prev => ({
                      ...prev,
                      preferred_start: startTime,
                      preferred_end: endTime
                    }))
                  }}
                  placeholder="开始时间"
                />
                <Input
                  type="time"
                  value={preferenceForm.preferred_end}
                  onChange={e => setPreferenceForm(prev => ({ ...prev, preferred_end: e.target.value }))}
                  placeholder="结束时间"
                />
              </div>
            </div>
            <Button size="sm" onClick={onAddPreference}><Plus className="h-4 w-4 mr-1" /> 添加</Button>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>完成</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}