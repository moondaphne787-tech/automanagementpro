import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PromptDialog } from '@/components/ui/dialog'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

interface WordbankTabProps {
  studentId: string
}

export function WordbankTab({ studentId }: WordbankTabProps) {
  const { currentProgress, wordbanks, upsertProgress, deleteProgress } = useAppStore()

  // PromptDialog 状态（用于"输入新关数"）
  const [promptState, setPromptState] = useState<{
    open: boolean
    title: string
    defaultValue: string
    onConfirm: ((value: string) => void) | null
  }>({ open: false, title: '', defaultValue: '', onConfirm: null })

  const showPrompt = (
    title: string,
    defaultValue: string,
    onConfirm: (value: string) => void
  ) => {
    setPromptState({ open: true, title, defaultValue, onConfirm })
  }

  return (
    <>
      <div className="space-y-6">
        {/* 现有进度列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentProgress.map((progress) => {
            const wordbank = wordbanks.find(w => w.id === progress.wordbank_id)
            const totalLevels = progress.total_levels_override || wordbank?.total_levels || 60
            const percentage = Math.round((progress.current_level / totalLevels) * 100)
            
            return (
              <Card key={progress.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{progress.wordbank_label}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        progress.status === 'completed' && "bg-success/10 text-success",
                        progress.status === 'active' && "bg-progress/10 text-progress",
                        progress.status === 'paused' && "bg-muted text-muted-foreground"
                      )}>
                        {progress.status === 'completed' ? '已完成' : progress.status === 'active' ? '进行中' : '已暂停'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="删除词库进度"
                        onClick={async () => {
                          const confirmMessage = progress.status === 'completed'
                            ? `确定要删除已完成的词库「${progress.wordbank_label}」吗？`
                            : `确定要删除词库「${progress.wordbank_label}」的进度记录吗？\n\n删除后进度将无法恢复。`
                          if (confirm(confirmMessage)) {
                            await deleteProgress(studentId, progress.wordbank_id)
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">当前进度</span>
                      <span>第 {progress.current_level} / {totalLevels} 关</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs text-muted-foreground">
                        上次九宫格：第 {progress.last_nine_grid_level} 关
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => {
                          showPrompt(`输入新的当前关数 (最大 ${totalLevels} 关):`, progress.current_level.toString(), (newLevel) => {
                            if (newLevel && !isNaN(parseInt(newLevel))) {
                              const level = Math.min(parseInt(newLevel), totalLevels)
                              upsertProgress({
                                student_id: studentId,
                                wordbank_id: progress.wordbank_id,
                                current_level: level,
                                status: level >= totalLevels ? 'completed' : 'active'
                              })
                            }
                          })
                        }}
                      >
                        更新进度
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* 添加词库进度 */}
        {wordbanks.length > currentProgress.length && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">添加词库</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Select
                  placeholder="选择词库"
                  options={wordbanks
                    .filter(w => !currentProgress.some(p => p.wordbank_id === w.id))
                    .map(w => ({ value: w.id, label: w.name }))}
                  className="flex-1"
                  onChange={(e) => {
                    if (e.target.value) {
                      upsertProgress({
                        student_id: studentId,
                        wordbank_id: e.target.value,
                        current_level: 0,
                        status: 'active'
                      })
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        defaultValue={promptState.defaultValue}
        onConfirm={(value) => {
          promptState.onConfirm?.(value)
          setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })
        }}
        onCancel={() =>
          setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })
        }
      />
    </>
  )
}