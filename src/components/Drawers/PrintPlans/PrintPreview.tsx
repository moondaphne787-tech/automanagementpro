import { parseTasks } from '@/db/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type { Student, LessonPlan, TaskBlock as TaskBlockType } from '@/types'
import { StudentWithPlan } from './StudentSelectionGrid'

interface PrintPreviewProps {
  selectedStudents: StudentWithPlan[]
  layout: number
  plansPerStudent: number
}

export function PrintPreview({ selectedStudents, layout, plansPerStudent }: PrintPreviewProps) {
  if (selectedStudents.length === 0) {
    return (
      <div className="p-6">
        <h3 className="font-medium mb-4">预览效果</h3>
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          请选择学员以预览打印效果
        </div>
      </div>
    )
  }

  const previewCards: Array<{ student: Student; plan: LessonPlan | null; planIndex: number }> = []
  selectedStudents.slice(0, 8).forEach(item => {
    if (item.plans.length === 0) {
      previewCards.push({ student: item.student, plan: null, planIndex: 0 })
    } else {
      item.plans.slice(0, plansPerStudent).forEach((plan, idx) => {
        previewCards.push({ student: item.student, plan, planIndex: idx + 1 })
      })
    }
  })

  const totalPages = Math.ceil(selectedStudents.reduce((acc, item) => {
    return acc + (item.plans.length === 0 ? 1 : Math.min(item.plans.length, plansPerStudent))
  }, 0) / (layout * 5))

  return (
    <div className="p-6">
      <h3 className="font-medium mb-4">预览效果</h3>
      <div className="flex flex-col items-center">
        <div className="space-y-3 w-full">
          <div
            className="bg-white border-2 border-gray-400 shadow-lg mx-auto"
            style={{
              width: '100%',
              maxWidth: '400px',
              aspectRatio: '210 / 297',
              padding: '2%',
              display: 'grid',
              gridTemplateColumns: layout === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
              gridAutoRows: '1fr',
              gap: '1.5%',
              alignContent: 'start',
              boxSizing: 'border-box',
            }}
          >
            {previewCards.slice(0, layout * 5).map((card, idx) => (
              <div
                key={idx}
                className="border border-gray-400 rounded overflow-hidden flex flex-col"
              >
                <div className="flex justify-between items-center border-b border-gray-300 px-2 py-1 bg-gray-50">
                  <span className="font-bold text-[11px]">{card.student.name}</span>
                  {card.plan && (
                    <span className="text-[10px] text-gray-500">
                      Period      ______:  {card.plan.plan_date || '未定'}
                    </span>
                  )}
                </div>
                <div className="flex-1 p-1.5 overflow-hidden">
                  {card.plan ? (
                    <div className="space-y-0.5">
                      {parseTasks(card.plan.tasks).slice(0, 3).map((task: TaskBlockType, tIdx: number) => {
                        const typeLabel = TASK_TYPE_LABELS[task.type] || task.type
                        let taskContent = ''
                        if (task.content) {
                          taskContent = task.content
                        } else if (['vocab_new', 'vocab_review', 'nine_grid'].includes(task.type) && task.wordbank_label) {
                          taskContent = task.wordbank_label
                          if (task.level_from && task.level_to) taskContent += ` 第${task.level_from}-${task.level_to}关`
                        }
                        return (
                          <div key={tIdx} className="flex items-start gap-0.5">
                            <span className="text-[8px] font-medium shrink-0">{tIdx + 1}.</span>
                            <span className="text-[8px] leading-tight">{typeLabel}{taskContent ? `：${taskContent}` : ''}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-[8px] text-gray-400 text-center py-2">暂无计划</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">预览（A4纸比例缩放）</p>
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground">共 {totalPages} 页，显示第 1 页预览</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
