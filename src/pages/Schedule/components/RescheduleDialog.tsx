import type { ScheduledClass } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface RescheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reschedulingClass: ScheduledClass | null
  rescheduleForm: {
    class_date: string
    start_time: string
    end_time: string
  }
  setRescheduleForm: React.Dispatch<React.SetStateAction<{
    class_date: string
    start_time: string
    end_time: string
  }>>
  onConfirm: () => Promise<void>
}

export function RescheduleDialog({
  open,
  onOpenChange,
  reschedulingClass,
  rescheduleForm,
  setRescheduleForm,
  onConfirm
}: RescheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>调课</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">将课程调至新的时间</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">新日期</label>
            <DateInput value={rescheduleForm.class_date} onChange={value => setRescheduleForm(prev => ({ ...prev, class_date: value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">开始时间</label>
              <Input type="time" value={rescheduleForm.start_time} onChange={e => setRescheduleForm(prev => ({ ...prev, start_time: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">结束时间</label>
              <Input type="time" value={rescheduleForm.end_time} onChange={e => setRescheduleForm(prev => ({ ...prev, end_time: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onConfirm}>确认调课</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}