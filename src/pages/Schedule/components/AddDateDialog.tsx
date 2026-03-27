import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'

interface AddDateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newDateForm: {
    date: string
    type: ScheduleDateConfig['type']
    label: string
    timeStart: string
    timeEnd: string
  }
  setNewDateForm: React.Dispatch<React.SetStateAction<{
    date: string
    type: ScheduleDateConfig['type']
    label: string
    timeStart: string
    timeEnd: string
  }>>
  onAdd: () => void
}

export function AddDateDialog({
  open,
  onOpenChange,
  newDateForm,
  setNewDateForm,
  onAdd
}: AddDateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>添加排课日期</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">日期 *</label>
            <DateInput value={newDateForm.date} onChange={value => setNewDateForm(prev => ({ ...prev, date: value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">日期类型</label>
            <Select
              value={newDateForm.type}
              onChange={e => setNewDateForm(prev => ({ ...prev, type: e.target.value as ScheduleDateConfig['type'] }))}
              options={[
                { value: 'regular_weekend', label: '常规周末' },
                { value: 'friday_evening', label: '周五晚上' },
                { value: 'holiday', label: '假期' },
                { value: 'custom', label: '自定义' }
              ]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onAdd}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}