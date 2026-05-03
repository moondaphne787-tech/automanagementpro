import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, FileQuestion, BatteryLow, UserPlus, RefreshCw, Rocket, Users, Sparkles, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboard } from '../hooks/useDashboard'
import { StatCard } from '../components/Dashboard/StatCard'
import { TodaySchedulePanel, WeeklyPlanStatus } from '../components/Dashboard/DashboardPanels'
import { AlertStudents, StudentOverview, WeeklyClassSummary } from '../components/Dashboard/DashboardSidebar'
import { Button } from '../components/ui/button'
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '../components/ui/dialog'
import { ClassRecordForm } from '../components/ClassRecord/ClassRecordForm'
import { useAppStore } from '../store/appStore'
import type { TodayScheduleItem } from '../types'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useDashboard()
  const wordbanks = useAppStore(s => s.wordbanks)
  const createClassRecord = useAppStore(s => s.createClassRecord)

  const goToGenerate = (preselectedIds?: string[]) => {
    navigate('/batch/generate', preselectedIds?.length ? { state: { preselectedIds } } : undefined)
  }

  const [quickRecordTarget, setQuickRecordTarget] = useState<TodayScheduleItem | null>(null)

  const handleQuickRecord = useCallback((schedule: TodayScheduleItem) => {
    setQuickRecordTarget(schedule)
  }, [])

  const handleQuickRecordSave = useCallback(async (formData: any) => {
    await createClassRecord(formData)
    toast.success('课堂记录创建成功')
    setQuickRecordTarget(null)
    refresh()
  }, [createClassRecord, refresh])

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
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

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

      {/* 固定双列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <TodaySchedulePanel schedules={data?.todaySchedules ?? []} loading={loading} onQuickRecord={handleQuickRecord} />
          <WeeklyPlanStatus items={data?.problemPlanStudents ?? []} loading={loading} onBatchGenerate={(ids) => goToGenerate(ids)} />
          <AlertStudents students={data?.alertStudents ?? []} loading={loading} />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <WeeklyClassSummary summary={data?.weeklySummary ?? null} loading={loading} />
          <StudentOverview data={data?.studentOverview ?? null} loading={loading} />
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
