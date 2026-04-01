import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { AlertCircle, Sparkles, Loader2, Save } from 'lucide-react'
import type { AIConfig } from '@/types'

interface GenerationControlsProps {
  planDate: string
  onPlanDateChange: (date: string) => void
  extraInstruction: string
  onExtraInstructionChange: (instruction: string) => void
  aiConfig: AIConfig | null
  generating: boolean
  selectedCount: number
  successCount: number
  onStartGeneration: () => void
  onSaveAllConfirmed: () => void
}

export function GenerationControls({
  planDate,
  onPlanDateChange,
  extraInstruction,
  onExtraInstructionChange,
  aiConfig,
  generating,
  selectedCount,
  successCount,
  onStartGeneration,
  onSaveAllConfirmed
}: GenerationControlsProps) {
  return (
    <>
      {/* 全局参数设置 */}
      <div className="p-6 border-b space-y-4">
        <h3 className="font-medium">全局参数</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">计划日期</label>
            <DateInput
              value={planDate}
              onChange={(val) => onPlanDateChange(val)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">大纲方向（可选）</label>
            <Input
              value={extraInstruction}
              onChange={(e) => onExtraInstructionChange(e.target.value)}
              placeholder="如：本周重点推进词库"
            />
          </div>
        </div>

        {!aiConfig?.api_key && (
          <Card className="border-yellow-300 bg-yellow-500/10">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-700">
                请先在「设置」页面配置 AI API Key
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="h-16 border-t flex items-center justify-between px-6">
        <div className="flex gap-3">
          {successCount > 0 && (
            <Button
              variant="outline"
              onClick={onSaveAllConfirmed}
              disabled={generating}
            >
              <Save className="w-4 h-4 mr-2" />
              保存全部已确认 ({successCount})
            </Button>
          )}
        </div>
        <Button
          onClick={onStartGeneration}
          disabled={!aiConfig?.api_key || selectedCount === 0 || generating}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              开始生成
            </>
          )}
        </Button>
      </div>
    </>
  )
}