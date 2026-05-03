import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Clock } from 'lucide-react'
import { teacherAvailabilityDb } from '@/db'
import type { TeacherAvailability, DayOfWeek } from '@/types'
import { DAY_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const DAY_OPTIONS = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' }
]

interface AvailabilitySectionProps {
  teacherId: string
  availabilities: TeacherAvailability[]
  onDataReload: () => void
}

export function AvailabilitySection({ teacherId, availabilities, onDataReload }: AvailabilitySectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    day_of_week: 'saturday' as DayOfWeek,
    start_time: '09:00',
    end_time: '12:00',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // 按星期分组
  const grouped = availabilities.reduce((acc, a) => {
    const day = a.day_of_week
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {} as Record<DayOfWeek, TeacherAvailability[]>)

  const handleAdd = async () => {
    if (!teacherId) return

    try {
      setSaving(true)
      await teacherAvailabilityDb.create({
        teacher_id: teacherId,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        notes: form.notes || undefined,
      })

      setDialogOpen(false)
      setForm({ day_of_week: 'saturday', start_time: '09:00', end_time: '12:00', notes: '' })
      onDataReload()
      toast.success('时段添加成功')
    } catch (error) {
      console.error('Failed to add availability:', error)
      toast.error('添加失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (availabilityId: string) => {
    try {
      await teacherAvailabilityDb.delete(availabilityId)
      onDataReload()
      toast.success('时段已删除')
    } catch (error) {
      console.error('Failed to delete availability:', error)
      toast.error('删除失败，请重试')
    }
  }

  return (
    <Card className="p-6 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">可用时段</h2>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          添加时段
        </Button>
      </div>

      {availabilities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          暂无可用时段，点击上方按钮添加
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[]).map(day => (
            <div key={day}>
              <div className="text-sm font-medium mb-2">{DAY_LABELS[day]}</div>
              <div className="space-y-2">
                {grouped[day]?.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">
                        {a.start_time?.slice(0, 5)} - {a.end_time?.slice(0, 5)}
                      </span>
                      {a.notes && (
                        <span className="text-xs text-muted-foreground">({a.notes})</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {!grouped[day] && (
                  <p className="text-xs text-muted-foreground py-2">暂无时段</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加时段对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加可用时段</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-blue-700">
                <Clock className="h-4 w-4" />
                <span>添加通用时段，每周都可用</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">星期</label>
              <Select
                value={form.day_of_week}
                onChange={e => setForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                options={DAY_OPTIONS}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始时间</label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束时间</label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <Input
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="可选备注"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
