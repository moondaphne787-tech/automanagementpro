import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, FileQuestion, BatteryLow, UserPlus, RefreshCw, Rocket, Users, Sparkles, Search, Settings2, GripVertical, EyeOff, Eye, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboard } from '../hooks/useDashboard'
import { StatCard } from '../components/Dashboard/StatCard'
import { TodaySchedulePanel } from '../components/Dashboard/TodaySchedulePanel'
import { WeeklyPlanStatus } from '../components/Dashboard/WeeklyPlanStatus'
import { AlertStudents } from '../components/Dashboard/AlertStudents'
import { WeeklyClassSummary } from '../components/Dashboard/WeeklyClassSummary'
import { StudentOverview } from '../components/Dashboard/StudentOverview'
import { Button } from '../components/ui/button'
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '../components/ui/dialog'
import { ClassRecordForm } from '../components/ClassRecord/ClassRecordForm'
import { useAppStore } from '../store/appStore'
import { cn } from '../lib/utils'
import type { TodayScheduleItem } from '../types'
import type { DashboardConfig } from '../store/types'

// 面板注册表
const PANEL_REGISTRY: Record<string, { label: string }> = {
  todaySchedule: { label: '今日排课' },
  weeklyPlan: { label: '本周计划状态' },
  alertStudents: { label: '需关注学员' },
  weeklySummary: { label: '本周课堂总结' },
  studentOverview: { label: '学员总览' },
}

