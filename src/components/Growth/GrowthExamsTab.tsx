import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { ExamScoreForm } from './ExamScoreForm'
import { EXAM_TYPE_LABELS } from './ScoreChart'
import type { ExamScore } from '@/types'

interface GrowthExamsTabProps {
  studentId: string
  examScores: ExamScore[]
  showForm: boolean
  editingItem: ExamScore | null
  onAdd: () => void
  onEdit: (score: ExamScore) => void
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  onDelete: (id: string) => Promise<void>
}

export function GrowthExamsTab({
  studentId,
  examScores,
  showForm,
  editingItem,
  onAdd,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: GrowthExamsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">考试成绩记录</h3>
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" />
          添加成绩
        </Button>
      </div>

      {showForm && (
        <ExamScoreForm
          studentId={studentId}
          onSave={onSave}
          onCancel={onCancel}
          initialData={editingItem || undefined}
        />
      )}

      {examScores.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          暂无考试成绩记录
        </div>
      ) : (
        <div className="space-y-3">
          {examScores.map((score) => {
            const percentage = score.score != null
              ? Math.round((score.score / (score.full_score || 100)) * 100)
              : null

            return (
              <Card key={score.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {score.exam_name || EXAM_TYPE_LABELS[score.exam_type]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {score.exam_date}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          score.exam_type === 'school_exam' && "bg-blue-500/10 text-blue-600",
                          score.exam_type === 'placement' && "bg-purple-500/10 text-purple-600",
                          score.exam_type === 'mock' && "bg-orange-500/10 text-orange-600"
                        )}>
                          {EXAM_TYPE_LABELS[score.exam_type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold">
                          {score.score ?? '-'}/{score.full_score || 100}
                        </span>
                        {percentage != null && (
                          <span className={cn(
                            "text-sm",
                            percentage >= 80 ? "text-green-600" :
                            percentage >= 60 ? "text-blue-600" :
                            percentage >= 40 ? "text-yellow-600" : "text-red-600"
                          )}>
                            {percentage}%
                          </span>
                        )}
                      </div>
                      {score.notes && (
                        <p className="text-sm text-muted-foreground">{score.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(score)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={async () => {
                          const confirmed = await confirmDialog({
                            title: '删除成绩记录',
                            message: '确定删除此成绩记录？',
                            confirmText: '删除',
                            variant: 'danger'
                          })
                          if (confirmed) {
                            await onDelete(score.id)
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
