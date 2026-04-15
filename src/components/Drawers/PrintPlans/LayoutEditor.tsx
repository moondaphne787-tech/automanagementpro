import { useState, useRef, useCallback, useMemo } from 'react'
import { GripVertical, Grid3X3, RotateCcw, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parseTasks } from '@/db/utils'
import { TASK_TYPE_LABELS } from '@/types'
import type { TaskBlock as TaskBlockType } from '@/types'
import { StudentWithPlan } from './StudentSelectionGrid'

export interface CardLayout {
  id: string
  studentName: string
  grade: string
  planDate: string
  tasks: { label: string; content: string }[]
  notes?: string
  x: number      // 百分比 0-100
  y: number
  width: number   // 百分比
  height: number
  page: number
}

interface LayoutEditorProps {
  selectedStudents: StudentWithPlan[]
  plansPerStudent: number
  layout: number // 每行列数
  showAssistantTips: boolean
  onExport: (cards: CardLayout[]) => void
  onBack: () => void
}

// 根据任务数量估算卡片高度（百分比），紧凑排版
function estimateCardHeight(taskCount: number, hasNotes: boolean): number {
  // 头部约 2%，每个任务约 2.2%，notes 约 2%，底部留白 1%
  const headerH = 2
  const taskH = Math.max(taskCount, 1) * 2.2
  const notesH = hasNotes ? 2 : 0
  const padding = 1
  return Math.max(8, Math.min(40, headerH + taskH + notesH + padding))
}

