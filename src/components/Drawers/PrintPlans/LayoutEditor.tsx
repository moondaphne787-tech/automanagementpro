import { useState, useRef, useCallback, useMemo } from 'react'
import { GripVertical, Grid3X3, RotateCcw, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardLayout, buildInitialCards } from './buildLayoutCards'
import type { StudentWithPlan } from './StudentSelectionGrid'

interface LayoutEditorProps {
  selectedStudents: StudentWithPlan[]
  plansPerStudent: number
  layout: number // 每行列数
  showAssistantTips: boolean
  onExport: (cards: CardLayout[]) => void
  onBack: () => void
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


