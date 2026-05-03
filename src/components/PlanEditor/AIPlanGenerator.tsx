import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LEVEL_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import type { Student, Wordbank, StudentWordbankProgress, AIConfig, PlanStatus } from '@/types'

interface AIPlanGeneratorProps {
  student: Student
  progress: StudentWordbankProgress[]
  wordbanks: Wordbank[]
  aiConfig: AIConfig | null
  generating: boolean
  streamContent: string
  planStatus: PlanStatus | null
  extraInstruction: string
  onExtraInstructionChange: (value: string) => void
  onGenerate: () => void
  onCancel: () => void
}

export function AIPlanGenerator({
  student,
  progress,
  wordbanks,
  aiConfig,
  generating,
  streamContent,
  planStatus,
  extraInstruction,
  onExtraInstructionChange,
  onGenerate,
  onCancel,
}: AIPlanGeneratorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI 生成课程计划
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 数据摘要 */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">学员数据摘要</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>年级: {student.grade || '-'}</div>
            <div>程度: {LEVEL_LABELS[student.level]}</div>
            <div>自然拼读: {student.phonics_completed ? '已完成' : student.phonics_progress || '未开始'}</div>
            <div>国际音标: {student.ipa_completed ? '已完成' : '未开始'}</div>
          </div>
          {progress.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs text-muted-foreground mb-2">词库进度:</div>
              {progress.map(p => {
                const wb = wordbanks.find(w => w.id === p.wordbank_id)
                const total = p.total_levels_override ?? wb?.total_levels ?? 0
                const pct = total > 0 ? Math.round((p.current_level / total) * 100) : 0
                return (
                  <div key={p.id} className="mb-2 last:mb-0">
                    <div className="flex justify-between text-sm mb-0.5">
                      <span>{p.wordbank_label}</span>
                      <span className="text-xs text-muted-foreground">第 {p.current_level}/{total} 关 ({pct}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 大纲方向 */}
        <div>
          <label className="text-sm text-muted-foreground">大纲方向（可选）</label>
          <Input
            value={extraInstruction}
            onChange={(e) => onExtraInstructionChange(e.target.value)}
            placeholder="如：本周重点推进词库"
          />
        </div>

        {/* 流式输出内容 */}
        {streamContent && (
          <div className="bg-blue-500/5 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-700 mb-2">AI 正在生成...</div>
            <pre className="text-sm whitespace-pre-wrap font-mono">{streamContent}</pre>
          </div>
        )}

        {/* 进度评估结果 */}
        {planStatus && !generating && (
          <div className="border rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              📊 进度评估
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                planStatus.status === '按计划' && 'bg-green-100 text-green-700',
                planStatus.status === '略超前' && 'bg-blue-100 text-blue-700',
                planStatus.status === '略落后' && 'bg-yellow-100 text-yellow-700',
                planStatus.status === '明显落后' && 'bg-red-100 text-red-700',
              )}>
                {planStatus.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{planStatus.current_vs_plan}</p>
            <p className="text-sm">{planStatus.suggestion}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <Button
            onClick={onGenerate}
            disabled={!aiConfig?.api_key || generating}
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
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        </div>

        {!aiConfig?.api_key && (
          <p className="text-sm text-yellow-600">
            请先在「设置」页面配置 AI API Key
          </p>
        )}
      </CardContent>
    </Card>
  )
}