function buildInitialCards(
  selectedStudents: StudentWithPlan[],
  plansPerStudent: number,
  cols: number
): CardLayout[] {
  const cards: CardLayout[] = []
  const gapX = 1.2
  const gapY = 0.8
  const marginX = 0.5 // 窄页边距
  const cardWidth = (100 - marginX * 2 - gapX * (cols - 1)) / cols

  // 先构建所有卡片数据（不含位置）
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

  // 按列流式排列，自适应高度，满页换页
  const colTops: number[] = new Array(cols).fill(marginX) // 每列当前 y 位置
  let page = 0
  let colIdx = 0
  const pageMaxY = 99 // 页面底部边界

  rawCards.forEach(raw => {
    // 找当前页中最短的列
    let bestCol = colIdx % cols
    let minTop = colTops[bestCol]
    for (let c = 0; c < cols; c++) {
      if (colTops[c] < minTop) {
        minTop = colTops[c]
        bestCol = c
      }
    }

    // 如果最短列也放不下，换页
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

export function LayoutEditor({ selectedStudents, plansPerStudent, layout, showAssistantTips, onExport, onBack }: LayoutEditorProps) {
  const [cards, setCards] = useState<CardLayout[]>(() =>
    buildInitialCards(selectedStudents, plansPerStudent, layout)
  )
  const [spreadStart, setSpreadStart] = useState(0) // 左页页码
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const leftCanvasRef = useRef<HTMLDivElement>(null)
  const rightCanvasRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; cardX: number; cardY: number; originPage: number }>({ x: 0, y: 0, cardX: 0, cardY: 0, originPage: 0 })
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 })

  const totalPages = useMemo(() => {
    if (cards.length === 0) return 1
    return Math.max(...cards.map(c => c.page), 0) + 1
  }, [cards])

  const leftPage = spreadStart
  const rightPage = spreadStart + 1
  const leftCards = useMemo(() => cards.filter(c => c.page === leftPage), [cards, leftPage])
  const rightCards = useMemo(() => cards.filter(c => c.page === rightPage), [cards, rightPage])

  // 判断鼠标在哪个画布上，返回对应的 ref 和页码
  const detectTargetCanvas = useCallback((clientX: number, clientY: number): { ref: HTMLDivElement; page: number } | null => {
    const leftRect = leftCanvasRef.current?.getBoundingClientRect()
    const rightRect = rightCanvasRef.current?.getBoundingClientRect()

    if (leftRect && clientX >= leftRect.left && clientX <= leftRect.right && clientY >= leftRect.top && clientY <= leftRect.bottom) {
      return { ref: leftCanvasRef.current!, page: leftPage }
    }
    if (rightRect && clientX >= rightRect.left && clientX <= rightRect.right && clientY >= rightRect.top && clientY <= rightRect.bottom) {
      return { ref: rightCanvasRef.current!, page: rightPage }
    }
    // 如果不在任何画布上，返回最近的
    if (leftRect && rightRect) {
      const leftDist = Math.abs(clientX - (leftRect.left + leftRect.width / 2))
      const rightDist = Math.abs(clientX - (rightRect.left + rightRect.width / 2))
      return leftDist < rightDist
        ? { ref: leftCanvasRef.current!, page: leftPage }
        : { ref: rightCanvasRef.current!, page: rightPage }
    }
    if (leftRect) return { ref: leftCanvasRef.current!, page: leftPage }
    if (rightRect) return { ref: rightCanvasRef.current!, page: rightPage }
    return null
  }, [leftPage, rightPage])

  // 删除卡片
  const handleDeleteCard = useCallback((cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId))
  }, [])

  // 拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent, cardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    setDraggingId(cardId)
    dragStartRef.current = { x: e.clientX, y: e.clientY, cardX: card.x, cardY: card.y, originPage: card.page }

    const handleMove = (me: MouseEvent) => {
      const target = detectTargetCanvas(me.clientX, me.clientY)
      if (!target) return
      const rect = target.ref.getBoundingClientRect()

      // 计算相对于起始画布的偏移量（百分比）
      const originCanvas = card.page === leftPage ? leftCanvasRef.current : rightCanvasRef.current
      const originRect = originCanvas?.getBoundingClientRect()
      if (!originRect) return

      const dx = ((me.clientX - dragStartRef.current.x) / rect.width) * 100
      const dy = ((me.clientY - dragStartRef.current.y) / rect.height) * 100
      const newX = Math.max(0, Math.min(95, dragStartRef.current.cardX + dx))
      const newY = Math.max(0, Math.min(95, dragStartRef.current.cardY + dy))

      setCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, x: newX, y: newY, page: target.page } : c
      ))
    }
    const handleUp = () => {
      setDraggingId(null)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [cards, detectTargetCanvas, leftPage])

  // 调整大小
  const handleResizeStart = useCallback((e: React.MouseEvent, cardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    setResizingId(cardId)
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: card.width, h: card.height }

    const handleMove = (me: MouseEvent) => {
      const target = detectTargetCanvas(me.clientX, me.clientY)
      if (!target) return
      const rect = target.ref.getBoundingClientRect()
      const dw = ((me.clientX - resizeStartRef.current.x) / rect.width) * 100
      const dh = ((me.clientY - resizeStartRef.current.y) / rect.height) * 100
      const newW = Math.max(15, Math.min(98, resizeStartRef.current.w + dw))
      const newH = Math.max(8, Math.min(50, resizeStartRef.current.h + dh))
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, width: newW, height: newH } : c))
    }
    const handleUp = () => {
      setResizingId(null)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [cards, detectTargetCanvas])

  // 自动排列
  const handleAutoArrange = () => {
    setCards(buildInitialCards(selectedStudents, plansPerStudent, layout))
    setSpreadStart(0)
  }

  // 翻页
  const canGoPrev = spreadStart > 0
  const canGoNext = spreadStart + 2 < totalPages || cards.some(c => c.page >= spreadStart + 2)

  // 渲染单个画布页面
  const renderPage = (pageNum: number, pageCards: CardLayout[], canvasRef: React.RefObject<HTMLDivElement>) => (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">第 {pageNum + 1} 页</span>
      <div
        ref={canvasRef}
        className="bg-white border-2 border-gray-300 shadow-lg relative select-none"
        style={{
          aspectRatio: '210 / 297',
          height: 'calc(100vh - 200px)',
          maxWidth: '100%',
        }}
      >
        {pageCards.map(card => (
          <div
            key={card.id}
            className={cn(
              "absolute border-2 rounded overflow-hidden bg-white transition-shadow group",
              draggingId === card.id ? "border-primary shadow-lg z-20" : "border-gray-400 hover:border-blue-400",
              resizingId === card.id && "border-primary"
            )}
            style={{
              left: `${card.x}%`,
              top: `${card.y}%`,
              width: `${card.width}%`,
              height: `${card.height}%`,
            }}
          >
            {/* 拖拽手柄 + 删除按钮 */}
            <div
              className="absolute top-0 left-0 right-0 h-5 bg-gray-50 border-b flex items-center px-1.5 cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => handleDragStart(e, card.id)}
            >
              <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-[9px] font-bold text-gray-700 truncate ml-1">{card.studentName}</span>
              <span className="text-[8px] text-gray-400 ml-auto truncate mr-4">{card.planDate}</span>
              {/* 删除按钮 */}
              <button
                className="absolute right-0.5 top-0.5 w-4 h-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteCard(card.id)
                }}
                title="删除此卡片"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* 卡片内容 */}
            <div className="absolute top-5 left-0 right-0 bottom-0 p-1.5 overflow-hidden">
              {card.tasks.map((task, i) => (
                <div key={i} className="flex items-start gap-0.5 mb-0.5">
                  <span className="text-[8px] font-medium shrink-0">{i + 1}.</span>
                  <span className="text-[8px] leading-tight">{task.label}{task.content ? `：${task.content}` : ''}</span>
                </div>
              ))}
              {showAssistantTips && card.notes && (
                <div className="text-[7px] text-gray-500 mt-1 pt-1 border-t border-dashed">提示：{card.notes}</div>
              )}
            </div>

            {/* 调整大小手柄 */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
              onMouseDown={(e) => handleResizeStart(e, card.id)}
            >
              <svg viewBox="0 0 12 12" className="w-3 h-3 text-gray-400">
                <path d="M11 1v10H1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 5v6H5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>返回设置</Button>
          <Button variant="ghost" size="sm" onClick={handleAutoArrange}>
            <Grid3X3 className="w-3.5 h-3.5 mr-1" /> 自动排列
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setCards(buildInitialCards(selectedStudents, plansPerStudent, layout)); setSpreadStart(0) }}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> 重置
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <span className="text-xs text-muted-foreground">
            共 {cards.length} 张卡片 · {totalPages} 页
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!canGoPrev} onClick={() => setSpreadStart(s => Math.max(0, s - 2))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              第 {leftPage + 1}-{rightPage + 1} 页
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!canGoNext} onClick={() => setSpreadStart(s => s + 2)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => onExport(cards)}>导出 PDF</Button>
        </div>
      </div>

      {/* 双页画布 */}
      <div className="flex-1 overflow-auto flex items-start justify-center gap-4 p-4 bg-muted/20">
        {renderPage(leftPage, leftCards, leftCanvasRef)}
        {renderPage(rightPage, rightCards, rightCanvasRef)}
      </div>
    </div>
  )
}

