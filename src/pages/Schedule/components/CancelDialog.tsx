import type { ScheduledClass } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface CancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cancellingClass: ScheduledClass | null
  cancelReason: string
  setCancelReason: React.Dispatch<React.SetStateAction<string>>
  onConfirm: () => Promise<void>
}

export function CancelDialog({
  open,
  onOpenChange,
  cancellingClass,
  cancelReason,
  setCancelReason,
  onConfirm
}: CancelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>取消课程</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">确定要取消这节课程吗？</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">取消原因（可选）</label>
            <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="请输入取消原因" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>返回</Button>
          <Button variant="destructive" onClick={onConfirm}>确认取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}