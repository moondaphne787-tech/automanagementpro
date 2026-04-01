import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'
import type { ClassRecord, ExamScore, PhaseType } from '@/types'

// 自动学习阶段接口
export interface AutoPhase {
  id: string
  name: string
  type: PhaseType
  startDate: string
  endDate: string
  isActive: boolean
  isCompleted: boolean
}

// 阶段类型标签
const PHASE_TYPE_LABELS: Record<PhaseType, string> = {
  semester: '学期',
  summer: '暑假',
  winter: '寒假'
}

interface AutoLearningPhasesPanelProps {
  studentId: string
  classRecords: ClassRecord[]
  examScores: ExamScore[]
  phases: AutoPhase[]
}

export function AutoLearningPhasesPanel({
  studentId,
  classRecords,
  examScores,
  phases
}: AutoLearningPhasesPanelProps) {
  // 计算阶段内的统计数据
  const getPhaseStats = (phase: AutoPhase) => {
    // 筛选阶段内的课堂记录
    const phaseRecords = classRecords.filter(r =>
      r.class_date >= phase.startDate && r.class_date <= phase.endDate
    )

    // 筛选阶段内的考试成绩
    const phaseScores = examScores.filter(s =>
      s.exam_date >= phase.startDate && s.exam_date <= phase.endDate
    )

    return {
      classCount: phaseRecords.length,
      totalHours: phaseRecords.reduce((sum, r) => sum + r.duration_hours, 0),
      scoreCount: phaseScores.length,
      avgScore: phaseScores.length > 0 && phaseScores.some(s => s.score != null)
        ? Math.round(phaseScores.filter(s => s.score != null).reduce((sum, s) => sum + (s.score || 0), 0) / phaseScores.filter(s => s.score != null).length)
        : null,
      records: phaseRecords
    }
  }

  if (phases.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">学习阶段</h3>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂未配置学习阶段</p>
            <p className="text-sm mt-1">请在「设置」页面配置学期日期</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">学习阶段</h3>
        <p className="text-xs text-muted-foreground">
          阶段日期由「设置」页面统一配置
        </p>
      </div>

      <div className="space-y-4">
        {phases.map((phase) => {
          const stats = getPhaseStats(phase)

          return (
            <Card key={phase.id} className={cn(
              phase.isActive && "border-green-300 bg-green-50/30",
              phase.isCompleted && "opacity-70"
            )}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{phase.name}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      phase.type === 'semester' && "bg-blue-500/10 text-blue-600",
                      phase.type === 'summer' && "bg-orange-500/10 text-orange-600",
                      phase.type === 'winter' && "bg-cyan-500/10 text-cyan-600"
                    )}>
                      {PHASE_TYPE_LABELS[phase.type]}
                    </span>
                    {phase.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-600">
                        进行中
                      </span>
                    )}
                    {phase.isCompleted && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        已结束
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{phase.startDate} ~ {phase.endDate}</span>
                  </div>

                  {/* 阶段内统计 */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="font-semibold">{stats.classCount}</div>
                      <div className="text-xs text-muted-foreground">课次</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="font-semibold">{stats.totalHours.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">课时</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="font-semibold">{stats.scoreCount}</div>
                      <div className="text-xs text-muted-foreground">考试</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="font-semibold">{stats.avgScore ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">平均分</div>
                    </div>
                  </div>

                  {/* 最近课堂记录 */}
                  {stats.records.length > 0 && (
                    <div className="pt-2 border-t">
                      <div className="text-xs text-muted-foreground mb-2">最近课堂记录：</div>
                      <div className="space-y-1">
                        {stats.records.slice(0, 3).map(record => (
                          <div key={record.id} className="flex items-center justify-between text-sm">
                            <span>{record.class_date}</span>
                            <span className="text-muted-foreground">
                              {record.tasks.length}个任务 · {record.duration_hours}h
                            </span>
                          </div>
                        ))}
                        {stats.records.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center pt-1">
                            还有 {stats.records.length - 3} 条记录
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export { PHASE_TYPE_LABELS }