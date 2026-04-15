import { Select } from '@/components/ui/select'

const LAYOUT_OPTIONS = [
  { value: '2', label: '每行 2 人（宽松）' },
  { value: '3', label: '每行 3 人（标准）' },
]

const PLANS_PER_STUDENT_OPTIONS = [
  { value: '1', label: '最近 1 次计划' },
  { value: '2', label: '最近 2 次计划' },
  { value: '3', label: '最近 3 次计划' },
  { value: '4', label: '最近 4 次计划' },
]

interface PrintSettingsPanelProps {
  layout: number
  plansPerStudent: number
  showAssistantTips: boolean
  onLayoutChange: (layout: number) => void
  onPlansPerStudentChange: (count: number) => void
  onShowAssistantTipsChange: (show: boolean) => void
}

export function PrintSettingsPanel({
  layout, plansPerStudent, showAssistantTips,
  onLayoutChange, onPlansPerStudentChange, onShowAssistantTipsChange
}: PrintSettingsPanelProps) {
  return (
    <div className="p-6 border-b space-y-4">
      <h3 className="font-medium">打印设置</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">每行学员数</label>
          <Select
            value={layout.toString()}
            options={LAYOUT_OPTIONS}
            onChange={(e) => onLayoutChange(parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">每人计划数</label>
          <Select
            value={plansPerStudent.toString()}
            options={PLANS_PER_STUDENT_OPTIONS}
            onChange={(e) => onPlansPerStudentChange(parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">显示选项</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAssistantTips}
                onChange={(e) => onShowAssistantTipsChange(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">助教提示</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
