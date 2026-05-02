import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Trash2, BarChart3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { GrowthPanel } from '@/components/Growth/GrowthPanel'
import { useAppStore } from '@/store/appStore'
import { getLevelColor, cn } from '@/lib/utils'
import { StudentTimeline } from '@/components/StudentTimeline/StudentTimeline'
import { InfoTab } from './InfoTab'
import { RecordsTab } from './RecordsTab'
import { PlansTab } from './PlansTab'
import { PlanningTab } from './PlanningTab'

type TabType = 'info' | 'records' | 'plans' | 'growth'

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentStudent = useAppStore(s => s.currentStudent)
  const deleteStudent = useAppStore(s => s.deleteStudent)
  const selectStudent = useAppStore(s => s.selectStudent)
  const loadWordbanks = useAppStore(s => s.loadWordbanks)
  const addRecentStudent = useAppStore(s => s.addRecentStudent)

  const [tab, setTab] = useState<TabType>('info')
  const [growthView, setGrowthView] = useState<'dashboard' | 'timeline'>('dashboard')
  const [plansView, setPlansView] = useState<'plans' | 'planning'>('plans')

  useEffect(() => {
    if (id) {
      selectStudent(id)
      loadWordbanks()
    }
  }, [id])

  useEffect(() => {
    if (currentStudent && id) {
      addRecentStudent(id, currentStudent.name)
    }
  }, [currentStudent?.id])

  if (!currentStudent) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
  }

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: '删除学员',
      message: '确定要删除此学员吗？此操作不可恢复。',
      confirmText: '删除',
      variant: 'danger'
    })
    if (confirmed) {
      await deleteStudent(id!)
      navigate('/')
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'info', label: '基本信息' },
    { key: 'records', label: '课堂记录' },
    { key: 'plans', label: '课程计划' },
    { key: 'growth', label: '成长档案' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn('w-3 h-3 rounded-full', getLevelColor(currentStudent.level))} />
          <h1 className="text-lg font-semibold">{currentStudent.name}</h1>
          <span className="text-sm text-muted-foreground">{currentStudent.student_no}</span>
          {currentStudent.student_type === 'trial' && (
            <span className="trial-badge">体验</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            删除
          </Button>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="border-b bg-card">
        <div className="flex px-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'info' ? (
          <InfoTab studentId={id!} />
        ) : tab === 'records' ? (
          <RecordsTab studentId={id!} />
        ) : tab === 'plans' ? (
          <div className="space-y-4">
            {/* 子导航 */}
            <div className="flex gap-2 border-b pb-2">
              <button
                onClick={() => setPlansView('plans')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  plansView === 'plans'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                课程计划
              </button>
              <button
                onClick={() => setPlansView('planning')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  plansView === 'planning'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                学习规划
              </button>
            </div>
            {plansView === 'plans' ? (
              <PlansTab studentId={id!} />
            ) : (
              <PlanningTab studentId={id!} />
            )}
          </div>
        ) : tab === 'growth' ? (
          <div className="space-y-4">
            {/* 视图切换 */}
            <div className="flex gap-2 border-b pb-2">
              <button
                onClick={() => setGrowthView('dashboard')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  growthView === 'dashboard'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <BarChart3 className="w-4 h-4" />
                成长概览
              </button>
              <button
                onClick={() => setGrowthView('timeline')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  growthView === 'timeline'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <List className="w-4 h-4" />
                时间线
              </button>
            </div>
            {growthView === 'dashboard' ? (
              <GrowthPanel studentId={id!} />
            ) : (
              <StudentTimeline studentId={id!} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
