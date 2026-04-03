import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, FileQuestion, BatteryLow, UserPlus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboard } from '../hooks/useDashboard'
import { StatCard } from '../components/Dashboard/StatCard'
import { TodoPanel } from '../components/Dashboard/TodoPanel'
import { TodaySchedulePanel } from '../components/Dashboard/TodaySchedulePanel'
import { WeeklyPlanStatus } from '../components/Dashboard/WeeklyPlanStatus'
import { AlertStudents } from '../components/Dashboard/AlertStudents'
import { WeeklyClassSummary } from '../components/Dashboard/WeeklyClassSummary'
import { StudentOverview } from '../components/Dashboard/StudentOverview'
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
  
  // 快速录入 Dialog 状态
  const [quickRecordTarget, setQuickRecordTarget] = useState<TodayScheduleItem | null>(null)
  
  const handleQuickRecord = useCallback((schedule: TodayScheduleItem) => {
    setQuickRecordTarget(schedule)
  }, [])
  
  const handleQuickRecordSave = useCallback(async (data: any) => {
    await createClassRecord(data)
    toast.success('课堂记录创建成功')
    setQuickRecordTarget(null)
    refresh()
  }, [createClassRecord, refresh])

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
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 顶部统计卡片 - 响应式布局 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="今日排课"
          value={data?.stats.todayScheduleCount ?? 0}
          unit="节"
          icon={<Calendar className="w-4 h-4" />}
          color="blue"
          loading={loading}
          onClick={() => navigate('/schedule')}
        />
        <StatCard
          label="本周缺计划"
          value={data?.stats.missingPlanCount ?? 0}
          unit="人"
          icon={<FileQuestion className="w-4 h-4" />}
          color="orange"
          loading={loading}
          alert={(data?.stats.missingPlanCount ?? 0) > 0}
          onClick={() => {
            // 跳转到第一个缺计划学员的计划页，如果有的话
            const first = data?.problemPlanStudents?.[0]
            if (first) {
              navigate(`/students/${first.studentId}?tab=plans`)
            }
          }}
        />
        <StatCard
          label="课时预警"
          value={data?.stats.lowHoursCount ?? 0}
          unit="人"
          icon={<BatteryLow className="w-4 h-4" />}
          color="red"
          loading={loading}
          alert={(data?.stats.lowHoursCount ?? 0) > 0}
          onClick={() => navigate('/students', { state: { filter: 'low_hours' } })}
        />
        <StatCard
          label="体验生待跟进"
          value={data?.stats.trialStudentCount ?? 0}
          unit="人"
          icon={<UserPlus className="w-4 h-4" />}
          color="purple"
          loading={loading}
          onClick={() => navigate('/trial')}
        />
      </div>

      {/* 主内容区 - 响应式双列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左侧宽列 (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          {/* 今日排课 */}
          <TodaySchedulePanel
            schedules={data?.todaySchedules ?? []}
            loading={loading}
            onQuickRecord={handleQuickRecord}
          />

          {/* 本周计划状态 */}
          <WeeklyPlanStatus
            items={data?.problemPlanStudents ?? []}
            loading={loading}
          />

          {/* 需关注学员 */}
          <AlertStudents
            students={data?.alertStudents ?? []}
            loading={loading}
          />
        </div>

        {/* 右侧窄列 (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 待办清单 */}
          <TodoPanel
            todos={data?.todos ?? []}
            loading={loading}
            onRefresh={refresh}
          />

          {/* 本周课堂总结 */}
          <WeeklyClassSummary
            summary={data?.weeklySummary ?? null}
            loading={loading}
          />

          {/* 学员总览 */}
          <StudentOverview
            data={data?.studentOverview ?? null}
            loading={loading}
          />
        </div>
      </div>
      {/* 快速录入课堂记录 Dialog */}
      <Dialog
        open={!!quickRecordTarget}
        onOpenChange={(open) => { if (!open) setQuickRecordTarget(null) }}
      >
        {quickRecordTarget && (
          <>
            <DialogHeader>
              <DialogTitle>快速录入 - {quickRecordTarget.studentName}</DialogTitle>
            </DialogHeader>
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