// 可排序面板包装器
function SortablePanel({ id, editing, onHide, children }: {
  id: string; editing: boolean; onHide: (id: string) => void; children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {editing && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onHide(id)}
            className="w-6 h-6 rounded-full bg-muted-foreground/80 text-background flex items-center justify-center shadow hover:bg-destructive transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className={cn(editing && "ring-2 ring-primary/20 ring-dashed rounded-lg")}>
        {children}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useDashboard()
  const wordbanks = useAppStore(s => s.wordbanks)
  const createClassRecord = useAppStore(s => s.createClassRecord)
  const openGenerateDrawer = useAppStore(s => s.openGenerateDrawer)
  // 跳转到批量生成页面（可带预选学员 ID）
  const goToGenerate = (preselectedIds?: string[]) => {
    navigate('/batch/generate', preselectedIds?.length ? { state: { preselectedIds } } : undefined)
  }
  const dashboardConfig = useAppStore(s => s.dashboardConfig)
  const setDashboardConfig = useAppStore(s => s.setDashboardConfig)
  const resetDashboardConfig = useAppStore(s => s.resetDashboardConfig)

  const [quickRecordTarget, setQuickRecordTarget] = useState<TodayScheduleItem | null>(null)
  const [editing, setEditing] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleQuickRecord = useCallback((schedule: TodayScheduleItem) => {
    setQuickRecordTarget(schedule)
  }, [])

  const handleQuickRecordSave = useCallback(async (formData: any) => {
    await createClassRecord(formData)
    toast.success('课堂记录创建成功')
    setQuickRecordTarget(null)
    refresh()
  }, [createClassRecord, refresh])

  // 渲染单个面板
  const renderPanel = (id: string) => {
    switch (id) {
      case 'todaySchedule':
        return <TodaySchedulePanel schedules={data?.todaySchedules ?? []} loading={loading} onQuickRecord={handleQuickRecord} />
      case 'weeklyPlan':
        return <WeeklyPlanStatus items={data?.problemPlanStudents ?? []} loading={loading} onBatchGenerate={openGenerateDrawer} />
      case 'alertStudents':
        return <AlertStudents students={data?.alertStudents ?? []} loading={loading} />
      case 'weeklySummary':
        return <WeeklyClassSummary summary={data?.weeklySummary ?? null} loading={loading} />
      case 'studentOverview':
        return <StudentOverview data={data?.studentOverview ?? null} loading={loading} />
      default:
        return null
    }
  }

  const handleHidePanel = (id: string) => {
    const newConfig: DashboardConfig = {
      left: dashboardConfig.left.filter(p => p !== id),
      right: dashboardConfig.right.filter(p => p !== id),
      hidden: [...dashboardConfig.hidden, id]
    }
    setDashboardConfig(newConfig)
  }

  const handleShowPanel = (id: string) => {
    // 恢复到右列末尾
    const newConfig: DashboardConfig = {
      ...dashboardConfig,
      right: [...dashboardConfig.right, id],
      hidden: dashboardConfig.hidden.filter(h => h !== id)
    }
    setDashboardConfig(newConfig)
  }

  const handleDragEnd = (event: DragEndEvent, column: 'left' | 'right') => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const items = [...dashboardConfig[column]]
    const oldIndex = items.indexOf(active.id as string)
    const newIndex = items.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const newItems = arrayMove(items, oldIndex, newIndex)
    setDashboardConfig({ ...dashboardConfig, [column]: newItems })
  }

  const isEmpty = !loading && data &&
    data.stats.todayScheduleCount === 0 &&
    data.stats.missingPlanCount === 0 &&
    data.stats.lowHoursCount === 0 &&
    data.stats.trialStudentCount === 0 &&
    (data.todaySchedules?.length ?? 0) === 0

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">工作台</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
          }}>
            <Search className="w-4 h-4 mr-1.5" />
            搜索
            <kbd className="ml-2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </Button>
          <Button
            variant={editing ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            <Settings2 className="w-4 h-4 mr-1.5" />
            {editing ? '完成' : '自定义'}
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 编辑模式：隐藏面板恢复区 */}
      {editing && dashboardConfig.hidden.length > 0 && (
        <div className="mb-4 p-3 bg-muted/50 border border-dashed rounded-lg">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <EyeOff className="w-3.5 h-3.5" />
            已隐藏的面板（点击恢复）
          </div>
          <div className="flex flex-wrap gap-2">
            {dashboardConfig.hidden.map(id => (
              <button
                key={id}
                onClick={() => handleShowPanel(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-background border rounded-md hover:border-primary/50 transition-colors"
              >
                <Eye className="w-3 h-3" />
                {PANEL_REGISTRY[id]?.label || id}
              </button>
            ))}
            <button
              onClick={() => { resetDashboardConfig(); toast.success('已恢复默认布局') }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              恢复默认
            </button>
          </div>
        </div>
      )}

      {/* 编辑模式：恢复默认按钮（无隐藏面板时也显示） */}
      {editing && dashboardConfig.hidden.length === 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => { resetDashboardConfig(); toast.success('已恢复默认布局') }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            恢复默认布局
          </button>
        </div>
      )}

      {/* 空状态引导 */}
      {isEmpty && (
        <div className="mb-8 p-6 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">快速开始</h2>
              <p className="text-sm text-muted-foreground">三步开启你的教务管理</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => navigate('/students/new')} className="flex items-center gap-3 p-4 bg-background rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all text-left">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-blue-600" /></div>
              <div><div className="text-sm font-medium">1. 添加学员</div><div className="text-xs text-muted-foreground">录入学员基本信息和课时</div></div>
            </button>
            <button onClick={() => navigate('/schedule')} className="flex items-center gap-3 p-4 bg-background rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all text-left">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0"><Calendar className="w-4 h-4 text-green-600" /></div>
              <div><div className="text-sm font-medium">2. 设置排课</div><div className="text-xs text-muted-foreground">为学员安排上课时间和助教</div></div>
            </button>
            <button onClick={() => goToGenerate()} className="flex items-center gap-3 p-4 bg-background rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all text-left">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-purple-600" /></div>
              <div><div className="text-sm font-medium">3. 生成计划</div><div className="text-xs text-muted-foreground">AI 自动生成课程计划</div></div>
            </button>
          </div>
        </div>
      )}

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="今日排课" value={data?.stats.todayScheduleCount ?? 0} unit="节" icon={<Calendar className="w-4 h-4" />} color="blue" loading={loading} onClick={() => navigate('/schedule')} />
        <StatCard label="本周缺计划" value={data?.stats.missingPlanCount ?? 0} unit="人" icon={<FileQuestion className="w-4 h-4" />} color="orange" loading={loading} alert={(data?.stats.missingPlanCount ?? 0) > 0} onClick={() => { const ids = (data?.problemPlanStudents ?? []).map(s => s.studentId); goToGenerate(ids.length > 0 ? ids : undefined) }} />
        <StatCard label="课时预警" value={data?.stats.lowHoursCount ?? 0} unit="人" icon={<BatteryLow className="w-4 h-4" />} color="red" loading={loading} alert={(data?.stats.lowHoursCount ?? 0) > 0} onClick={() => navigate('/students', { state: { filter: 'low_hours' } })} />
        <StatCard label="体验生待跟进" value={data?.stats.trialStudentCount ?? 0} unit="人" icon={<UserPlus className="w-4 h-4" />} color="purple" loading={loading} onClick={() => navigate('/trial')} />
      </div>

      {/* 主内容区 - 可自定义双列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左列 */}
        <div className="lg:col-span-7 space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'left')}>
            <SortableContext items={dashboardConfig.left} strategy={verticalListSortingStrategy}>
              {dashboardConfig.left.map(id => (
                <SortablePanel key={id} id={id} editing={editing} onHide={handleHidePanel}>
                  {renderPanel(id)}
                </SortablePanel>
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* 右列 */}
        <div className="lg:col-span-5 space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'right')}>
            <SortableContext items={dashboardConfig.right} strategy={verticalListSortingStrategy}>
              {dashboardConfig.right.map(id => (
                <SortablePanel key={id} id={id} editing={editing} onHide={handleHidePanel}>
                  {renderPanel(id)}
                </SortablePanel>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* 快速录入课堂记录 Dialog */}
      <Dialog open={!!quickRecordTarget} onOpenChange={(open) => { if (!open) setQuickRecordTarget(null) }}>
        {quickRecordTarget && (
          <>
            <DialogHeader><DialogTitle>快速录入 - {quickRecordTarget.studentName}</DialogTitle></DialogHeader>
            <DialogContent>
              <ClassRecordForm
                studentId={quickRecordTarget.studentId}
                wordbanks={wordbanks}
                initialDate={new Date().toISOString().split('T')[0]}
                initialTeacherName={quickRecordTarget.teacherName}
                onSave={handleQuickRecordSave}
                onCancel={() => setQuickRecordTarget(null)}
              />
            </DialogContent>
          </>
        )}
      </Dialog>
    </div>
  )
}
