import { parseTasks } from '@/db/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type { TaskBlock as TaskBlockType } from '@/types'
import type { StudentWithPlan } from './StudentSelectionGrid'

export interface CardLayout {
  id: string
  studentName: string
  grade: string
  planDate: string
  tasks: { label: string; content: string }[]
  notes?: string
  x: number
  y: number
  width: number
  height: number
  page: number
}

// 根据任务数量估算卡片高度（百分比），紧凑排版
function estimateCardHeight(taskCount: number, hasNotes: boolean): number {
  const headerH = 2
  const taskH = Math.max(taskCount, 1) * 2.2
  const notesH = hasNotes ? 2 : 0
  const padding = 1
  return Math.max(8, Math.min(40, headerH + taskH + notesH + padding))
}

export function buildInitialCards(
  selectedStudents: StudentWithPlan[],
  plansPerStudent: number,
  cols: number
): CardLayout[] {
  const cards: CardLayout[] = []
  const gapX = 1.2
  const gapY = 0.8
  const marginX = 0.5
  const cardWidth = (100 - marginX * 2 - gapX * (cols - 1)) / cols

  const rawCards: Omit<CardLayout, 'x' | 'y' | 'page'>[] = []
  selectedStudents.forEach(item => {
    const plans = item.plans.length === 0 ? [null] : item.plans.slice(0, plansPerStudent)
    plans.forEach((plan, pIdx) => {
      const tasks = plan ? parseTasks(plan.tasks).map((t: TaskBlockType) => {
        const label = TASK_TYPE_LABELS[t.type] || t.type
        let content = ''
        if (t.content) content = t.content
        else if (t.wordbank_label) {
          content = t.wordbank_label
          if (t.level_from && t.level_to) content += ` 第${t.level_from}-${t.level_to}关`
        }
        return { label, content }
      }) : []

      rawCards.push({
        id: `${item.student.id}_${pIdx}`,
        studentName: item.student.name,
        grade: item.student.grade || '',
        planDate: plan?.plan_date || '未定',
        tasks,
        notes: plan?.notes || undefined,
        width: cardWidth,
        height: estimateCardHeight(tasks.length, !!(plan?.notes)),
      })
    })
  })

  const colTops: number[] = new Array(cols).fill(marginX)
  let page = 0
  let colIdx = 0
  const pageMaxY = 99

  rawCards.forEach(raw => {
    let bestCol = colIdx % cols
    let minTop = colTops[bestCol]
    for (let c = 0; c < cols; c++) {
      if (colTops[c] < minTop) {
        minTop = colTops[c]
        bestCol = c
      }
    }

    if (minTop + raw.height > pageMaxY) {
      page++
      colTops.fill(marginX)
      bestCol = 0
      minTop = marginX
    }

    const x = marginX + bestCol * (cardWidth + gapX)
    const y = colTops[bestCol]

    cards.push({
      ...raw,
      x,
      y,
      page,
    })

    colTops[bestCol] = y + raw.height + gapY
    colIdx++
  })

  return cards
}
