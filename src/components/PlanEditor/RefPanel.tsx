import { StickyNote, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type { Student, Wordbank, StudentWordbankProgress, ClassRecord } from '@/types'

interface RefPanelProps {
  student: Student
  progress: StudentWordbankProgress[]
  wordbanks: Wordbank[]
  recentRecords: ClassRecord[]
}

export function RefPanel({ student, progress, wordbanks, recentRecords }: RefPanelProps) {
  return (
    <div className="space-y-4">
      {/* 学员备注 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <StickyNote className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-medium text-muted-foreground">学员备注</span>
        </div>
        {student.notes ? (
          <p className="text-sm bg-amber-500/5 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
            {student.notes}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">暂无备注</p>
        )}
      </div>

      {/* 词库进度 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-muted-foreground">词库进度</span>
        </div>
        {progress.length > 0 ? (
          <div className="space-y-2">
            {progress.map(p => {
              const wb = wordbanks.find(w => w.id === p.wordbank_id)
              const total = p.total_levels_override ?? wb?.total_levels ?? 0
              const pct = total > 0 ? Math.round((p.current_level / total) * 100) : 0
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{p.wordbank_label}</span>
                    <span>{p.current_level}/{total}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary rounded-full h-1.5 transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">暂无词库进度</p>
        )}
      </div>

      {/* 最近课堂记录 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-muted-foreground">最近 {recentRecords.length} 次课堂</span>
        </div>
        {recentRecords.length > 0 ? (
          <div className="space-y-2">
            {recentRecords.map(record => (
              <div key={record.id} className="bg-muted/40 rounded-lg p-2.5 text-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-xs">{record.class_date}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    record.task_completed === 'completed' ? 'bg-green-500/10 text-green-600' :
                    record.task_completed === 'partial' ? 'bg-yellow-500/10 text-yellow-600' :
                    'bg-red-500/10 text-red-600'
                  )}>
                    {record.task_completed === 'completed' ? '全部完成' :
                     record.task_completed === 'partial' ? '部分完成' : '未完成'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {record.tasks.map((task, idx) => (
                    <span key={idx} className="text-xs bg-background px-1.5 py-0.5 rounded border">
                      {TASK_TYPE_LABELS[task.type]}
                      {task.content ? `·${task.content.slice(0, 15)}${task.content.length > 15 ? '…' : ''}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">暂无课堂记录</p>
        )}
      </div>
    </div>
  )
}