// 将 CardLayout 转换为打印 HTML（导出时过滤掉已删除的卡片）
export function generateLayoutHTML(cards: CardLayout[], showAssistantTips: boolean): string {
  const pages = new Map<number, CardLayout[]>()
  cards.forEach(c => {
    if (!pages.has(c.page)) pages.set(c.page, [])
    pages.get(c.page)!.push(c)
  })

  const pagesHtml = Array.from(pages.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, pageCards]) => {
      const cardsHtml = pageCards.map(card => {
        const tasksHtml = card.tasks.map((t, i) =>
          `<div style="display:flex;gap:3px;font-size:14px;line-height:1.5;margin-bottom:3px"><span style="min-width:16px;font-weight:500">${i + 1}.</span><span>${t.label}${t.content ? `：${t.content}` : ''}</span></div>`
        ).join('')
        const notesHtml = showAssistantTips && card.notes
          ? `<div style="font-size:9px;color:#666;margin-top:4px;padding-top:4px;border-top:1px dashed #ddd">提示：${card.notes}</div>`
          : ''
        return `<div style="position:absolute;left:${card.x}%;top:${card.y}%;width:${card.width}%;height:${card.height}%;border:2px solid #333;border-radius:6px;padding:10px 12px;overflow:hidden;box-sizing:border-box;background:white">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid #ddd;margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">${card.studentName} ${card.grade}</span>
            <span style="font-size:16px;color:#666">Period ______: ${card.planDate}</span>
          </div>
          ${tasksHtml}${notesHtml}
        </div>`
      }).join('')

      return `<div class="page" style="position:relative">${cardsHtml}</div>`
    }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>课程计划打印</title><style>*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:4mm}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:white}.page{width:210mm;height:297mm;position:relative;page-break-after:always}.page:last-child{page-break-after:auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pagesHtml}</body></html>`
}
