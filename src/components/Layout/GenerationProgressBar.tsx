import { useNavigate } from 'react-router-dom'
import { Pause, Play, X, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

export function GenerationProgressBar() {
  const tasks = useAppStore(s => s.generationTasks)
  const running = useAppStore(s => s.generationRunning)
  const paused = useAppStore(s => s.generationPaused)
  const progress = useAppStore(s => s.generationProgress)
  const pauseGeneration = useAppStore(s => s.pauseGeneration)
  const resumeGeneration = useAppStore(s => s.resumeGeneration)
  const cancelGeneration = useAppStore(s => s.cancelGeneration)
  const clearGenerationResults = useAppStore(s => s.clearGenerationResults)
  const navigate = useNavigate()

  // 不显示条件：没有任务或已清除
  if (tasks.length === 0) return null

  const successCount = tasks.filter(t => t.status === 'success').length
  const failedCount = tasks.filter(t => t.status === 'failed').length
  const savedCount = tasks.filter(t => t.status === 'saved').length
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const isComplete = !running

  return (
    <div className={cn(
      "h-10 border-b flex items-center gap-3 px-4 text-sm transition-colors",
      running && !paused && "bg-primary/5",
      paused && "bg-yellow-500/5",
      isComplete && "bg-green-500/5"
    )}>
      {/* 状态图标 */}
      {running && !paused && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
      {paused && <Pause className="w-3.5 h-3.5 text-yellow-600 shrink-0" />}

      {/* 进度条 */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              paused ? "bg-yellow-500" : isComplete ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {running ? (
            paused ? `已暂停 ${progress.done}/${progress.total}` : `生成中 ${progress.done}/${progress.total}`
          ) : (
            `完成 ${successCount} 成功${failedCount > 0 ? ` · ${failedCount} 失败` : ''}${savedCount > 0 ? ` · ${savedCount} 已保存` : ''}`
          )}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 shrink-0">
        {running && (
          paused ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resumeGeneration}>
              <Play className="w-3 h-3 mr-1" /> 继续
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={pauseGeneration}>
              <Pause className="w-3 h-3 mr-1" /> 暂停
            </Button>
          )
        )}

        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate('/batch/generate')}>
          查看详情 <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>

        {running ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={cancelGeneration}>
            <X className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={clearGenerationResults}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
